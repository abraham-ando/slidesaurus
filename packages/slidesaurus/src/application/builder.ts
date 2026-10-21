import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import type {
  PresentationMetadata,
  PluginOptions,
  BuildResult,
  BuildContext,
  BuildProgressListener,
} from "../domain/types";
import type { ICache, IAssetPostProcessor } from "../domain/interfaces";
import { log } from "../shared/logger";
import { getSlidevCacheDir } from "../infrastructure/fs/fileSystem";
import {
  createIsolatedBuild,
  purgeIsolatedBuilds,
  type IsolatedBuildDir,
} from "../infrastructure/fs/isolatedBuild";
import {
  isCompleteBuildOutput,
  purgeStaleOutputs,
} from "../infrastructure/fs/outputManager";
import {
  isInside,
  normalizeThumbnailArtifact,
  removeBestEffort,
  replaceDir,
} from "../infrastructure/fs/fsUtils";
import {
  BuildCache,
  FileHashMemo,
  computePresentationFingerprint,
} from "./buildCache";
import {
  patchFrontmatterAddons,
  patchFrontmatterTheme,
} from "./frontmatterValidator";
import { createDefaultPostProcessors } from "../infrastructure/process/assetGenerator";

import {
  ensureThemeAvailable,
  ensureAddonsAvailable,
} from "../infrastructure/packages/packageResolver";
import {
  resolveSlidevCli,
  runSlidevBuild,
} from "../infrastructure/process/buildRunner";
import {
  findPackageDir,
  prepareIconCollections,
} from "../infrastructure/fs/iconCollections";
import { runConcurrently } from "../shared/concurrentRunner";
import {
  defaultMaxParallelBuilds,
  isLocalPath,
  walkUpTree,
} from "../shared/utils";
import { TREE_WALK_MAX_DEPTH } from "../domain/constants";

// ── Failure aggregation ───────────────────────────────────────────────────────

/**
 * Thrown by `assertBuildSucceeded` when at least one presentation failed to
 * build. Carries every failed `BuildResult` so callers can report them all.
 */
export class PresentationBuildError extends Error {
  readonly failures: BuildResult[];

  constructor(failures: BuildResult[]) {
    const list = failures
      .map((f) => `  - ${f.id}: ${(f.error ?? "unknown error").split("\n")[0]}`)
      .join("\n");
    super(
      `${failures.length} Slidev presentation(s) failed to build:\n${list}`,
    );
    this.name = "PresentationBuildError";
    this.failures = failures;
  }
}

/** Failed results of a build run (asset warnings are NOT failures). */
export function collectBuildFailures(results: BuildResult[]): BuildResult[] {
  return results.filter((r) => !r.success);
}

/**
 * Throw a `PresentationBuildError` if any presentation failed to build.
 * Intended for `docusaurus build`, so a broken deck fails the site build
 * instead of shipping a missing page.
 */
export function assertBuildSucceeded(results: BuildResult[]): void {
  const failures = collectBuildFailures(results);
  if (failures.length > 0) throw new PresentationBuildError(failures);
}

// ── Logging ───────────────────────────────────────────────────────────────────

function logBuildSummary(
  total: number,
  built: number,
  results: BuildResult[],
  skippedCount: number,
  totalTime: number,
): void {
  const failedResults = collectBuildFailures(results);
  const successful = built - failedResults.length;
  const warned = results.filter((r) => r.warnings?.length);
  const sequentialTime = results.reduce((sum, r) => sum + (r.duration ?? 0), 0);
  const speedup =
    totalTime > 0 && sequentialTime > totalTime
      ? ` (${(sequentialTime / totalTime).toFixed(1)}x faster than sequential ${sequentialTime.toFixed(1)}s)`
      : "";
  const lines = [
    `Slidev build complete — ${total} presentation(s)`,
    `  Built:   ${built}  (${successful} ok, ${failedResults.length} failed)`,
    `  Cached:  ${skippedCount}`,
    `  Time:    ${totalTime.toFixed(2)}s${speedup}`,
  ];
  if (warned.length > 0)
    lines.push(`  Asset warnings: ${warned.length} presentation(s)`);
  if (failedResults.length > 0) {
    log.warn(lines.join("\n"));
    failedResults.forEach((r) =>
      log.error(`  ✗ ${log.code(r.id)}: ${r.error}`),
    );
  } else {
    log.success(lines.join("\n"));
  }
}

// ── Per-presentation pipeline ─────────────────────────────────────────────────

/**
 * Resolve theme / addons and write them into the isolated copy of the deck.
 * The values come from the presentation metadata (i.e. AFTER the
 * `transformFrontmatter` / `onPresentationScanned` hooks) merged with the
 * global options.
 */
async function patchIsolatedSource(
  isolatedSourcePath: string,
  presentation: PresentationMetadata,
  options: PluginOptions,
  context: BuildContext,
): Promise<{ theme?: string; addons: string[] }> {
  // Slidev reads addons from frontmatter, not CLI flags
  const mergedAddons = [
    ...new Set([...(options.addons ?? []), ...(presentation.addons ?? [])]),
  ];
  let resolvedAddons: string[] = [];
  let resolvedTheme: string | undefined;
  if (mergedAddons.length > 0) {
    resolvedAddons = await ensureAddonsAvailable(
      mergedAddons,
      context.siteDir,
      options.autoInstall,
    );
    patchFrontmatterAddons(isolatedSourcePath, resolvedAddons);
    if (options.verbose)
      log.info(
        `Patched addons (${resolvedAddons.length}) in ${log.code(presentation.id)}`,
      );
  }

  // Each file's theme takes precedence over the global option, so it is
  // written directly — this enables per-presentation theme overrides.
  const themeRaw = presentation.theme || options.theme;
  if (themeRaw) {
    resolvedTheme = await ensureThemeAvailable(
      themeRaw,
      context.siteDir,
      options.autoInstall,
    );
    patchFrontmatterTheme(
      isolatedSourcePath,
      resolvedTheme,
      Boolean(presentation.theme),
    );
    if (options.verbose && presentation.theme) {
      log.info(
        `Theme override ${log.code(resolvedTheme)} for ${log.code(presentation.id)}`,
      );
    }
  }
  return { theme: resolvedTheme, addons: resolvedAddons };
}

/**
 * Make the Iconify collections cheap to resolve for this deck (see
 * `iconCollections.ts`). Skipped — Slidev then resolves as usual — when a
 * Slidev root (client, theme, an addon) cannot be located.
 */
function speedUpIconResolution(
  isolatedDir: string,
  resolved: { theme?: string; addons: string[] },
  context: BuildContext,
  verbose: boolean,
  id: string,
): void {
  const cli = resolveSlidevCli(context.siteDir);
  const clientDir = cli
    ? findPackageDir(path.dirname(cli.entry), "@slidev/client")
    : undefined;
  if (!clientDir) return;
  const packageDirs: string[] = [];
  for (const name of [
    resolved.theme ?? "@slidev/theme-default",
    ...resolved.addons,
  ]) {
    const dir = isLocalPath(name)
      ? path.resolve(context.siteDir, name)
      : findPackageDir(context.siteDir, name);
    if (!dir || !fs.existsSync(dir)) return;
    packageDirs.push(dir);
  }
  const { linked, stubbed } = prepareIconCollections(isolatedDir, {
    siteDir: context.siteDir,
    packageDirs,
    clientDir,
  });
  if (verbose && (linked.length || stubbed.length)) {
    log.info(
      `Icon collections for ${log.code(id)}: linked [${linked.join(", ")}], empty [${stubbed.join(", ")}]`,
    );
  }
}

/** Run the post-build asset processors. Failures are collected as warnings. */
async function runPostProcessors(
  presentation: PresentationMetadata,
  isolated: IsolatedBuildDir,
  processors: IAssetPostProcessor[],
  options: PluginOptions,
  context: BuildContext,
): Promise<string[]> {
  const warnings: string[] = [];
  for (const processor of processors) {
    try {
      const ok = await processor.process(presentation, options, context, {
        sourcePath: isolated.isolatedSourcePath,
        isolatedDir: isolated.isolatedDir,
      });
      if (!ok) warnings.push(`${processor.name}: asset not generated`);
    } catch (err) {
      const msg = `${processor.name} threw: ${err instanceof Error ? err.message : String(err)}`;
      log.warn(`${msg} (${log.code(presentation.id)}, non-blocking)`);
      warnings.push(msg);
    }
  }
  // Slidev v52 may leave thumbnail.png/ as a directory — normalise it.
  normalizeThumbnailArtifact(
    path.join(presentation.outputPath, "thumbnail.png"),
  );
  return warnings;
}

/** Run a processor's optional `prepare` / `dispose` hook — failures are non-blocking warnings. */
async function callLifecycle(
  processor: IAssetPostProcessor,
  hook: "prepare" | "dispose",
  fn: () => Promise<void> | undefined,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    log.warn(
      `${processor.name}.${hook} threw (non-blocking): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

interface BuildEnv {
  options: PluginOptions;
  context: BuildContext;
  cacheDir: string;
  outputRoot: string;
  slidesRoot: string;
  processors: IAssetPostProcessor[];
  listener?: BuildProgressListener;
}

/** Call a listener callback — a throwing listener never breaks a build. */
function notify(fn: (() => void) | undefined): void {
  try {
    fn?.();
  } catch (err) {
    log.warn(
      `Build progress listener threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Build one presentation end to end:
 * isolate → patch → `slidev build` into a temporary dir → atomically replace
 * the cached output → post-process assets → clean up.
 *
 * Never throws: any error (bad frontmatter, missing theme, Slidev failure…)
 * is returned as a failed `BuildResult` so other presentations still build.
 * On failure the previous output (if any) is left untouched.
 */
async function buildPresentation(
  presentation: PresentationMetadata,
  env: BuildEnv,
): Promise<BuildResult> {
  const { options, context, cacheDir, outputRoot, slidesRoot, processors } =
    env;
  const startTime = Date.now();
  const elapsed = (): number => (Date.now() - startTime) / 1000;
  // Phase durations, logged with `verbose` (where does a build spend its time?).
  const phases: string[] = [];
  let phaseStart = startTime;
  const phase = (name: string): void => {
    const now = Date.now();
    phases.push(`${name} ${((now - phaseStart) / 1000).toFixed(1)}s`);
    phaseStart = now;
  };
  let isolated: IsolatedBuildDir | undefined;
  let tmpOut: string | undefined;

  try {
    // outputPath is replaced (rm -rf) below — it must stay inside the cache.
    const outputPath = path.resolve(presentation.outputPath);
    if (
      !isInside(outputRoot, outputPath) ||
      outputPath === path.resolve(outputRoot)
    ) {
      throw new Error(
        `[Security] outputPath "${presentation.outputPath}" is outside the plugin cache`,
      );
    }

    isolated = createIsolatedBuild(
      presentation.sourceAbsolutePath,
      presentation.id,
      cacheDir,
      slidesRoot,
    );
    if (options.verbose)
      log.info(`Isolated: ${log.path(isolated.isolatedDir)}`);
    const resolved = await patchIsolatedSource(
      isolated.isolatedSourcePath,
      presentation,
      options,
      context,
    );
    speedUpIconResolution(
      isolated.isolatedDir,
      resolved,
      context,
      options.verbose,
      presentation.id,
    );
    phase("isolate+patch");

    // `safeId` never contains a dot, so `{safeId}.out` cannot clash with another isolated dir.
    tmpOut = path.join(cacheDir, "builds", `${isolated.safeId}.out`);
    fs.rmSync(tmpOut, { recursive: true, force: true });

    log.info(`Building ${log.code(presentation.id)} …`);
    const base = presentation.url.endsWith("/")
      ? presentation.url
      : `${presentation.url}/`;
    const args = [
      "build",
      isolated.isolatedSourcePath,
      "--out",
      tmpOut,
      "--base",
      base,
    ];
    // Enables the deck's download button and `/print` route; Slidev then
    // prints `slidev-exported.pdf` itself from the built output.
    if (options.download) args.push("--download");
    if (presentation.withoutNotes ?? options.withoutNotes)
      args.push("--without-notes");

    const result = await runSlidevBuild({
      siteDir: context.siteDir,
      args,
      timeoutMs: options.buildTimeout * 1000,
      verbose: options.verbose,
      extraEnv: { SLIDEV_SITE_DIR: context.siteDir },
    });
    if (!result.success) {
      log.error(`Error building ${log.code(presentation.id)}: ${result.error}`);
      return {
        id: presentation.id,
        success: false,
        error: result.error,
        duration: elapsed(),
      };
    }
    if (!isCompleteBuildOutput(tmpOut)) {
      const error = "Slidev reported success but produced no index.html";
      log.error(`Error building ${log.code(presentation.id)}: ${error}`);
      return {
        id: presentation.id,
        success: false,
        error,
        duration: elapsed(),
      };
    }
    phase("slidev build");
    replaceDir(tmpOut, outputPath);
    phase("replace output");
    notify(() => env.listener?.onOutputReady?.(presentation.id));

    const warnings = await runPostProcessors(
      presentation,
      isolated,
      processors,
      options,
      context,
    );
    phase("assets");
    if (options.verbose)
      log.info(`Timings ${log.code(presentation.id)}: ${phases.join(", ")}`);
    return {
      id: presentation.id,
      success: true,
      duration: elapsed(),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error(`Error building ${log.code(presentation.id)}: ${error}`);
    return { id: presentation.id, success: false, error, duration: elapsed() };
  } finally {
    for (const leftover of [isolated?.isolatedDir, tmpOut]) {
      const error = leftover ? removeBestEffort(leftover) : undefined;
      if (error)
        log.warn(`Could not clean up ${log.path(leftover!)}: ${error}`);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build all presentations concurrently with a bounded worker pool.
 * Each presentation runs in its own isolated build directory with a
 * per-presentation --base, so concurrency is safe (no shared state, no
 * server port — `slidev build` is a one-shot Rollup compile).
 *
 * Never throws for a single failing presentation: inspect the returned
 * results (or call `assertBuildSucceeded`) to fail the site build.
 */
export async function buildAllPresentations(
  presentations: PresentationMetadata[],
  options: PluginOptions,
  context: BuildContext,
  /** Optional cache implementation — defaults to `BuildCache`. Inject a stub in tests. */
  injectedCache?: ICache,
  /**
   * Post-build asset processors (thumbnails, exports…).
   * Defaults to `createDefaultPostProcessors()` (ThumbnailGenerator + ExportGenerator).
   * Inject an empty array `[]` to skip all asset generation in tests.
   * Add custom processors to extend without modifying this file (OCP).
   */
  postProcessors?: IAssetPostProcessor[],
  /** Progress callbacks (dev build status). */
  listener?: BuildProgressListener,
): Promise<BuildResult[]> {
  const totalStart = Date.now();
  const total = presentations.length;
  const cpuCount = os.cpus().length;
  const concurrency = Math.max(
    1,
    Math.min(options.maxParallelBuilds ?? defaultMaxParallelBuilds(), cpuCount),
  );
  const cacheDir = getSlidevCacheDir(
    context.siteDir,
    options.id,
    context.locale,
  );
  const outputRoot = path.join(cacheDir, "output");
  const slidesRoot = path.resolve(context.siteDir, options.path);

  const cache: ICache = injectedCache ?? new BuildCache(cacheDir);
  const optionsFingerprint = BuildCache.computeOptionsFingerprint(
    options,
    context.baseUrl,
  );
  const memo = new FileHashMemo();

  log.info(`Checking ${total} presentation(s) for changes…`);

  // A hashing failure (file deleted since the scan…) must not abort the run:
  // the presentation is simply rebuilt — and its build reports the real error.
  const hashes = await runConcurrently(
    presentations,
    concurrency,
    async (p) => {
      try {
        const fingerprint = computePresentationFingerprint(p, {
          options,
          context,
          slidesRoot,
          optionsFingerprint,
          memo,
        });
        return cache.computeHash(p.sourceAbsolutePath, fingerprint);
      } catch {
        return undefined;
      }
    },
  );

  const toBuild: PresentationMetadata[] = [];
  const skipped = new Set<string>();

  presentations.forEach((p, i) => {
    const hash = hashes[i];
    if (hash === undefined) {
      toBuild.push(p);
      return;
    }
    cache.recordHash(p.id, hash);
    if (cache.isCached(p.id, hash)) {
      skipped.add(p.id);
    } else {
      toBuild.push(p);
    }
  });

  if (skipped.size > 0) {
    log.info(`Skipping ${skipped.size} unchanged presentation(s) (cached)`);
  }

  // Leftovers of a crashed / killed run are never reused.
  purgeIsolatedBuilds(cacheDir);

  let buildResults = new Map<string, BuildResult>();
  if (toBuild.length > 0) {
    // Each presentation requires its own --base /route/category/id/ so that Vite
    // embeds the correct absolute asset paths. Each invocation is isolated
    // (separate dir, no shared port) so up to `concurrency` builds run in parallel.
    log.info(
      `Building ${toBuild.length}/${total} presentation(s) — concurrency: ${concurrency}`,
    );
    const processors = postProcessors ?? createDefaultPostProcessors();
    const env: BuildEnv = {
      options,
      context,
      cacheDir,
      outputRoot,
      slidesRoot,
      processors,
      listener,
    };
    // One-time checks / shared resources (Playwright browser) BEFORE the builds.
    await Promise.all(
      processors.map((p) =>
        callLifecycle(p, "prepare", () => p.prepare?.(options, context)),
      ),
    );
    let completed = 0;
    let results: BuildResult[];
    try {
      results = await runConcurrently(toBuild, concurrency, async (p) => {
        notify(() => listener?.onBuildStart?.(p.id));
        const result = await buildPresentation(p, env);
        notify(() => listener?.onResult?.(result));
        // Increment AFTER build completes so the counter reflects finished presentations.
        process.stdout.write(
          `\r  Built [${++completed}/${toBuild.length}] ${p.id}${result.success ? " ✓" : " ✗"}\x1b[K`,
        );
        return result;
      });
    } finally {
      await Promise.all(
        processors.map((p) => callLifecycle(p, "dispose", () => p.dispose?.())),
      );
    }
    process.stdout.write("\n");
    buildResults = new Map(results.map((r) => [r.id, r]));
    for (const r of results) {
      if (!r.success) cache.invalidate(r.id);
    }
  } else {
    log.success(
      `All ${total} presentations are up-to-date — nothing to build!`,
    );
  }

  // Outputs of deleted / renamed decks and partial builds are never published.
  purgeStaleOutputs(
    outputRoot,
    presentations.map((p) => p.id),
  );
  cache.persist();

  if (toBuild.length > 0) {
    logBuildSummary(
      total,
      toBuild.length,
      [...buildResults.values()],
      skipped.size,
      (Date.now() - totalStart) / 1000,
    );
  }

  const allResults: BuildResult[] = presentations.map((p) => {
    if (skipped.has(p.id))
      return { id: p.id, success: true, duration: 0, cacheHit: true };
    return (
      buildResults.get(p.id) ?? { id: p.id, success: false, error: "Not built" }
    );
  });
  for (const r of allResults) {
    if (!buildResults.has(r.id)) notify(() => listener?.onResult?.(r));
  }

  if (options.onBuildComplete) {
    try {
      await options.onBuildComplete(allResults);
    } catch (err) {
      log.error(
        `onBuildComplete callback threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return allResults;
}

// ── Background builds (`docusaurus start`) ────────────────────────────────────

/**
 * Serialises background build runs of ONE cache directory.
 *
 * `docusaurus start` must not wait for Slidev: `loadContent` schedules a run
 * and returns at once. Runs never overlap (they share `builds/`, `output/`
 * and the hash manifest): a run requested while another is in progress is
 * queued, and only the LATEST request is kept — a burst of file saves
 * triggers at most one extra run.
 */
export class BackgroundBuildQueue {
  private next: (() => Promise<unknown>) | undefined;
  private running: Promise<void> | undefined;

  /** Queue `run` (replacing any queued, not yet started run). */
  schedule(run: () => Promise<unknown>): void {
    this.next = run;
    this.running ??= this.drain();
  }

  /** Resolves when no run is in progress or queued. */
  whenIdle(): Promise<void> {
    return this.running ?? Promise.resolve();
  }

  private async drain(): Promise<void> {
    try {
      while (this.next) {
        const run = this.next;
        this.next = undefined;
        try {
          await run();
        } catch (err) {
          log.error(
            `Background Slidev build failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } finally {
      this.running = undefined;
    }
  }
}

const backgroundQueues = new Map<string, BackgroundBuildQueue>();

/**
 * The queue of a cache directory — shared by every plugin object created for
 * it, so a site reload (new plugin instance) never builds concurrently with
 * a run started by the previous instance.
 */
export function getBackgroundBuildQueue(
  cacheDir: string,
): BackgroundBuildQueue {
  const key = path.resolve(cacheDir);
  let queue = backgroundQueues.get(key);
  if (!queue) {
    queue = new BackgroundBuildQueue();
    backgroundQueues.set(key, queue);
  }
  return queue;
}

/**
 * Check if Slidev CLI is available.
 * Works in pnpm workspaces even without .bin links on Windows.
 */
export function checkSlidevInstalled(siteDir?: string): boolean {
  const found = walkUpTree(
    siteDir ?? process.cwd(),
    TREE_WALK_MAX_DEPTH,
    (dir) => {
      const p = path.join(dir, "node_modules", "@slidev", "cli");
      return fs.existsSync(p) ? true : undefined;
    },
  );
  return found === true;
}
