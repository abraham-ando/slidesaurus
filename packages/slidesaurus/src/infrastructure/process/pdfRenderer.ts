import fs from "node:fs";
import { createRequire } from "node:module";
import yaml from "js-yaml";
import type { PresentationMetadata } from "../../domain/types";
import { resolveSlidevCli } from "./buildRunner";
import type { PlaywrightBrowser, PlaywrightPage } from "./playwright";
import { serveStatic } from "./staticServer";

/**
 * PDF export printed from an ALREADY BUILT presentation by the shared
 * Chromium — the same page (`/print`), waits and `page.pdf()` options as
 * `slidev export`, without compiling the deck again in a Vite dev server.
 */

/** Export settings read from the deck headmatter (`export:`, `colorSchema`, `routerMode`…). */
export interface DeckExportSettings {
  /** One page per click step (`print=clicks`). */
  withClicks: boolean;
  /** Headmatter `export.withClicks` alone — what `slidev build --download` prints. */
  headmatterWithClicks: boolean;
  /** Headmatter `exportFilename` (a plain file name), used by `slidev build --download`. */
  exportFilename?: string;
  dark: boolean;
  routerMode: "history" | "hash";
  /** Extra delay (ms) before printing — headmatter `export.wait`. */
  wait: number;
  /** Options only `slidev export` implements (`export.withToc` / `export.perSlide`). */
  needsSlidevExport: boolean;
  title?: string;
  author?: string;
  info?: string;
  keywords?: string[];
}

/** First frontmatter block (headmatter). */
const HEADMATTER_RE = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Read the export-related settings of a deck from its headmatter. YAML only,
 * never evaluated (a `---js` block is not YAML: defaults apply).
 * The `exportWithClicks` plugin option forces `withClicks`.
 */
export function readDeckExportSettings(sourcePath: string, exportWithClicks: boolean): DeckExportSettings {
  let data: Record<string, unknown> = {};
  try {
    const match = HEADMATTER_RE.exec(fs.readFileSync(sourcePath, "utf-8"));
    const parsed = match ? yaml.load(match[1]) : undefined;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    // Unreadable file / invalid YAML: Slidev's defaults.
  }
  const exp = (data.export && typeof data.export === "object" ? data.export : {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
  const keywords = Array.isArray(data.keywords) ? data.keywords.map(String) : str(data.keywords)?.split(",");
  const exportFilename = str(data.exportFilename);
  return {
    withClicks: exportWithClicks || exp.withClicks === true,
    headmatterWithClicks: exp.withClicks === true,
    exportFilename: exportFilename && /^[\w. -]+$/.test(exportFilename) && !exportFilename.startsWith(".") ? exportFilename : undefined,
    dark: exp.dark === true || data.colorSchema === "dark",
    routerMode: data.routerMode === "hash" ? "hash" : "history",
    wait: typeof exp.wait === "number" && exp.wait > 0 ? exp.wait : 0,
    needsSlidevExport: exp.withToc === true || exp.perSlide === true,
    title: str(data.title),
    author: str(data.author),
    info: str(data.info),
    keywords: keywords?.map((k) => k.trim()).filter(Boolean),
  };
}

/** Viewport before the canvas size is known — the print layout is re-laid out after. */
const INITIAL_VIEWPORT = { width: 1280, height: 720 } as const;

/** Slidev's default canvas (980 px, 16:9) — used if the `@page` rule cannot be read. */
const DEFAULT_CANVAS = { width: 980, height: 552 } as const;

/**
 * Canvas size from the `@page { size: <w>px <h>px }` rule Slidev injects in
 * print mode (`usePrintStyles`). A string: evaluated in the page.
 */
const PAGE_SIZE_EXPRESSION = `(() => {
  for (const el of document.querySelectorAll("style")) {
    const m = /@page\\s*\\{\\s*size:\\s*([\\d.]+)px\\s+([\\d.]+)px/.exec(el.textContent || "");
    if (m) return { width: Number(m[1]), height: Number(m[2]) };
  }
  return null;
})()`;

/** Same readiness checks as `slidev export` (lazy parts, `data-waitfor`, iframes, mermaid, monaco). */
async function waitForSlidesRendered(page: PlaywrightPage): Promise<void> {
  const body = page.locator("body");
  const loading = body.locator(".slidev-slide-loading");
  for (let i = 0, n = await loading.count(); i < n; i++) {
    await loading.nth(i).waitFor({ state: "detached" });
  }
  const waitFors = body.locator("[data-waitfor]");
  for (let i = 0, n = await waitFors.count(); i < n; i++) {
    const element = waitFors.nth(i);
    const selector = await element.getAttribute("data-waitfor");
    if (selector) await element.locator(selector).waitFor({ state: "visible" }).catch(() => undefined);
  }
  await Promise.all(page.frames().map((frame) => frame.waitForLoadState()));
  const mermaid = body.locator("#mermaid-rendering-container");
  if ((await mermaid.count()) > 0) {
    while ((await mermaid.locator("div").first().count()) > 0) {
      await mermaid.locator("div").first().waitFor({ state: "detached" });
    }
    await mermaid.evaluate((node) => (node.style.display = "none"));
  }
  const monaco = body.locator(".monaco-aria-container");
  for (let i = 0, n = await monaco.count(); i < n; i++) {
    await monaco.nth(i).evaluate((node) => (node.style.display = "none"));
  }
}

/**
 * Print the built output of `presentation` to `pdfFile`: one page per slide
 * (per click step with `withClicks`), page size = the deck canvas.
 */
export async function renderPdf(
  browser: PlaywrightBrowser,
  presentation: PresentationMetadata,
  pdfFile: string,
  settings: DeckExportSettings,
  timeoutMs: number,
): Promise<void> {
  const server = await serveStatic(presentation.outputPath, presentation.url);
  // deviceScaleFactor 2 = `slidev export`'s default `scale`.
  const browserContext = await browser.newContext({ viewport: { ...INITIAL_VIEWPORT }, deviceScaleFactor: 2 });
  try {
    const page: PlaywrightPage = await browserContext.newPage();
    page.setDefaultTimeout(timeoutMs);
    const base = presentation.url.endsWith("/") ? presentation.url : `${presentation.url}/`;
    const query = `print=${settings.withClicks ? "clicks" : "true"}`;
    const url =
      settings.routerMode === "hash" ? `${server.origin}${base}?${query}#print` : `${server.origin}${base}print?${query}`;
    await page.goto(url, { waitUntil: "load" });
    await page.emulateMedia({ colorScheme: settings.dark ? "dark" : "light", media: "screen" });
    await page.locator(".print-slide-container").first().waitFor();
    // The print layout scales slides to the window width: use the canvas
    // width (and a viewport as tall as every page), like `slidev export`.
    const size = (await page.evaluate<{ width: number; height: number } | null>(PAGE_SIZE_EXPRESSION)) ?? DEFAULT_CANVAS;
    const pages = await page.locator(".print-slide-container").count();
    await page.setViewportSize({ width: size.width, height: size.height * Math.max(1, pages) });
    await page.waitForLoadState("networkidle");
    await waitForSlidesRendered(page);
    if (settings.wait) await page.waitForTimeout(settings.wait);
    await page.pdf({
      path: pdfFile,
      width: size.width,
      height: size.height,
      margin: { left: 0, top: 0, right: 0, bottom: 0 },
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browserContext.close().catch(() => undefined);
    await server.close();
  }
}

/** Minimal view of `pdf-lib` (a dependency of `@slidev/cli`). */
interface PdfLib {
  PDFDocument: {
    load(bytes: Uint8Array): Promise<{
      setTitle(v: string): void;
      setAuthor(v: string): void;
      setSubject(v: string): void;
      setKeywords(v: string[]): void;
      save(): Promise<Uint8Array>;
    }>;
  };
}

/**
 * Write the document metadata `slidev export` sets (title, author, subject,
 * keywords) with the `pdf-lib` copy shipped with `@slidev/cli`.
 * Best effort: returns false (PDF left as printed) when it is unavailable.
 */
export async function writePdfMetadata(
  pdfFile: string,
  settings: DeckExportSettings,
  fallbackTitle: string,
  siteDir: string,
): Promise<boolean> {
  const cli = resolveSlidevCli(siteDir);
  if (!cli) return false;
  let pdfLib: PdfLib;
  try {
    pdfLib = createRequire(cli.entry)("pdf-lib") as PdfLib;
  } catch {
    return false;
  }
  const pdf = await pdfLib.PDFDocument.load(fs.readFileSync(pdfFile));
  pdf.setTitle(settings.title ?? fallbackTitle);
  if (settings.author) pdf.setAuthor(settings.author);
  if (settings.info) pdf.setSubject(settings.info);
  if (settings.keywords?.length) pdf.setKeywords(settings.keywords);
  fs.writeFileSync(pdfFile, await pdf.save());
  return true;
}
