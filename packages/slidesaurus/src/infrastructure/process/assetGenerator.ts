import path from "node:path";
import fs from "node:fs";
import { THUMBNAIL_TIMEOUT_CAP_MS, EXPORT_TIMEOUT_CAP_MS, EXPORT_GRACE_MS } from "../../domain/constants";
import type { PresentationMetadata, BuildOptions, BuildContext } from "../../domain/types";
import type { IAssetPostProcessor, AssetProcessingContext } from "../../domain/interfaces";
import { log } from "../../shared/logger";
import { hardLinkOrCopy, normalizeThumbnailArtifact } from "../fs/fsUtils";
import { filterEnvAllowlist } from "../packages/env";
import { runSlidevBuild, type RunResult } from "./buildRunner";
import {
  PLAYWRIGHT_PACKAGE,
  loadPlaywrightChromium,
  resolvePlaywright,
  type PlaywrightBrowser,
  type PlaywrightChromium,
  type PlaywrightPage,
} from "./playwright";
import { serveStatic } from "./staticServer";
import { readDeckExportSettings, renderPdf, writePdfMetadata, type DeckExportSettings } from "./pdfRenderer";

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

const INSTALL_PLAYWRIGHT_HINT = `pnpm add -D ${PLAYWRIGHT_PACKAGE}`;
const INSTALL_CHROMIUM_HINT = `pnpm exec playwright install chromium`;

/** True when a failed `slidev export` is due to Playwright not being installed. */
export function isPlaywrightMissing(result: RunResult): boolean {
  return !result.success && result.failureKind === "exit" && PLAYWRIGHT_MISSING_RE.test(result.error ?? "");
}

let playwrightWarned = false;

/** Warn (once per process) that Playwright / Chromium is unavailable. */
function warnPlaywrightUnavailable(message: string): void {
  if (playwrightWarned) return;
  playwrightWarned = true;
  log.warn(message);
}

function warnExportFailure(what: string, presentation: PresentationMetadata, result: RunResult): void {
  if (isPlaywrightMissing(result)) {
    warnPlaywrightUnavailable(
      `${what} skipped: Playwright is not installed. Install it with ${log.code(INSTALL_PLAYWRIGHT_HINT)} ` +
        `to enable thumbnails and exports.`,
    );
    return;
  }
  const detail = (result.error ?? "unknown error").split("\n")[0];
  log.warn(`${what} failed for ${log.code(presentation.id)} (non-blocking): ${detail}`);
}

// ── Thumbnails ───────────────────────────────────────────────────────────────

/** Viewport used to render the first slide (16:9; the slide is letterboxed otherwise). */
export const THUMBNAIL_VIEWPORT = { width: 1280, height: 720 } as const;

/**
 * Screenshot the first slide of an ALREADY BUILT presentation.
 *
 * The built output (`presentation.outputPath`) is served under its `--base`
 * on a loopback port and rendered by the shared browser — much faster than
 * `slidev export`, which compiles the deck again in a Vite dev server.
 * Mirrors the readiness checks of `slidev export` (slide mounted, lazy
 * components loaded, iframes loaded).
 */
export async function renderThumbnail(
  browser: PlaywrightBrowser,
  presentation: PresentationMetadata,
  thumbnailFile: string,
  timeoutMs: number,
): Promise<void> {
  const server = await serveStatic(presentation.outputPath, presentation.url);
  const browserContext = await browser.newContext({ viewport: { ...THUMBNAIL_VIEWPORT }, deviceScaleFactor: 1 });
  try {
    const page: PlaywrightPage = await browserContext.newPage();
    page.setDefaultTimeout(timeoutMs);
    const base = presentation.url.endsWith("/") ? presentation.url : `${presentation.url}/`;
    await page.goto(`${server.origin}${base}1?print=true&range=1`, { waitUntil: "load" });
    await page.emulateMedia({ colorScheme: "light", media: "screen" });
    const slide = page.locator('[data-slidev-no="1"]');
    await slide.waitFor();
    const loading = slide.locator(".slidev-slide-loading");
    for (let i = 0, n = await loading.count(); i < n; i++) {
      await loading.nth(i).waitFor({ state: "detached" });
    }
    await page.locator("#slide-content").first().screenshot({ path: thumbnailFile });
  } finally {
    await browserContext.close().catch(() => undefined);
    await server.close();
  }
}

// ── Shared browser ───────────────────────────────────────────────────────────

/**
 * One headless Chromium per build run, shared by the thumbnail and PDF
 * processors. Launched lazily on first use; Playwright / Chromium are checked
 * ONCE — when unavailable, `get()` resolves `undefined` and a single warning
 * says what to install. `close()` is idempotent.
 */
export class SharedBrowser {
  private browser: Promise<PlaywrightBrowser | undefined> | undefined;

  constructor(private readonly loadChromium: (siteDir: string) => PlaywrightChromium | undefined = loadPlaywrightChromium) {}

  get(siteDir: string): Promise<PlaywrightBrowser | undefined> {
    this.browser ??= this.launch(siteDir);
    return this.browser;
  }

  private async launch(siteDir: string): Promise<PlaywrightBrowser | undefined> {
    let chromium: PlaywrightChromium | undefined;
    try {
      chromium = this.loadChromium(siteDir);
    } catch (err) {
      log.warn(`Could not load ${PLAYWRIGHT_PACKAGE}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!chromium) {
      warnPlaywrightUnavailable(
        `Thumbnails and PDF exports skipped: ${PLAYWRIGHT_PACKAGE} is not installed. ` +
          `Install it with ${log.code(INSTALL_PLAYWRIGHT_HINT)} then ${log.code(INSTALL_CHROMIUM_HINT)}.`,
      );
      return undefined;
    }
    try {
      return await chromium.launch({ headless: true, env: filterEnvAllowlist(process.env), timeout: THUMBNAIL_TIMEOUT_CAP_MS });
    } catch (err) {
      const detail = (err instanceof Error ? err.message : String(err)).split("\n")[0];
      warnPlaywrightUnavailable(
        `Thumbnails and PDF exports skipped: Chromium for Playwright could not be started (${detail}). ` +
          `Install it with ${log.code(INSTALL_CHROMIUM_HINT)}.`,
      );
      return undefined;
    }
  }

  async close(): Promise<void> {
    const browser = await this.browser;
    this.browser = undefined;
    await browser?.close().catch(() => undefined);
  }
}

/** Injection points of `ThumbnailGenerator` — for tests. */
export interface ThumbnailGeneratorDeps {
  loadChromium?: (siteDir: string) => PlaywrightChromium | undefined;
  render?: typeof renderThumbnail;
  /** Browser shared with other processors (see `createDefaultPostProcessors`). */
  browser?: SharedBrowser;
}

/**
 * Post-processor that generates a PNG thumbnail of the first slide.
 * Implements `IAssetPostProcessor` so it can be injected via the
 * `postProcessors` parameter of `buildAllPresentations` (OCP).
 *
 * `prepare` checks Playwright + Chromium ONCE and launches a single browser
 * shared by every presentation of the run; when unavailable, all thumbnails
 * are skipped with one warning saying what to install. `dispose` closes it.
 */
export class ThumbnailGenerator implements IAssetPostProcessor {
  readonly name = "ThumbnailGenerator";
  private readonly browser: SharedBrowser;
  private readonly render: typeof renderThumbnail;

  constructor(deps: ThumbnailGeneratorDeps = {}) {
    this.browser = deps.browser ?? new SharedBrowser(deps.loadChromium);
    this.render = deps.render ?? renderThumbnail;
  }

  async prepare(_options: BuildOptions, context: BuildContext): Promise<void> {
    await this.browser.get(context.siteDir);
  }

  async process(
    presentation: PresentationMetadata,
    options: BuildOptions,
    context: BuildContext,
  ): Promise<boolean> {
    // Store thumbnail directly in the presentation's output directory so it is
    // picked up by copyBuiltPresentationsToOutput (which copies {cacheDir}/output/**).
    const thumbnailFile = path.join(presentation.outputPath, "thumbnail.png");
    // A leftover v52 directory artifact is promoted/removed before deciding.
    const state = normalizeThumbnailArtifact(thumbnailFile);
    if (state === "file" || state === "promoted") return true;

    const browser = await this.browser.get(context.siteDir);
    if (!browser) return false; // already reported once

    if (options.verbose) log.info(`Generating thumbnail for ${log.code(presentation.id)}`);
    const timeoutMs = Math.min(options.buildTimeout * 1000, THUMBNAIL_TIMEOUT_CAP_MS);
    const tmpFile = `${thumbnailFile}.tmp.png`;
    try {
      await this.render(browser, presentation, tmpFile, timeoutMs);
      fs.renameSync(tmpFile, thumbnailFile);
      return true;
    } catch (err) {
      const detail = (err instanceof Error ? err.message : String(err)).split("\n")[0];
      log.warn(`Thumbnail generation failed for ${log.code(presentation.id)} (non-blocking): ${detail}`);
      return false;
    } finally {
      fs.rmSync(tmpFile, { force: true });
    }
  }

  async dispose(): Promise<void> {
    await this.browser.close();
  }
}

// ── PDF / PPTX exports ───────────────────────────────────────────────────────

/** Injection points of `generateExport` / `ExportGenerator` — for tests. */
export interface ExportDeps {
  /** Shared browser: when set, PDFs are printed from the built output. */
  browser?: SharedBrowser;
  renderPdf?: typeof renderPdf;
}

/**
 * Print the PDF from the built output with the shared browser.
 * @returns true when written, false on failure (already logged as a warning).
 */
async function exportPdfFromOutput(
  browser: PlaywrightBrowser,
  presentation: PresentationMetadata,
  exportFile: string,
  settings: DeckExportSettings,
  timeoutMs: number,
  context: BuildContext,
  render: typeof renderPdf,
): Promise<boolean> {
  const tmpFile = `${exportFile}.tmp.pdf`;
  try {
    await render(browser, presentation, tmpFile, settings, timeoutMs);
    await writePdfMetadata(tmpFile, settings, presentation.title, context.siteDir).catch(() => false);
    fs.renameSync(tmpFile, exportFile);
    return true;
  } catch (err) {
    const detail = (err instanceof Error ? err.message : String(err)).split("\n")[0];
    log.warn(`PDF export failed for ${log.code(presentation.id)} (non-blocking): ${detail}`);
    return false;
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
}

/**
 * The PDF `slidev build --download` printed itself (from the built output,
 * headmatter `export.*` settings), if usable as `export.pdf`: it exists and
 * matches the requested clicks mode (`slidev build` ignores `exportWithClicks`).
 */
function builtInPdf(outputPath: string, settings: DeckExportSettings): string | undefined {
  if (settings.withClicks !== settings.headmatterWithClicks) return undefined;
  const file = path.join(outputPath, `${settings.exportFilename ?? "slidev-exported"}.pdf`);
  return fs.existsSync(file) ? file : undefined;
}

/**
 * Generate a PDF/PPTX export of the presentation.
 * Output: {presentation.outputPath}/export.{fmt} — copied to final output by postBuild.
 *
 * - **PDF**: `slidev build --download` already printed the deck from its
 *   built output (`slidev-exported.pdf`, or `<exportFilename>.pdf`) — it is
 *   linked as `export.pdf`, and kept for the deck's own download button.
 *   When it is missing or lacks the requested click steps
 *   (`exportWithClicks`), the shared browser (`deps.browser`) prints the
 *   built output (`renderPdf`) — no Vite dev server. `slidev export` remains
 *   the fallback without a browser, or for `export.withToc` / `export.perSlide`.
 * - **PPTX**: always `slidev export` (it rasterises every click step).
 *
 * @param sourcePath - The ISOLATED, patched `.md` (theme/addons injected). Never
 *   the user's source: Slidev writes temporary files next to its entry.
 * @returns true if the export file exists after the call (or download is
 *   disabled), false otherwise (the failure has already been logged as a warning).
 */
export async function generateExport(
  presentation: PresentationMetadata,
  sourcePath: string,
  fmt: string,
  options: AssetOptions,
  context: BuildContext,
  deps: ExportDeps = {},
): Promise<boolean> {
  if (!options.download) return true; // feature disabled — not a failure

  const exportFile = path.join(presentation.outputPath, `export.${fmt}`);
  if (fs.existsSync(exportFile)) return true;
  const settings = readDeckExportSettings(sourcePath, options.exportWithClicks);
  // Slidev may ignore --output and use its own default filename.
  const slidevDefaultFile = path.join(presentation.outputPath, `slidev-exported.${fmt}`);
  if (fmt === "pdf") {
    const builtIn = builtInPdf(presentation.outputPath, settings);
    if (builtIn) {
      // Linked, not renamed: the deck's download button points to the original.
      hardLinkOrCopy(builtIn, exportFile);
      return true;
    }
  } else if (fs.existsSync(slidevDefaultFile)) {
    fs.renameSync(slidevDefaultFile, exportFile);
    return true;
  }

  fs.mkdirSync(path.dirname(exportFile), { recursive: true });

  const timeoutMs = Math.min(options.buildTimeout * 1000, EXPORT_TIMEOUT_CAP_MS);

  if (fmt === "pdf" && deps.browser) {
    if (!settings.needsSlidevExport) {
      const browser = await deps.browser.get(context.siteDir);
      if (!browser) return false; // already reported once
      if (options.verbose) log.info(`Generating PDF export for ${log.code(presentation.id)} (from the built output)`);
      return exportPdfFromOutput(browser, presentation, exportFile, settings, timeoutMs, context, deps.renderPdf ?? renderPdf);
    }
  }

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
    if (fmt === "pdf") hardLinkOrCopy(slidevDefaultFile, exportFile);
    else fs.renameSync(slidevDefaultFile, exportFile);
  }
  return fs.existsSync(exportFile);
}

/**
 * Post-processor that generates PDF/PPTX exports for each configured format.
 * Returns false (a non-blocking warning) if ANY format export fails.
 *
 * `prepare` checks once that `playwright-chromium` is resolvable: without it
 * every export would fail, so all exports are skipped with one warning.
 * With a shared browser (`createDefaultPostProcessors`), PDFs are printed
 * from the built output instead of running `slidev export`.
 */
export class ExportGenerator implements IAssetPostProcessor {
  readonly name = "ExportGenerator";
  private playwrightAvailable: boolean | undefined;
  private readonly resolve: (siteDir: string) => string | undefined;
  private readonly deps: ExportDeps;

  /** @param deps - Injection points, or (legacy signature) the Playwright resolver alone. */
  constructor(deps: ExportGeneratorDeps | ((siteDir: string) => string | undefined) = {}) {
    const d = typeof deps === "function" ? { resolve: deps } : deps;
    this.resolve = d.resolve ?? resolvePlaywright;
    this.deps = { browser: d.browser, renderPdf: d.renderPdf };
  }

  async prepare(options: BuildOptions, context: BuildContext): Promise<void> {
    if (!options.download || !options.exportFormats?.length || this.playwrightAvailable !== undefined) return;
    this.playwrightAvailable = this.resolve(context.siteDir) !== undefined;
    if (!this.playwrightAvailable) {
      warnPlaywrightUnavailable(
        `PDF/PPTX exports skipped: ${PLAYWRIGHT_PACKAGE} is not installed. ` +
          `Install it with ${log.code(INSTALL_PLAYWRIGHT_HINT)} then ${log.code(INSTALL_CHROMIUM_HINT)}.`,
      );
    }
  }

  async process(
    presentation: PresentationMetadata,
    options: BuildOptions,
    context: BuildContext,
    assets?: AssetProcessingContext,
  ): Promise<boolean> {
    if (!options.download || !options.exportFormats?.length) return true;
    await this.prepare(options, context);
    if (!this.playwrightAvailable) return false; // already reported once by prepare()
    if (!assets?.sourcePath) {
      log.warn(`No isolated source for ${log.code(presentation.id)} — export skipped`);
      return false;
    }
    // Sequential: a `slidev export` (PPTX) starts its own browser — running
    // them in parallel multiplies memory usage on top of the build concurrency.
    let ok = true;
    for (const fmt of options.exportFormats) {
      ok = (await generateExport(presentation, assets.sourcePath, fmt, options, context, this.deps)) && ok;
    }
    return ok;
  }

  async dispose(): Promise<void> {
    await this.deps.browser?.close();
  }
}

/** Injection points of `ExportGenerator`. */
export interface ExportGeneratorDeps extends ExportDeps {
  /** Resolves `playwright-chromium` (default: from the site directory). */
  resolve?: (siteDir: string) => string | undefined;
}

/**
 * Default post-processors used when none are injected. A fresh set per build
 * run, sharing ONE browser (thumbnails + PDF) that `dispose()` closes — two
 * plugin instances building concurrently must not share one.
 */
export function createDefaultPostProcessors(): IAssetPostProcessor[] {
  const browser = new SharedBrowser();
  return [new ThumbnailGenerator({ browser }), new ExportGenerator({ browser })];
}

/** Reset the once-per-process Playwright warning — for tests only. */
export function _resetAssetWarnings(): void {
  playwrightWarned = false;
}
