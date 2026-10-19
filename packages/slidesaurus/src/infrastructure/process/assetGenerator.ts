import path from "node:path";
import fs from "node:fs";
import { THUMBNAIL_TIMEOUT_CAP_MS, EXPORT_TIMEOUT_CAP_MS, EXPORT_GRACE_MS } from "../../domain/constants";
import type { PresentationMetadata, BuildOptions, BuildContext } from "../../domain/types";
import type { IAssetPostProcessor, AssetProcessingContext } from "../../domain/interfaces";
import { log } from "../../shared/logger";
import { normalizeThumbnailArtifact } from "../fs/fsUtils";
import { runSlidevBuild, type RunResult } from "./buildRunner";

/**
 * Asset generation (thumbnail PNG, PDF/PPTX exports) is OPTIONAL: it needs
 * Playwright, which many CI images do not ship. Every failure here is a
 * warning — it never fails nor invalidates the HTML build, otherwise a
 * missing Playwright would trigger a full rebuild on every run.
 */

/** Options consumed by asset generation (subset of BuildOptions). */
export type AssetOptions = Pick<BuildOptions, "buildTimeout" | "verbose" | "download" | "exportFormats" | "exportWithClicks">;

/** Matches the error Slidev prints when `playwright-chromium` is missing. */
const PLAYWRIGHT_MISSING_RE = /playwright/i;

/** True when a failed `slidev export` is due to Playwright not being installed. */
export function isPlaywrightMissing(result: RunResult): boolean {
  return !result.success && result.failureKind === "exit" && PLAYWRIGHT_MISSING_RE.test(result.error ?? "");
}

let playwrightWarned = false;

function warnExportFailure(what: string, presentation: PresentationMetadata, result: RunResult): void {
  if (isPlaywrightMissing(result)) {
    if (!playwrightWarned) {
      playwrightWarned = true;
      log.warn(
        `${what} skipped: Playwright is not installed. Install it with ${log.code("pnpm add -D playwright-chromium")} ` +
          `to enable thumbnails and exports.`,
      );
    }
    return;
  }
  const detail = (result.error ?? "unknown error").split("\n")[0];
  log.warn(`${what} failed for ${log.code(presentation.id)} (non-blocking): ${detail}`);
}

/**
 * Generate a static PNG thumbnail of the first slide for a presentation.
 *
 * @param sourcePath - The ISOLATED, patched `.md` (theme/addons injected). Never
 *   the user's source: Slidev writes temporary files next to its entry.
 * @returns true if a valid thumbnail exists after the call, false otherwise
 *   (the failure has already been logged as a warning).
 */
export async function generateThumbnail(
  presentation: PresentationMetadata,
  sourcePath: string,
  options: AssetOptions,
  context: BuildContext,
): Promise<boolean> {
  // Store thumbnail directly in the presentation's output directory so it is
  // picked up by copyBuiltPresentationsToOutput (which copies {cacheDir}/output/**).
  const thumbnailFile = path.join(presentation.outputPath, "thumbnail.png");

  // A leftover v52 directory artifact is promoted/removed before deciding.
  const state = normalizeThumbnailArtifact(thumbnailFile);
  if (state === "file" || state === "promoted") return true;

  fs.mkdirSync(path.dirname(thumbnailFile), { recursive: true });

  const timeoutMs = Math.min(options.buildTimeout * 1000, THUMBNAIL_TIMEOUT_CAP_MS);
  const args = [
    "export",
    sourcePath,
    "--format", "png",
    "--range", "1",
    "--output", thumbnailFile,
    // Cap Playwright render timeout to 30 s, but respect the user's buildTimeout.
    "--timeout", String(Math.min(timeoutMs, 30_000)),
  ];

  if (options.verbose) {
    log.info(`Generating thumbnail for ${log.code(presentation.id)}`);
  }

  const result = await runSlidevBuild({
    siteDir: context.siteDir,
    args,
    timeoutMs,
    verbose: false,
    extraEnv: {},
    cwd: path.dirname(sourcePath),
  });

  // Slidev v52 creates thumbnail.png/ as a directory regardless of export success.
  const after = normalizeThumbnailArtifact(thumbnailFile);
  if (!result.success) warnExportFailure("Thumbnail generation", presentation, result);
  return after === "file" || after === "promoted";
}

/**
 * Generate a PDF/PPTX export of the presentation using `slidev export`.
 * Output: {presentation.outputPath}/export.{fmt} — copied to final output by postBuild.
 *
 * @param sourcePath - The ISOLATED, patched `.md` (see `generateThumbnail`).
 * @returns true if the export file exists after the call (or download is
 *   disabled), false otherwise (the failure has already been logged as a warning).
 */
export async function generateExport(
  presentation: PresentationMetadata,
  sourcePath: string,
  fmt: string,
  options: AssetOptions,
  context: BuildContext,
): Promise<boolean> {
  if (!options.download) return true; // feature disabled — not a failure

  const exportFile = path.join(presentation.outputPath, `export.${fmt}`);
  if (fs.existsSync(exportFile)) return true;
  // Slidev may ignore --output and use its own default filename — rename on first build
  const slidevDefaultFile = path.join(presentation.outputPath, `slidev-exported.${fmt}`);
  if (fs.existsSync(slidevDefaultFile)) {
    fs.renameSync(slidevDefaultFile, exportFile);
    return true;
  }

  fs.mkdirSync(path.dirname(exportFile), { recursive: true });

  const timeoutMs = Math.min(options.buildTimeout * 1000, EXPORT_TIMEOUT_CAP_MS);
  const args = [
    "export",
    sourcePath,
    "--format", fmt,
    "--output", exportFile,
    "--timeout", String(timeoutMs),
  ];
  // Generate one page per click animation — disabled by default (rétrocompat).
  if (options.exportWithClicks) args.push("--with-clicks");

  if (options.verbose) {
    log.info(`Generating ${fmt.toUpperCase()} export for ${log.code(presentation.id)}`);
  }

  const result = await runSlidevBuild({
    siteDir: context.siteDir,
    args,
    timeoutMs: timeoutMs + EXPORT_GRACE_MS,
    verbose: false,
    extraEnv: {},
    cwd: path.dirname(sourcePath),
  });

  if (!result.success) {
    warnExportFailure(`${fmt.toUpperCase()} export`, presentation, result);
    if (fs.existsSync(exportFile)) fs.rmSync(exportFile, { recursive: true, force: true });
    return false;
  }
  // Slidev ignored --output; pick up its default-named file
  if (!fs.existsSync(exportFile) && fs.existsSync(slidevDefaultFile)) {
    fs.renameSync(slidevDefaultFile, exportFile);
  }
  return fs.existsSync(exportFile);
}

// ── IAssetPostProcessor implementations ──────────────────────────────────────

/** Resolve the source to export: the isolated copy when provided by the builder. */
function exportSource(presentation: PresentationMetadata, assets?: AssetProcessingContext): string | undefined {
  if (assets?.sourcePath) return assets.sourcePath;
  log.warn(`No isolated source for ${log.code(presentation.id)} — asset generation skipped`);
  return undefined;
}

/**
 * Post-processor that generates a PNG thumbnail of the first slide.
 * Implements `IAssetPostProcessor` so it can be injected via the
 * `postProcessors` parameter of `buildAllPresentations` (OCP).
 */
export class ThumbnailGenerator implements IAssetPostProcessor {
  readonly name = "ThumbnailGenerator";

  async process(
    presentation: PresentationMetadata,
    options: BuildOptions,
    context: BuildContext,
    assets?: AssetProcessingContext,
  ): Promise<boolean> {
    const source = exportSource(presentation, assets);
    if (!source) return false;
    return generateThumbnail(presentation, source, options, context);
  }
}

/**
 * Post-processor that generates PDF/PPTX exports for each configured format.
 * Returns false (a non-blocking warning) if ANY format export fails.
 */
export class ExportGenerator implements IAssetPostProcessor {
  readonly name = "ExportGenerator";

  async process(
    presentation: PresentationMetadata,
    options: BuildOptions,
    context: BuildContext,
    assets?: AssetProcessingContext,
  ): Promise<boolean> {
    if (!options.download || !options.exportFormats?.length) return true;
    const source = exportSource(presentation, assets);
    if (!source) return false;
    // Sequential: each export starts a Playwright browser — running them in
    // parallel multiplies memory usage on top of the build concurrency.
    let ok = true;
    for (const fmt of options.exportFormats) {
      ok = (await generateExport(presentation, source, fmt, options, context)) && ok;
    }
    return ok;
  }
}

/** Default post-processors used when none are injected. */
export const DEFAULT_POST_PROCESSORS: IAssetPostProcessor[] = [
  new ThumbnailGenerator(),
  new ExportGenerator(),
];

/** Reset the once-per-process Playwright warning — for tests only. */
export function _resetAssetWarnings(): void {
  playwrightWarned = false;
}
