import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import yaml from "js-yaml";
import type {
  PluginOptions,
  ScanOptions,
  BuildOptions,
  UIOptions,
  PresentationMetadata,
  CategoryMetadata,
  PlaylistData,
  ScanResult,
  SlidevFrontmatter,
  BuildContext,
} from "../domain/types";

/**
 * Minimal options consumed by `scanPresentations` — ISP: accept a sub-set,
 * not the full PluginOptions.  Callers passing the full `PluginOptions` object
 * continue to work because TypeScript checks structural compatibility.
 */
export type ScannerOptions = ScanOptions
  & Pick<UIOptions, "routeBasePath">
  & Pick<BuildOptions, "download" | "exportFormats" | "maxParallelBuilds">
  & Pick<PluginOptions, "onPresentationScanned" | "transformFrontmatter">;
import { log } from "../shared/logger";
import { getSlidevBuildOutputDir } from "../infrastructure/fs/outputManager";
import { normalizeBaseUrl, normalizeRoutePath } from "../shared/utils";
import { FrontmatterValidator } from "./frontmatterValidator";
import { runConcurrently } from "../shared/concurrentRunner";

function slugifyPlaylist(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// Use "en" locale explicitly — undefined uses the system locale, which differs
// between developer machines and CI, causing non-deterministic sort order.
const NATURAL_COLLATOR = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function buildPlaylists(presentations: PresentationMetadata[]): PlaylistData[] {
  const titles = new Map<string, string>();
  const groups = new Map<string, PresentationMetadata[]>();

  for (const p of presentations) {
    for (const name of p.playlist ?? []) {
      const slug = slugifyPlaylist(name);
      if (!titles.has(slug)) titles.set(slug, name);
      const group = groups.get(slug);
      if (group) group.push(p);
      else groups.set(slug, [p]);
    }
  }

  return Array.from(groups.entries()).map(([slug, group]) => {
    group.sort((a, b) => {
      const posCmp = (a.position ?? Infinity) - (b.position ?? Infinity);
      return posCmp !== 0 ? posCmp : NATURAL_COLLATOR.compare(a.id, b.id);
    });
    return { id: slug, title: titles.get(slug) ?? slug, items: group.map((p) => p.id) };
  });
}

/**
 * Format a directory name into a readable label.
 */
function formatDirectoryName(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Read _category_.yml / .yaml / .json from a directory.
 */
function readCategoryFile(dirPath: string): {
  label?: string;
  description?: string;
  position?: number;
} {
  for (const name of ["_category_.yml", "_category_.yaml", "_category_.json"]) {
    const filePath = path.join(dirPath, name);
    if (!fs.existsSync(filePath)) continue;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const raw = name.endsWith(".json")
        ? JSON.parse(content)
        : // Use JSON_SCHEMA to reject YAML-specific types (e.g. !!js/undefined, !!python/object)
          // that could cause unexpected behavior even after the result is type-checked.
          ((yaml.load(content, { schema: yaml.JSON_SCHEMA }) as Record<
            string,
            unknown
          >) ?? {});

      // Validate: only accept expected fields with safe types
      const result: {
        label?: string;
        description?: string;
        position?: number;
      } = {};
      if (typeof raw.label === "string") result.label = raw.label;
      if (typeof raw.description === "string")
        result.description = raw.description;
      if (typeof raw.position === "number" && Number.isFinite(raw.position))
        result.position = raw.position;
      return result;
    } catch {
      log.warn(`Failed to read category file in ${log.path(dirPath)}`);
    }
  }
  return {};
}

interface ScannedFile {
  relativePath: string;
  category: string;
}

/**
 * Recursively scan a directory for .md files.
 */
function scanDirectory(
  dir: string,
  baseDir: string,
  currentCategory = "",
): ScannedFile[] {
  const files: ScannedFile[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    if (entry.name === "node_modules" || entry.name === "sections") continue;
    // Skip symlinks — following them could escape outside the source directory
    if (entry.isSymbolicLink()) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const newCategory = currentCategory
        ? `${currentCategory}/${entry.name}`
        : entry.name;
      files.push(...scanDirectory(fullPath, baseDir, newCategory));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const relativePath = path.relative(baseDir, fullPath);
      files.push({ relativePath, category: currentCategory });
    }
  }
  return files;
}

/**
 * Scan for category directories and extract metadata.
 */
function scanCategories(
  sourceDir: string,
  baseUrl: string,
  routeBasePath: string,
): Map<string, CategoryMetadata> {
  const categories = new Map<string, CategoryMetadata>();

  function scan(dir: string, categoryPath = ""): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip symlinks — following them could escape outside the source directory
      if (entry.isSymbolicLink()) continue;
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);
      const newPath = categoryPath
        ? `${categoryPath}/${entry.name}`
        : entry.name;

      // Register the category unconditionally — dirs with no .md files are pruned
      // later by `.filter((cat) => cat.count > 0)`. This avoids a redundant full
      // recursive traversal of each subdirectory (previously done by hasMarkdownFiles).
      const data = readCategoryFile(fullPath);
      const normalizedBase = normalizeBaseUrl(baseUrl);
      const normalizedRoute = normalizeRoutePath(routeBasePath);
      categories.set(newPath, {
        path: newPath,
        label: data.label || formatDirectoryName(entry.name),
        description: data.description,
        position: data.position ?? 99,
        count: 0,
        url: `${normalizedBase}${normalizedRoute}/${newPath}`,
      });
      scan(fullPath, newPath);
    }
  }

  scan(sourceDir);
  return categories;
}

/**
 * Extract frontmatter metadata from a Slidev markdown file.
 * Optionally applies the transformFrontmatter hook.
 * @param filePath - Absolute path used to read the file (internal only)
 * @param relativePath - Relative path passed to the hook (avoids leaking absolute system paths)
 */
function extractMetadata(
  filePath: string,
  relativePath: string,
  transformFrontmatter?: PluginOptions["transformFrontmatter"],
): Record<string, unknown> {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    let { data } = matter(content);
    if (transformFrontmatter) {
      // Pass relative path only — never expose absolute system paths to user hooks
      data = transformFrontmatter(data as SlidevFrontmatter, relativePath);
    }
    return data;
  } catch {
    log.warn(`Failed to extract frontmatter from ${log.path(filePath)}`);
    return {};
  }
}

/**
 * Scan for Slidev presentations and extract metadata.
 */
export async function scanPresentations(
  options: ScannerOptions,
  context: BuildContext,
): Promise<ScanResult> {
  const sourceDir = path.resolve(context.siteDir, options.path);
  const normalizedRoute = normalizeRoutePath(options.routeBasePath);

  const categoriesMap = scanCategories(
    sourceDir,
    context.baseUrl,
    options.routeBasePath,
  );

  const scannedFiles = scanDirectory(sourceDir, sourceDir);
  if (scannedFiles.length === 0) {
    log.warn(`No Slidev presentations found in ${log.path(sourceDir)}`);
    return { presentations: [], categories: [], playlists: [] };
  }

  log.info(
    `Found ${scannedFiles.length} Slidev file(s) in: ${log.path(sourceDir)}`,
  );

  // Count presentations per category
  const categoryCounts = new Map<string, number>();
  for (const file of scannedFiles) {
    if (file.category) {
      categoryCounts.set(
        file.category,
        (categoryCounts.get(file.category) || 0) + 1,
      );
    }
  }
  for (const [catPath, count] of categoryCounts) {
    const cat = categoriesMap.get(catPath);
    if (cat) cat.count = count;
  }

  const baseUrl = normalizeBaseUrl(context.baseUrl);

  const presentations: PresentationMetadata[] = scannedFiles.map(
    ({ relativePath, category }) => {
      const sourceAbsolutePath = path.join(sourceDir, relativePath);
      // Normalize to forward slashes once. path.relative() uses OS separators (backslash
      // on Windows), which would otherwise leak into id, sourcePath, and the transformFrontmatter
      // hook — all of which have a contract of forward-slash POSIX paths.
      const normalizedRelativePath = relativePath.replace(/\\/g, "/");
      const id = normalizedRelativePath.replace(/\.md$/, "");
      const fm = extractMetadata(
        sourceAbsolutePath,
        normalizedRelativePath,
        options.transformFrontmatter,
      );
      const title = (fm.title as string) || path.basename(normalizedRelativePath, ".md");
      const url = `${baseUrl}${normalizedRoute}/${id}/`;
      const thumbnailUrl = `${url}thumbnail.png`;
      const exportUrls = options.download && options.exportFormats?.length
        ? options.exportFormats.map((fmt) => `${url}export.${fmt}`)
        : undefined;
      const outputPath = path.join(
        getSlidevBuildOutputDir(context.siteDir, options.id),
        id,
      );
      const enriched = new FrontmatterValidator(normalizedRelativePath).validate(fm);

      return {
        id,
        title,
        description: fm.description as string | undefined,
        theme: fm.theme as string | undefined,
        addons: Array.isArray(fm.addons) ? (fm.addons as string[]) : undefined,
        author: fm.author as string | undefined,
        ...enriched,
        sourcePath: normalizedRelativePath,
        sourceAbsolutePath,
        url,
        outputPath,
        previewUrl: url,
        thumbnailUrl,
        exportUrls,
        category,
      };
    },
  );

  // Invoke onPresentationScanned hook for each presentation — parallelised and bounded.
  // Each invocation is wrapped in try/catch so a single failing hook skips that
  // presentation with a warning rather than crashing the entire scan (as documented
  // in PluginOptions.onPresentationScanned JSDoc).
  if (options.onPresentationScanned) {
    await runConcurrently(
      presentations,
      options.maxParallelBuilds ?? 4,
      async (p) => {
        try {
          await Promise.resolve(options.onPresentationScanned!(p));
        } catch (err) {
          log.warn(
            `onPresentationScanned hook threw for ${log.code(p.id)}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    );
  }

  const categories = Array.from(categoriesMap.values())
    .filter((cat) => cat.count > 0)
    .sort((a, b) => a.position - b.position);

  const playlists = buildPlaylists(presentations);

  return { presentations, categories, playlists };
}
