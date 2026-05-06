/**
 * Build output management.
 *
 * Single responsibility: everything related to the per-presentation output
 * directory under `.docusaurus/slidesaurus/{id}/output/`:
 * cache hit detection, copying to final site output, presenter fallbacks,
 * and search index generation.
 */
import fs from "node:fs";
import path from "node:path";
import { log } from "../../shared/logger";
import { getSlidevCacheDir } from "./fileSystem";
import type { PresentationMetadata } from "../../domain/types";

// ── Internal helpers ──────────────────────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the root of the Slidev build output for a given plugin instance.
 * Each presentation is a sub-directory: `{outputDir}/{presentationId}/`.
 */
export function getSlidevBuildOutputDir(siteDir: string, pluginId: string): string {
  return path.join(getSlidevCacheDir(siteDir, pluginId), "output");
}

/**
 * Check whether the built output for a presentation still exists in cache.
 * Requires a non-empty `index.html` — a partial build (crashed mid-write) is
 * not considered a valid cache hit.
 *
 * @throws `[Security]` error for absolute-path or traversal presentationIds.
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
  return fs.statSync(indexHtml).size > 0;
}

/**
 * Copy all built presentations from the plugin cache to the final Docusaurus
 * output directory so they are included in the static site.
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

/**
 * Create `presenter/index.html` SPA fallbacks for each presentation.
 * Static servers need this file to serve `/presenter/` sub-routes correctly.
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
 * Write a `presentations-index.json` so site search plugins (Algolia,
 * local-search) can discover all presentations without crawling the HTML.
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
