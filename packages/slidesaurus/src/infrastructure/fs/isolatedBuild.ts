/**
 * Isolated build directory management.
 *
 * Single responsibility: create and clean up the per-presentation temporary
 * directory that Slidev builds in, ensuring each build is fully independent
 * with no shared state across parallel builds.
 */
import fs from "node:fs";
import path from "node:path";
import { SLIDEV_BUILD_ARTIFACTS } from "./fileSystem";

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Hard-link src to dest; fall back to copyFileSync on cross-device / FAT filesystems. */
function hardLinkOrCopy(src: string, dest: string): void {
  try {
    fs.linkSync(src, dest);
  } catch {
    fs.copyFileSync(src, dest);
  }
}

/** Recursively copy a directory, skipping symlinks to prevent traversal. */
function copyDirRecursive(src: string, dest: string): void {
  if (fs.lstatSync(src).isSymbolicLink()) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy the source .md file to the isolated directory.
 * Hard links are intentionally NOT used here — patchFrontmatterAddons/Theme
 * writes to this path and hard-linked inodes share the same content, which
 * would silently corrupt the original presentation source.
 */
function copySourceFile(src: string, dest: string): void {
  fs.copyFileSync(src, dest);
}

/**
 * Hard-link (or copy as fallback) all co-located non-.md assets from sourceDir
 * into isolatedDir. Hard links avoid I/O duplication across parallel builds.
 */
function copyColocatedAssets(sourceDir: string, isolatedDir: string): void {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (entry.name.endsWith(".md") || entry.name.startsWith("_category_")) continue;
    const srcPath = path.join(sourceDir, entry.name);
    const destPath = path.join(isolatedDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      hardLinkOrCopy(srcPath, destPath);
    }
  }
}

/**
 * Strip fenced code blocks, inline code, and HTML comments from Markdown.
 * Applied before extracting relative asset paths to avoid false positives
 * (e.g. example paths inside ``` code fences).
 */
function stripCodeFences(md: string): string {
  return md
    .replace(/^```[\s\S]*?^```/gm, "") // fenced blocks (``` ... ```)
    .replace(/`[^`\n]+`/g, "")         // inline code (`...`)
    .replace(/<!--[\s\S]*?-->/g, "");  // HTML comments
}

/**
 * Parse a Slidev markdown source for relative asset references and copy any
 * files not already present in the isolated build directory. Handles:
 *   - Markdown images:   ![alt](./path/to/img.png)
 *   - HTML src/href:     src="./path" href="./path"
 *   - CSS background:    background: ./path / url(./path)
 */
function copyRelativeAssets(mdContent: string, sourceDir: string, isolatedDir: string): void {
  const cleanContent = stripCodeFences(mdContent);
  const RE = /(?:!\[[^\]]*\]\(|src=["']?|href=["']?|background:\s*|url\(["']?)(\.\.?\/[^)"'\s>]+)/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = RE.exec(cleanContent)) !== null) {
    const relPath = m[1];
    if (seen.has(relPath)) continue;
    seen.add(relPath);
    const srcAbs = path.resolve(sourceDir, relPath);
    const relCheck = path.relative(sourceDir, srcAbs);
    if (!relCheck || relCheck === "." || relCheck.startsWith("..")) continue;
    if (!fs.existsSync(srcAbs) || !fs.statSync(srcAbs).isFile()) continue;
    const destAbs = path.resolve(isolatedDir, relPath);
    if (!relPath.startsWith("../")) continue;
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    if (!fs.existsSync(destAbs)) hardLinkOrCopy(srcAbs, destAbs);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create an isolated build directory for a single presentation.
 * Orchestrates: path-traversal guard → copy source file → co-located assets
 * → relative assets referenced in the markdown → dummy index.html sentinel.
 *
 * @returns The absolute path to the isolated copy of the source `.md` file.
 */
export function createIsolatedBuildDir(
  sourceAbsolutePath: string,
  presentationId: string,
  cacheDir: string,
): string {
  const safeId = presentationId.replaceAll(/[/\\]/g, "__");
  const buildsRoot = path.resolve(cacheDir, "builds");
  const isolatedDir = path.resolve(buildsRoot, safeId);
  const rel = path.relative(buildsRoot, isolatedDir);
  if (rel.startsWith("..")) {
    throw new Error(`[Security] Path traversal detected in presentationId: "${presentationId}"`);
  }
  fs.mkdirSync(isolatedDir, { recursive: true });

  const isolatedSourcePath = path.join(isolatedDir, `${safeId}.md`);
  const sourceDir = path.dirname(sourceAbsolutePath);

  copySourceFile(sourceAbsolutePath, isolatedSourcePath);
  copyColocatedAssets(sourceDir, isolatedDir);
  copyRelativeAssets(fs.readFileSync(sourceAbsolutePath, "utf-8"), sourceDir, isolatedDir);
  // Create a dummy index.html to prevent Slidev CLI ENOENT when it tries to unlink it.
  fs.writeFileSync(path.join(isolatedDir, "index.html"), "", "utf-8");

  return isolatedSourcePath;
}

/**
 * Clean up build artifacts inside an isolated build directory after a build.
 * Keeps the directory itself so Slidev's watcher (if any) doesn't break.
 */
export function cleanupIsolatedBuildDir(isolatedDir: string): void {
  if (!fs.existsSync(isolatedDir)) return;
  for (const artifact of [...SLIDEV_BUILD_ARTIFACTS, "node_modules"]) {
    const p = path.join(isolatedDir, artifact);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }
}
