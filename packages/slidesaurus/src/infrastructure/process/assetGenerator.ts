import path from "node:path";
import fs from "node:fs";
import { THUMBNAIL_TIMEOUT_CAP_MS, EXPORT_TIMEOUT_CAP_MS, EXPORT_GRACE_MS } from "../../domain/constants";
import type { PresentationMetadata, PluginOptions, BuildOptions, BuildContext } from "../../domain/types";
import type { IAssetPostProcessor } from "../../domain/interfaces";
import { log } from "../../shared/logger";
import { runSlidevBuild } from "./buildRunner";

/**
 * Generate a static PNG thumbnail of the first slide for a presentation.
 * Non-fatal: warns and continues if Playwright or slidev export is unavailable.
 * Returns true if a valid thumbnail exists after the call (or Playwright is unavailable),
 * false if Slidev explicitly failed (caller can invalidate the cache entry).
 */
export async function generateThumbnail(
  presentation: PresentationMetadata,
  options: PluginOptions,
  context: BuildContext,
): Promise<boolean> {
  // Store thumbnail directly in the presentation's output directory so it is
  // picked up by copyBuiltPresentationsToOutput (which copies {cacheDir}/output/**).
  const thumbnailFile = path.join(presentation.outputPath, "thumbnail.png");

  // Slidev v52 may create thumbnail.png/ as a directory (not a file) when the export
  // writes to a sub-path like thumbnail.png/1.png. Clean it up so we can regenerate.
  if (fs.existsSync(thumbnailFile)) {
    const stat = fs.statSync(thumbnailFile);
    if (stat.isFile()) return true; // Already a valid PNG — skip.
    if (stat.isDirectory()) {
      // Check for the slide-1 file Slidev v52 writes inside the directory.
      const innerPng = path.join(thumbnailFile, "1.png");
      if (fs.existsSync(innerPng)) {
        // Promote the inner file to thumbnail.png and remove the directory.
        const tmp = `${thumbnailFile}.tmp.png`;
        fs.copyFileSync(innerPng, tmp);
        fs.rmSync(thumbnailFile, { recursive: true, force: true });
        fs.renameSync(tmp, thumbnailFile);
        return true; // Done — no need to re-export.
      }
      // Empty or unrecognised directory — remove and regenerate.
      fs.rmSync(thumbnailFile, { recursive: true, force: true });
    }
  }

  fs.mkdirSync(path.dirname(thumbnailFile), { recursive: true });

  let exportFailed = false;
  try {
    const timeoutMs = Math.min(options.buildTimeout * 1000, THUMBNAIL_TIMEOUT_CAP_MS);
    const args = [
      "export",
      presentation.sourceAbsolutePath,
      "--format", "png",
      "--range", "1",
      "--output", thumbnailFile,
      // Cap Playwright render timeout to 30 s, but respect the user's buildTimeout.
      "--timeout", String(Math.min(timeoutMs, 30_000)),
    ];

    if (options.verbose) {
      log.info(`Generating thumbnail for ${log.code(presentation.id)}`);
    }

    const result = await runSlidevBuild({ siteDir: context.siteDir, args, timeoutMs, verbose: false, extraEnv: {} });

    if (!result.success) {
      exportFailed = true;
      if (options.verbose) {
        log.warn(`Thumbnail generation failed for ${log.code(presentation.id)}: ${result.error ?? "unknown error"}`);
      }
    }
  } catch {
    // Playwright not available or spawn failed — graceful skip, not a hard failure
    if (options.verbose) {
      log.warn(`Thumbnail generation skipped for ${log.code(presentation.id)} (Playwright not available)`);
    }
    return true; // Non-fatal: don't invalidate cache
  } finally {
    // Slidev v52 creates thumbnail.png/ as a directory regardless of export success.
    // Promote 1.png if present; otherwise remove the empty directory artifact
    // so the cache stays clean and no broken <img> is served.
    if (fs.existsSync(thumbnailFile) && fs.statSync(thumbnailFile).isDirectory()) {
      const innerPng = path.join(thumbnailFile, "1.png");
      if (fs.existsSync(innerPng)) {
        const tmp = `${thumbnailFile}.tmp.png`;
        fs.copyFileSync(innerPng, tmp);
        fs.rmSync(thumbnailFile, { recursive: true, force: true });
        fs.renameSync(tmp, thumbnailFile);
      } else {
        // Empty directory — remove so it doesn't break image loading.
        fs.rmSync(thumbnailFile, { recursive: true, force: true });
      }
    }
  }

  return !exportFailed;
}

/**
 * Generate a PDF/PPTX export of the presentation using `slidev export`.
 * Requires Playwright — non-fatal if unavailable.
 * Returns true if the export file exists after the call (or download is disabled / Playwright unavailable),
 * false if Slidev explicitly failed (caller can invalidate the cache entry).
 * Output: {presentation.outputPath}/export.{fmt} — copied to final output by postBuild.
 */
export async function generateExport(
  presentation: PresentationMetadata,
  fmt: string,
  options: PluginOptions,
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

  try {
    const timeoutMs = Math.min(options.buildTimeout * 1000, EXPORT_TIMEOUT_CAP_MS);
    const args = [
      "export",
      presentation.sourceAbsolutePath,
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
    });

    if (!result.success) {
      if (options.verbose) {
        log.warn(`${fmt.toUpperCase()} export failed for ${log.code(presentation.id)}: ${result.error ?? "unknown error"}`);
      }
      if (fs.existsSync(exportFile)) fs.unlinkSync(exportFile);
      return false;
    }
    // Slidev ignored --output; pick up its default-named file
    if (!fs.existsSync(exportFile) && fs.existsSync(slidevDefaultFile)) {
      fs.renameSync(slidevDefaultFile, exportFile);
    }
    return true;
  } catch {
    // Playwright not available — graceful skip, not a hard failure
    if (options.verbose) {
      log.warn(`${fmt.toUpperCase()} export skipped for ${log.code(presentation.id)} (Playwright not available)`);
    }
    if (fs.existsSync(exportFile)) fs.unlinkSync(exportFile);
    return true; // Non-fatal: don't invalidate cache
  }
}

// ── IAssetPostProcessor implementations ──────────────────────────────────────

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
  ): Promise<boolean> {
    return generateThumbnail(presentation, options as PluginOptions, context);
  }
}

/**
 * Post-processor that generates PDF/PPTX exports for each configured format.
 * Returns false (triggering cache invalidation) if ANY format export fails.
 */
export class ExportGenerator implements IAssetPostProcessor {
  readonly name = "ExportGenerator";

  async process(
    presentation: PresentationMetadata,
    options: BuildOptions,
    context: BuildContext,
  ): Promise<boolean> {
    const pluginOptions = options as PluginOptions;
    if (!pluginOptions.download || !pluginOptions.exportFormats?.length) return true;
    const results = await Promise.all(
      pluginOptions.exportFormats.map((fmt) => generateExport(presentation, fmt, pluginOptions, context)),
    );
    return results.every(Boolean);
  }
}

/** Default post-processors used when none are injected. */
export const DEFAULT_POST_PROCESSORS: IAssetPostProcessor[] = [
  new ThumbnailGenerator(),
  new ExportGenerator(),
];
