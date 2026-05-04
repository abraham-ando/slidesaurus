import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import type {
  PresentationMetadata,
  PluginOptions,
  BuildResult,
  BuildContext,
} from "./types";
import { log } from "./logger";
import {
  getSlidevCacheDir,
  createIsolatedBuildDir,
  cleanupIsolatedBuildDir,
} from "./fileSystem";
import { BuildCache } from "./buildCache";
import {
  patchFrontmatterAddons,
  patchFrontmatterTheme,
} from "./frontmatterValidator";
import { generateThumbnail, generateExport } from "./assetGenerator";

import {
  ensureThemeAvailable,
  ensureAddonsAvailable,
} from "./packageResolver";
import { runSlidevBuild } from "./buildRunner";
import { runConcurrently } from "./concurrentRunner";
import { walkUpTree } from "./utils";
import { TREE_WALK_MAX_DEPTH, DEFAULT_MAX_PARALLEL_BUILDS } from "./constants";

// ── Logging ───────────────────────────────────────────────────────────────────

function logBuildSummary(
  total: number,
  built: number,
  successful: number,
  failed: number,
  skippedCount: number,
  totalTime: number,
  sequentialTime: number,
  failedResults: BuildResult[],
): void {
  const speedup = totalTime > 0 && sequentialTime > totalTime
    ? ` (${(sequentialTime / totalTime).toFixed(1)}x faster than sequential ${sequentialTime.toFixed(1)}s)`
    : "";
  const lines = [
    `Slidev build complete — ${total} presentation(s)`,
    `  Built:   ${built}  (${successful} ok, ${failed} failed)`,
    `  Cached:  ${skippedCount}`,
    `  Time:    ${totalTime.toFixed(2)}s${speedup}`,
  ];
  if (failed > 0) {
    log.warn(lines.join("\n"));
    failedResults.forEach((r) => log.error(`  ✗ ${log.code(r.id)}: ${r.error}`));
  } else {
    log.success(lines.join("\n"));
  }
}

// ── Thumbnail artifact cleanup ────────────────────────────────────────────────

/**
 * Slidev v52 creates thumbnail.png/ as a directory (regardless of export success).
 * Fix the artifact for the given presentations:
 *   - directory with 1.png inside → promote to real thumbnail.png file
 *   - empty directory              → remove (no broken <img> served)
 *
 * Caller decides which presentations to scan — typically only those that
 * just rebuilt; cached entries were sanitized on their original build.
 */
function sanitizeThumbnailArtifacts(presentations: PresentationMetadata[]): void {
  for (const p of presentations) {
    const thumbnailFile = path.join(p.outputPath, "thumbnail.png");
    if (!fs.existsSync(thumbnailFile)) continue;
    if (!fs.statSync(thumbnailFile).isDirectory()) continue;

    const innerPng = path.join(thumbnailFile, "1.png");
    if (fs.existsSync(innerPng)) {
      const tmp = `${thumbnailFile}.tmp.png`;
      fs.copyFileSync(innerPng, tmp);
      fs.rmSync(thumbnailFile, { recursive: true, force: true });
      fs.renameSync(tmp, thumbnailFile);
      log.info(`Recovered thumbnail for ${log.code(p.id)}`);
    } else {
      fs.rmSync(thumbnailFile, { recursive: true, force: true });
    }
  }
}

// ── Per-presentation setup ────────────────────────────────────────────────────

interface IsolatedPresentation {
  presentation: PresentationMetadata;
  isolatedSourcePath: string;
  isolatedDir: string;
  safeId: string;
}

/**
 * Prepare one isolated build directory: copy source + assets, patch frontmatter.
 * The isolated file is named {safeId}.md so each presentation has a unique
 * output folder name when Slidev builds multiple files in a single invocation.
 */
async function prepareIsolatedBuild(
  presentation: PresentationMetadata,
  options: PluginOptions,
  context: BuildContext,
  cacheDir: string,
): Promise<IsolatedPresentation> {
  const safeId = presentation.id.replaceAll(/[/\\]/g, "__");

  const isolatedSourcePath = createIsolatedBuildDir(
    presentation.sourceAbsolutePath,
    presentation.id,
    cacheDir,
  );
  const isolatedDir = path.dirname(isolatedSourcePath);

  if (options.verbose) log.info(`Isolated: ${log.path(isolatedDir)}`);

  // Resolve and patch addons (Slidev reads addons from frontmatter, not CLI flags)
  const mergedAddons = [...new Set([...(options.addons ?? []), ...(presentation.addons ?? [])])];
  let resolvedAddons: string[] = [];
  if (mergedAddons.length > 0) {
    resolvedAddons = await ensureAddonsAvailable(mergedAddons, context.siteDir, options.autoInstall);
    patchFrontmatterAddons(isolatedSourcePath, resolvedAddons);
    if (options.verbose) log.info(`Patched addons (${resolvedAddons.length}) in ${log.code(presentation.id)}`);
  }

  // Resolve and patch theme (each file's frontmatter takes precedence over the CLI flag
  // so we write it directly — this enables per-presentation theme overrides in batch mode)
  const themeRaw = presentation.theme || options.theme;
  if (themeRaw) {
    const resolvedTheme = await ensureThemeAvailable(themeRaw, context.siteDir, options.autoInstall);
    patchFrontmatterTheme(isolatedSourcePath, resolvedTheme);
    if (options.verbose && presentation.theme) {
      log.info(`Theme override ${log.code(resolvedTheme)} for ${log.code(presentation.id)}`);
    }
  }

  return { presentation, isolatedSourcePath, isolatedDir, safeId };
}

// ── Parallel builds ───────────────────────────────────────────────────────────

async function buildOne(
  isolated: IsolatedPresentation,
  options: PluginOptions,
  context: BuildContext,
): Promise<BuildResult> {
  const { presentation, isolatedSourcePath } = isolated;
  const startTime = Date.now();
  log.info(`Building ${log.code(presentation.id)} …`);

  const base = `${presentation.url.endsWith("/") ? presentation.url : presentation.url + "/"}`;
  const args = [
    "build", isolatedSourcePath,
    "--out", presentation.outputPath,
    "--base", base,
  ];
  if (options.download) args.push("--download");
  if (presentation.withoutNotes ?? options.withoutNotes) args.push("--without-notes");

  const result = await runSlidevBuild({
    siteDir: context.siteDir,
    args,
    timeoutMs: options.buildTimeout * 1000,
    verbose: options.verbose,
    extraEnv: { SLIDEV_SITE_DIR: context.siteDir },
  });

  const duration = (Date.now() - startTime) / 1000;
  if (result.success) {
    return { id: presentation.id, success: true, duration };
  }
  log.error(`Error building ${log.code(presentation.id)}: ${result.error}`);
  return { id: presentation.id, success: false, error: result.error, duration };
}

async function buildParallel(
  isolated: IsolatedPresentation[],
  options: PluginOptions,
  context: BuildContext,
  concurrency: number,
): Promise<Map<string, BuildResult>> {
  const results = await runConcurrently(isolated, concurrency, (item) =>
    buildOne(item, options, context),
  );
  return new Map(results.map((r) => [r.id, r]));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build all presentations concurrently with a bounded worker pool.
 * Each presentation runs in its own isolated build directory with a
 * per-presentation --base, so concurrency is safe (no shared state, no
 * server port — `slidev build` is a one-shot Rollup compile).
 */
export async function buildAllPresentations(
  presentations: PresentationMetadata[],
  options: PluginOptions,
  context: BuildContext,
): Promise<BuildResult[]> {
  const totalStart = Date.now();
  const total = presentations.length;
  const cpuCount = os.cpus().length;
  const concurrency = Math.max(1, Math.min(options.maxParallelBuilds ?? DEFAULT_MAX_PARALLEL_BUILDS, cpuCount));
  const cacheDir = getSlidevCacheDir(context.siteDir, options.id);

  const cache = new BuildCache(cacheDir);
  const optionsFingerprint = BuildCache.computeOptionsFingerprint(options, context.baseUrl);

  log.info(`Checking ${total} presentation(s) for changes…`);

  // Hash files in parallel — each one is a synchronous sha256 of a small .md
  // but on cold disk caches the I/O dominates; spreading it across workers
  // measurably cuts the "checking" phase on large decks.
  const hashes = await runConcurrently(presentations, concurrency, async (p) =>
    cache.computeHash(p.sourceAbsolutePath, optionsFingerprint),
  );

  const toBuild: PresentationMetadata[] = [];
  const skipped: string[] = [];

  presentations.forEach((p, i) => {
    const hash = hashes[i];
    cache.recordHash(p.id, hash);
    if (cache.isCached(p.id, hash)) {
      skipped.push(p.id);
    } else {
      toBuild.push(p);
    }
  });

  if (skipped.length > 0) {
    log.info(`Skipping ${skipped.length} unchanged presentation(s) (cached)`);
  }

  if (toBuild.length === 0) {
    log.success(`All ${total} presentations are up-to-date — nothing to build!`);
    cache.persist();
    return presentations.map((p) => ({ id: p.id, success: true, duration: 0 }));
  }

  // Each presentation requires its own --base /route/category/id/ so that Vite
  // embeds the correct absolute asset paths. A single batch invocation would
  // share one --base for all files → wrong asset paths → blank slides.
  // Each invocation is isolated (separate CWD, no shared port) so we run up to
  // `concurrency` builds in parallel.
  log.info(`Building ${toBuild.length}/${total} presentation(s) — concurrency: ${concurrency}`);

  // ── Prepare isolated build dirs (frontmatter patching, safeId rename) ──────
  const isolated = await runConcurrently(toBuild, concurrency, (p) =>
    prepareIsolatedBuild(p, options, context, cacheDir),
  );

  // ── Guarantee cleanup even if builds or asset generation throw ────────────
  let buildResults: Map<string, BuildResult> = new Map();
  try {
    // ── Parallel builds with per-presentation --base ─────────────────────────
    buildResults = await buildParallel(isolated, options, context, concurrency);
    for (const [id, result] of buildResults) {
      if (!result.success) cache.invalidate(id);
    }

    // ── Generate thumbnails + exports with the same concurrency budget ────────
    // Without bounding, large decks could spawn dozens of Playwright instances
    // simultaneously and exhaust memory.
    const successful = toBuild.filter((p) => buildResults.get(p.id)?.success);
    const assetTasks: Array<() => Promise<void>> = [];
    for (const p of successful) {
      assetTasks.push(() => generateThumbnail(p, options, context));
      for (const fmt of options.exportFormats ?? []) {
        assetTasks.push(() => generateExport(p, fmt, options, context));
      }
    }
    await runConcurrently(assetTasks, concurrency, (run) => run());

    sanitizeThumbnailArtifacts(successful);
    cache.persist();
    log.info(`Cache manifest updated (${toBuild.length + skipped.length} entries)`);

    const successCount = [...buildResults.values()].filter((r) => r.success).length;
    const failCount = toBuild.length - successCount;
    const totalTime = (Date.now() - totalStart) / 1000;
    const sequentialTime = [...buildResults.values()].reduce((sum, r) => sum + (r.duration ?? 0), 0);

    logBuildSummary(
      total, toBuild.length, successCount, failCount, skipped.length, totalTime, sequentialTime,
      [...buildResults.values()].filter((r) => !r.success),
    );
  } finally {
    // ── Cleanup isolated dirs in parallel ─────────────────────────────────────
    await Promise.all(isolated.map(({ isolatedDir }) =>
      Promise.resolve().then(() => cleanupIsolatedBuildDir(isolatedDir)),
    ));
  }

  // ── Merge with skipped ─────────────────────────────────────────────────────
  const allResults: BuildResult[] = presentations.map((p) => {
    if (skipped.includes(p.id)) return { id: p.id, success: true, duration: 0, cacheHit: true };
    return buildResults.get(p.id) ?? { id: p.id, success: false, error: "Not built" };
  });

  if (options.onBuildComplete) {
    try {
      await options.onBuildComplete(allResults);
    } catch (err) {
      log.error(`onBuildComplete callback threw: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return allResults;
}

/**
 * Check if Slidev CLI is available.
 * Works in pnpm workspaces even without .bin links on Windows.
 */
export function checkSlidevInstalled(siteDir?: string): boolean {
  const found = walkUpTree(siteDir ?? process.cwd(), TREE_WALK_MAX_DEPTH, (dir) => {
    const p = path.join(dir, "node_modules", "@slidev", "cli");
    return fs.existsSync(p) ? true : undefined;
  });
  return found === true;
}
