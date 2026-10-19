/**
 * Isolated build directory management.
 *
 * Single responsibility: create and clean up the per-presentation temporary
 * directory that Slidev builds in, ensuring each build is fully independent
 * with no shared state across parallel builds.
 *
 * Layout — the slides tree is mirrored below the isolated root so that
 * relative references such as `../shared/logo.png` keep resolving:
 *
 *   builds/{safeId}/                         ← isolated root (removed after build)
 *     {relative dir of the deck}/{safeId}.md ← patched copy of the entry
 *     {relative dir of the deck}/…           ← co-located assets
 *     shared/logo.png                        ← `../shared/logo.png` dependency
 */
import fs from "node:fs";
import path from "node:path";
import { toSafeId } from "../../shared/utils";
import { collectPresentationDependencies } from "./dependencies";
import { hardLinkOrCopy, isInside } from "./fsUtils";

/**
 * Files Slidev may (re)write at the root of its entry directory. They are
 * always COPIED, never hard-linked: writing through a hard link would
 * silently modify the user's source file.
 */
const NEVER_LINK = new Set(["index.html"]);

/** Paths of a freshly created isolated build directory. */
export interface IsolatedBuildDir {
  /** Unique, injective filesystem-safe id (see `toSafeId`). */
  safeId: string;
  /** Root of the isolated tree — remove it to clean everything up. */
  isolatedDir: string;
  /** Patched copy of the presentation entry `.md`. */
  isolatedSourcePath: string;
}

/**
 * Create an isolated build directory for a single presentation.
 * Orchestrates: path-traversal guard → fresh directory → copy source file →
 * dependencies (co-located assets, `src:` imports, relative assets) mirrored
 * relative to `slidesRoot` → dummy index.html sentinel.
 *
 * @param slidesRoot - Root of all slides (plugin `path`). Relative references
 *   may climb up to this directory but never above. Defaults to the deck's directory.
 */
export function createIsolatedBuild(
  sourceAbsolutePath: string,
  presentationId: string,
  cacheDir: string,
  slidesRoot?: string,
): IsolatedBuildDir {
  const safeId = toSafeId(presentationId);
  const buildsRoot = path.resolve(cacheDir, "builds");
  const isolatedDir = path.resolve(buildsRoot, safeId);
  if (!isInside(buildsRoot, isolatedDir) || isolatedDir === buildsRoot) {
    throw new Error(`[Security] Path traversal detected in presentationId: "${presentationId}"`);
  }
  // Start from a clean directory — leftovers of a crashed run must not leak in.
  fs.rmSync(isolatedDir, { recursive: true, force: true });
  fs.mkdirSync(isolatedDir, { recursive: true });

  const entry = path.resolve(sourceAbsolutePath);
  const sourceDir = path.dirname(entry);
  const root = slidesRoot && isInside(path.resolve(slidesRoot), entry) ? path.resolve(slidesRoot) : sourceDir;
  const mirror = (abs: string): string => path.join(isolatedDir, path.relative(root, abs));

  const isolatedEntryDir = mirror(sourceDir);
  fs.mkdirSync(isolatedEntryDir, { recursive: true });
  // The entry is copied (never linked): frontmatter patching writes to it.
  const isolatedSourcePath = path.join(isolatedEntryDir, `${safeId}.md`);
  fs.copyFileSync(entry, isolatedSourcePath);

  for (const dep of collectPresentationDependencies(entry, root)) {
    const dest = mirror(dep);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) continue;
    if (NEVER_LINK.has(path.basename(dep))) fs.copyFileSync(dep, dest);
    else hardLinkOrCopy(dep, dest);
  }

  // Create a dummy index.html to prevent Slidev CLI ENOENT when it tries to unlink it.
  const indexHtml = path.join(isolatedEntryDir, "index.html");
  if (!fs.existsSync(indexHtml)) fs.writeFileSync(indexHtml, "", "utf-8");

  return { safeId, isolatedDir, isolatedSourcePath };
}

/**
 * Backward-compatible wrapper around `createIsolatedBuild`.
 * @returns The absolute path to the isolated copy of the source `.md` file.
 */
export function createIsolatedBuildDir(
  sourceAbsolutePath: string,
  presentationId: string,
  cacheDir: string,
  slidesRoot?: string,
): string {
  return createIsolatedBuild(sourceAbsolutePath, presentationId, cacheDir, slidesRoot).isolatedSourcePath;
}

/**
 * Remove an isolated build directory entirely (sources, copied assets and
 * Slidev artifacts). Safe to call on a non-existent directory.
 */
export function cleanupIsolatedBuildDir(isolatedDir: string): void {
  fs.rmSync(isolatedDir, { recursive: true, force: true });
}

/**
 * Remove every leftover isolated directory under `{cacheDir}/builds/`
 * (e.g. after a crash or a killed process). Call before starting a build run.
 */
export function purgeIsolatedBuilds(cacheDir: string): void {
  fs.rmSync(path.join(cacheDir, "builds"), { recursive: true, force: true });
}
