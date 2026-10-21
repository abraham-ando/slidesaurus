/**
 * Presentation dependency discovery.
 *
 * Single responsibility: list every file (besides the `.md` entry itself) a
 * Slidev presentation needs to build. The SAME list drives both the isolated
 * build copy (`isolatedBuild.ts`) and the incremental cache hash
 * (`buildCache.ts`), so a file that influences the build always invalidates
 * the cache — and nothing else is copied.
 *
 * Collected:
 *   - co-located files of the entry's directory (except other `.md` decks,
 *     `_category_.*` and dotfiles);
 *   - co-located directories that are Slidev conventional dirs (components/,
 *     layouts/, styles/, setup/, public/, pages/, snippets/…) or that do not
 *     contain presentations themselves (i.e. are not sibling categories);
 *   - Markdown files imported with `src:` (recursively);
 *   - relative assets referenced from the Markdown (`./img.png`, `../shared/logo.png`).
 *
 * Every path is confined to `slidesRoot` (the plugin `path` directory):
 * references escaping it are ignored, symlinks are never followed.
 */
import fs from "node:fs";
import path from "node:path";
import { isInside } from "./fsUtils";

/** Slidev conventional directories — always copied when co-located. */
export const SLIDEV_CONVENTIONAL_DIRS = new Set([
  "components",
  "layouts",
  "styles",
  "setup",
  "public",
  "pages",
  "snippets",
  "sections",
  "assets",
  "images",
  "img",
  "media",
  "fonts",
]);

/** Directories never copied nor hashed. */
const IGNORED_DIRS = new Set(["node_modules", "dist", ".slidev"]);

/** Maximum depth of nested `src:` imports. */
const MAX_IMPORT_DEPTH = 10;

function isIgnoredName(name: string): boolean {
  return name.startsWith(".") || IGNORED_DIRS.has(name);
}

/**
 * True when `dir` contains presentation `.md` files according to the scanner
 * rules (skips dot/underscore dirs, node_modules and `sections/`), i.e. when it
 * is a category of its own and must not be copied into a sibling's build.
 */
export function containsPresentations(dir: string): boolean {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    if (entry.name === "node_modules" || entry.name === "sections") continue;
    if (entry.isFile() && entry.name.endsWith(".md")) return true;
    if (
      entry.isDirectory() &&
      containsPresentations(path.join(dir, entry.name))
    )
      return true;
  }
  return false;
}

/** Recursively list regular files of a directory (no symlinks, no ignored dirs). */
function listFilesRecursive(dir: string, out: Set<string>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || isIgnoredName(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFilesRecursive(full, out);
    else if (entry.isFile()) out.add(full);
  }
}

/** Co-located files and non-category directories of the entry's directory. */
function collectColocated(
  sourceDir: string,
  entryPath: string,
  out: Set<string>,
): void {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || isIgnoredName(entry.name)) continue;
    const full = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      if (
        SLIDEV_CONVENTIONAL_DIRS.has(entry.name) ||
        !containsPresentations(full)
      ) {
        listFilesRecursive(full, out);
      }
    } else if (entry.isFile()) {
      if (
        full === entryPath ||
        entry.name.endsWith(".md") ||
        entry.name.startsWith("_category_")
      )
        continue;
      out.add(full);
    }
  }
}

/**
 * Strip fenced code blocks, inline code, and HTML comments from Markdown.
 * Applied before extracting relative asset paths to avoid false positives
 * (e.g. example paths inside ``` code fences).
 */
export function stripCodeFences(md: string): string {
  let out = md
    .replace(/^```[\s\S]*?^```/gm, "") // fenced blocks (``` ... ```)
    .replace(/`[^`\n]+`/g, ""); // inline code (`...`)
  // HTML comments: repeat until stable, so a removal cannot splice a new
  // `<!--` together, then drop an unterminated one up to the end (as HTML does).
  let previous: string;
  do {
    previous = out;
    out = out.replace(/<!--[\s\S]*?-->/g, "");
  } while (out !== previous);
  return out.replace(/<!--[\s\S]*$/, "");
}

/**
 * Relative references found in Markdown:
 *   - Markdown images:   ![alt](./path/to/img.png)
 *   - HTML src/href:     src="./path" href="./path"
 *   - CSS / frontmatter: background: ./path, image: ./path, url(./path)
 */
const ASSET_REF_RE =
  /(?:!\[[^\]]*\]\(|src=["']?|href=["']?|background:\s*["']?|image:\s*["']?|url\(["']?)(\.\.?\/[^)"'\s>]+)/g;

/** `src: ./pages/intro.md` (optionally quoted, optionally with a `#2-5` slide range). */
const SRC_IMPORT_RE = /^src:\s*["']?([^"'\s#]+)(?:#[^"'\s]*)?["']?\s*$/gm;

/** Extract relative asset references and `src:` imports from Markdown content. */
export function extractReferences(md: string): {
  assets: string[];
  imports: string[];
} {
  const clean = stripCodeFences(md);
  const assets = new Set<string>();
  const imports = new Set<string>();
  for (const m of clean.matchAll(ASSET_REF_RE)) assets.add(m[1]);
  for (const m of clean.matchAll(SRC_IMPORT_RE)) imports.add(m[1]);
  return { assets: [...assets], imports: [...imports] };
}

/** Resolve a reference relative to `fromDir`; undefined if outside root, missing, or not a regular file. */
function resolveRef(
  ref: string,
  fromDir: string,
  slidesRoot: string,
): string | undefined {
  // Slidev resolves "/x" against the project root (the slides root here).
  const abs = ref.startsWith("/")
    ? path.join(slidesRoot, ref)
    : path.resolve(fromDir, ref);
  if (!isInside(slidesRoot, abs)) return undefined;
  try {
    const stat = fs.lstatSync(abs);
    return stat.isFile() ? abs : undefined;
  } catch {
    return undefined;
  }
}

function collectReferences(
  mdPath: string,
  slidesRoot: string,
  out: Set<string>,
  visited: Set<string>,
  depth: number,
): void {
  if (visited.has(mdPath) || depth > MAX_IMPORT_DEPTH) return;
  visited.add(mdPath);
  let content: string;
  try {
    content = fs.readFileSync(mdPath, "utf-8");
  } catch {
    return;
  }
  const fromDir = path.dirname(mdPath);
  const { assets, imports } = extractReferences(content);
  for (const ref of assets) {
    const abs = resolveRef(ref, fromDir, slidesRoot);
    if (abs) out.add(abs);
  }
  for (const ref of imports) {
    const abs = resolveRef(ref, fromDir, slidesRoot);
    if (!abs) continue;
    out.add(abs);
    if (abs.endsWith(".md"))
      collectReferences(abs, slidesRoot, out, visited, depth + 1);
  }
}

/**
 * List the absolute paths of every file the presentation depends on,
 * excluding the entry `.md` itself. Sorted for deterministic hashing.
 *
 * @param sourceAbsolutePath - Entry `.md` file.
 * @param slidesRoot - Root directory of all slides (the plugin `path`); no file
 *   outside it is ever returned. Defaults to the entry's directory.
 */
export function collectPresentationDependencies(
  sourceAbsolutePath: string,
  slidesRoot?: string,
): string[] {
  const entry = path.resolve(sourceAbsolutePath);
  const sourceDir = path.dirname(entry);
  const root =
    slidesRoot && isInside(path.resolve(slidesRoot), entry)
      ? path.resolve(slidesRoot)
      : sourceDir;
  const out = new Set<string>();
  collectColocated(sourceDir, entry, out);
  collectReferences(entry, root, out, new Set(), 0);
  out.delete(entry);
  return [...out].sort();
}
