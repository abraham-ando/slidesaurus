/**
 * Build output management.
 *
 * Single responsibility: everything related to the per-presentation output
 * directory under `.docusaurus/slidesaurus/{id}/output/`:
 * cache hit detection, orphan purge, copying to final site output, presenter
 * fallbacks, and search index generation.
 */
import fs from "node:fs";
import path from "node:path";
import { log } from "../../shared/logger";
import { getSlidevCacheDir } from "./fileSystem";
import { copyDirRecursive } from "./fsUtils";
import type { PresentationMetadata } from "../../domain/types";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the root of the Slidev build output for a given plugin instance.
 * Each presentation is a sub-directory: `{outputDir}/{presentationId}/`.
 * `locale` selects the per-locale cache (see `getSlidevCacheDir`).
 */
export function getSlidevBuildOutputDir(siteDir: string, pluginId: string, locale?: string): string {
  return path.join(getSlidevCacheDir(siteDir, pluginId, locale), "output");
}

/** True when `dir/index.html` exists and is not empty (complete build). */
export function isCompleteBuildOutput(dir: string): boolean {
  const indexHtml = path.join(dir, "index.html");
  try {
    return fs.statSync(indexHtml).isFile() && fs.statSync(indexHtml).size > 0;
  } catch {
    return false;
  }
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
  return isCompleteBuildOutput(outputDir);
}

/**
 * Remove everything under `outputRoot` that does not belong to a current,
 * complete presentation build:
 *   - directories of presentations that no longer exist (renamed / deleted decks);
 *   - presentation directories without a non-empty `index.html` (partial builds);
 *   - stray files at category level.
 *
 * Directories that are ancestors of a current presentation (categories) are
 * kept and recursed into. Returns the relative paths removed.
 */
export function purgeStaleOutputs(outputRoot: string, presentationIds: Iterable<string>): string[] {
  const ids = new Set([...presentationIds].map((id) => id.replace(/\\/g, "/")));
  const ancestors = new Set<string>();
  for (const id of ids) {
    const parts = id.split("/");
    for (let i = 1; i < parts.length; i++) ancestors.add(parts.slice(0, i).join("/"));
  }
  const removed: string[] = [];
  if (!fs.existsSync(outputRoot)) return removed;

  const walk = (dir: string, rel: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        if (ids.has(childRel)) {
          if (!isCompleteBuildOutput(full)) {
            fs.rmSync(full, { recursive: true, force: true });
            removed.push(childRel);
          }
          continue;
        }
        if (ancestors.has(childRel)) {
          walk(full, childRel);
          continue;
        }
      }
      // Orphan presentation dir, stray file, or symlink.
      fs.rmSync(full, { recursive: true, force: true });
      removed.push(childRel);
    }
  };
  walk(outputRoot, "");
  if (removed.length > 0) {
    log.info(`Removed ${removed.length} stale output entr${removed.length > 1 ? "ies" : "y"} from the cache`);
  }
  return removed;
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
