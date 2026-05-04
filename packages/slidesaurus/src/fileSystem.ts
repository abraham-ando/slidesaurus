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
 * Get cache directory within .docusaurus for isolated builds
 */
export function getSlidevCacheDir(siteDir: string, pluginId: string): string {
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

/**
 * Clean up the Slidev cache directory
 */
export function cleanupSlidevCache(cacheDir: string): void {
  if (!fs.existsSync(cacheDir)) return;
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    log.info(`Cleaned Slidev cache: ${log.path(cacheDir)}`);
  } catch {
    log.warn(`Failed to clean Slidev cache`);
  }
}

/**
 * Create an isolated build directory for a single presentation.
 * Copies the .md file and co-located assets to prevent race conditions
 * when building multiple presentations in parallel.
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
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`[Security] Path traversal detected in presentationId: "${presentationId}"`);
  }
  fs.mkdirSync(isolatedDir, { recursive: true });

  // Copy the source .md file, renaming it to the safeId so that when Slidev
  // builds multiple files in one batch command each gets a unique output folder
  // (Slidev names the output folder after the input filename without extension).
  const isolatedSourcePath = path.join(isolatedDir, `${safeId}.md`);
  fs.copyFileSync(sourceAbsolutePath, isolatedSourcePath);

  // Copy co-located non-md assets (images, etc.)
  const sourceDir = path.dirname(sourceAbsolutePath);
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (entry.name.endsWith(".md") || entry.name.startsWith("_category_")) continue;

    const srcPath = path.join(sourceDir, entry.name);
    const destPath = path.join(isolatedDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

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

function copyDirRecursive(src: string, dest: string): void {
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
 * Compute a SHA-256 hash of a file's content.
 */
export function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Load the hash manifest from the cache directory.
 * Returns a map of presentation id → content hash.
 */
export function loadHashManifest(cacheDir: string): Record<string, string> {
  const manifestPath = path.join(cacheDir, HASH_MANIFEST);
  if (!fs.existsSync(manifestPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
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
  fs.writeFileSync(
    path.join(cacheDir, HASH_MANIFEST),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
}

/**
 * Check whether the built output for a presentation still exists in cache.
 * Requires index.html to be present — a non-empty but partial build
 * (e.g. one that crashed mid-write) is not considered a valid cache hit.
 */
export function hasCachedOutput(cacheDir: string, presentationId: string): boolean {
  const outputDir = path.join(cacheDir, "output", presentationId);
  return fs.existsSync(path.join(outputDir, "index.html"));
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

/**
 * Move a built presentation from the batch temp directory to the final cache output path.
 * Creates parent directories as needed; removes the destination first if it already exists.
 */
export function moveBuildOutput(from: string, to: string): void {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
}
