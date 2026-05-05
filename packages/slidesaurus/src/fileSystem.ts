import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { log } from "./logger";
import { PLUGIN_NAME } from "./constants";
import type { PresentationMetadata } from "./types";

export const SLIDEV_CACHE_DIR = PLUGIN_NAME;

// Artifacts Slidev generates in source/build directories
const SLIDEV_BUILD_ARTIFACTS = ["index.html", ".slidev", "dist"] as const;

/**
 * Validate a pluginId before using it as a filesystem path component.
 * Rejects any value that could enable path traversal (dots, slashes, etc.).
 */
export function validatePluginId(pluginId: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(pluginId)) {
    throw new Error(
      `[Security] Invalid pluginId "${pluginId}": must contain only letters, digits, underscores and dashes.`,
    );
  }
}

/**
 * Get cache directory within .docusaurus for isolated builds
 */
export function getSlidevCacheDir(siteDir: string, pluginId: string): string {
  validatePluginId(pluginId);
  return path.join(siteDir, ".docusaurus", SLIDEV_CACHE_DIR, pluginId);
}

/**
 * Get the build output directory within the cache
 */
export function getSlidevBuildOutputDir(siteDir: string, pluginId: string): string {
  return path.join(getSlidevCacheDir(siteDir, pluginId), "output");
}

/**
 * Clean up Slidev-generated artifacts in source directory
 */
export function cleanupSourceDirectory(sourcePath: string): void {
  if (!fs.existsSync(sourcePath)) return;

  for (const name of SLIDEV_BUILD_ARTIFACTS) {
    const fullPath = path.join(sourcePath, name);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }
}


// ── createIsolatedBuildDir helpers ───────────────────────────────────────────

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
 * into isolatedDir. Hard links avoid I/O duplication across parallel builds;
 * falls back to copyFileSync on cross-device or FAT filesystems.
 */
function copyColocatedAssets(sourceDir: string, isolatedDir: string): void {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
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
 * Create an isolated build directory for a single presentation.
 * Orchestrates: path-traversal guard → copy source file → co-located assets
 * → relative assets referenced in the markdown → dummy index.html sentinel.
 */
export function createIsolatedBuildDir(
  sourceAbsolutePath: string,
  presentationId: string,
  cacheDir: string,
): string {
  const safeId = presentationId.replaceAll(/[/\\]/g, "__");
  const buildsRoot = path.resolve(cacheDir, "builds");
  const isolatedDir = path.resolve(buildsRoot, safeId);
  // Guard against path traversal: resolved path must stay inside buildsRoot.
  // path.relative() is used instead of startsWith() to avoid the prefix-attack
  // where "/builds/id" passes the startsWith check for buildsRoot "/builds/id".
  const rel = path.relative(buildsRoot, isolatedDir);
  // path.relative() never returns an absolute path — startsWith("..") is the sole guard.
  if (rel.startsWith("..")) {
    throw new Error(`[Security] Path traversal detected in presentationId: "${presentationId}"`);
  }
  fs.mkdirSync(isolatedDir, { recursive: true });

  const isolatedSourcePath = path.join(isolatedDir, `${safeId}.md`);
  const sourceDir = path.dirname(sourceAbsolutePath);

  copySourceFile(sourceAbsolutePath, isolatedSourcePath);
  copyColocatedAssets(sourceDir, isolatedDir);
  // Scan the .md for relative asset references (e.g. ![](./images/fig.png),
  // background: ./assets/bg.jpg) and copy files from sibling/parent directories.
  copyRelativeAssets(fs.readFileSync(sourceAbsolutePath, "utf-8"), sourceDir, isolatedDir);
  // Create a dummy index.html to prevent Slidev CLI ENOENT when it tries to unlink it
  fs.writeFileSync(path.join(isolatedDir, "index.html"), "", "utf-8");

  return isolatedSourcePath;
}

/**
 * Clean isolated build directory after build
 */
export function cleanupIsolatedBuildDir(isolatedDir: string): void {
  if (!fs.existsSync(isolatedDir)) return;
  for (const artifact of [...SLIDEV_BUILD_ARTIFACTS, "node_modules"]) {
    const p = path.join(isolatedDir, artifact);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
    }
  }
}

/**
 * Copy built presentations from cache to final output directory
 */
export function copyBuiltPresentationsToOutput(
  cacheOutputDir: string,
  finalOutputDir: string,
): void {
  if (!fs.existsSync(cacheOutputDir)) {
    log.warn(`Cache output directory not found: ${log.path(cacheOutputDir)}`);
    return;
  }
  fs.mkdirSync(finalOutputDir, { recursive: true });
  copyDirRecursive(cacheOutputDir, finalOutputDir);
}

/** Hard-link src to dest; fall back to copy on failure (cross-device, FAT, etc.). */
function hardLinkOrCopy(src: string, dest: string): void {
  try {
    fs.linkSync(src, dest);
  } catch {
    fs.copyFileSync(src, dest);
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
  // Strip code fences first to avoid false positives on example paths in code blocks
  const cleanContent = stripCodeFences(mdContent);
  // Match bare relative paths in Markdown, HTML attributes and CSS
  const RE = /(?:!\[[^\]]*\]\(|src=["']?|href=["']?|background:\s*|url\(["']?)(\.\.?\/[^)"'\s>]+)/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = RE.exec(cleanContent)) !== null) {
    const relPath = m[1];
    if (seen.has(relPath)) continue;
    seen.add(relPath);

    const srcAbs = path.resolve(sourceDir, relPath);
    // Safety: resolved path must remain inside sourceDir's parent tree
    const relCheck = path.relative(sourceDir, srcAbs);
    // Exclude empty ("foo/.."), self ("."), and traversing ("../") paths.
    // NOTE: path.isAbsolute(path.relative()) is structurally always false —
    // path.relative() never returns an absolute path. Use startsWith("..") only.
    if (!relCheck || relCheck === "." || relCheck.startsWith("..")) continue;
    if (!fs.existsSync(srcAbs) || !fs.statSync(srcAbs).isFile()) continue;

    const destAbs = path.resolve(isolatedDir, relPath);
    // Only copy files going UP from sourceDir (same-dir files already handled above)
    if (!relPath.startsWith("../")) continue;
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    if (!fs.existsSync(destAbs)) {
      hardLinkOrCopy(srcAbs, destAbs);
    }
  }
}

function copyDirRecursive(src: string, dest: string): void {
  // Guard against src itself being a symlink pointing outside the safe perimeter
  if (fs.lstatSync(src).isSymbolicLink()) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    // Skip symlinks — following them could traverse outside the source directory
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

// ============================================
// Incremental build cache
// ============================================

const HASH_MANIFEST = "build-hashes.json";

/**
 * Current manifest format version. Increment this when the format changes in
 * a backward-incompatible way — old manifests are then treated as missing,
 * triggering a full rebuild rather than silently using stale data.
 */
const CACHE_MANIFEST_VERSION = 2;

interface HashManifest {
  version: number;
  hashes: Record<string, string>;
}

/**
 * Compute a SHA-256 hash of a file's content.
 */
export function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Load the hash manifest from the cache directory.
 * Returns a map of presentation id → content hash.
 * Returns {} (rebuild all) when the manifest is absent, malformed, or on a
 * different version — prevents silently using data from an incompatible format.
 */
export function loadHashManifest(cacheDir: string): Record<string, string> {
  const manifestPath = path.join(cacheDir, HASH_MANIFEST);
  if (!fs.existsSync(manifestPath)) return {};
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    // Legacy flat format (no version field) or version mismatch → rebuild all
    if (
      typeof raw !== "object" ||
      raw === null ||
      (raw as Record<string, unknown>).version !== CACHE_MANIFEST_VERSION
    ) {
      log.info("Cache manifest version mismatch — rebuilding all presentations");
      return {};
    }
    return (raw as HashManifest).hashes ?? {};
  } catch {
    log.warn("Failed to read build hash manifest, rebuilding all");
    return {};
  }
}

/**
 * Save the hash manifest to the cache directory.
 */
export function saveHashManifest(cacheDir: string, manifest: Record<string, string>): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  const data: HashManifest = { version: CACHE_MANIFEST_VERSION, hashes: manifest };
  fs.writeFileSync(
    path.join(cacheDir, HASH_MANIFEST),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

/**
 * Check whether the built output for a presentation still exists in cache.
 * Requires index.html to be present — a non-empty but partial build
 * (e.g. one that crashed mid-write) is not considered a valid cache hit.
 */
export function hasCachedOutput(cacheDir: string, presentationId: string): boolean {
  const outputRoot = path.join(cacheDir, "output");
  const outputDir = path.join(outputRoot, presentationId);
  const rel = path.relative(outputRoot, outputDir);
  // path.isAbsolute() guards against Windows drive-letter paths (e.g. "C:\evil") that
  // path.join() may produce when presentationId is an absolute path on Windows.
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`[Security] Path traversal detected in presentationId: "${presentationId}"`);
  }
  const indexHtml = path.join(outputDir, "index.html");
  if (!fs.existsSync(indexHtml)) return false;
  // A zero-byte index.html indicates a crashed mid-write build — treat as cache miss.
  return fs.statSync(indexHtml).size > 0;
}

/**
 * Create presenter/index.html SPA fallback for each presentation.
 * Static servers need this file to serve /presenter/ routes correctly.
 */
export function createPresenterFallbacks(
  finalOutputDir: string,
  presentations: PresentationMetadata[],
): void {
  for (const p of presentations) {
    const presDir = path.join(finalOutputDir, p.id, "presenter");
    const indexHtml = path.join(finalOutputDir, p.id, "index.html");
    if (fs.existsSync(indexHtml) && !fs.existsSync(path.join(presDir, "index.html"))) {
      fs.mkdirSync(presDir, { recursive: true });
      fs.copyFileSync(indexHtml, path.join(presDir, "index.html"));
    }
  }
}

/**
 * Write a search index JSON so site search plugins (Algolia, local-search)
 * can discover all presentations without crawling the built HTML.
 */
export function writeSearchIndex(
  outDir: string,
  routeDir: string,
  presentations: PresentationMetadata[],
): void {
  const searchIndex = presentations.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    url: p.url,
    tags: p.tags,
    author: p.author,
    owner: p.owner,
    level: p.level,
    duration: p.duration,
    category: p.category || null,
    deprecated: p.deprecated ?? false,
    playlist: p.playlist ?? null,
  }));
  const indexPath = path.join(outDir, routeDir, "presentations-index.json");
  fs.writeFileSync(indexPath, JSON.stringify(searchIndex, null, 2), "utf-8");
  log.info(`Search index written to ${routeDir}/presentations-index.json`);
}

