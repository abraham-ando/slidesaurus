import path from "node:path";
import { createRequire } from "node:module";

/**
 * Minimal structural view of the `playwright-chromium` API used by the plugin.
 * Playwright is an OPTIONAL peer of the host site: it is loaded at runtime
 * (never bundled, never a dependency) and typed structurally here.
 */
export interface PlaywrightLocator {
  locator(selector: string): PlaywrightLocator;
  first(): PlaywrightLocator;
  nth(index: number): PlaywrightLocator;
  count(): Promise<number>;
  waitFor(options?: { state?: "attached" | "detached" | "visible" | "hidden"; timeout?: number }): Promise<void>;
  screenshot(options?: { path?: string; timeout?: number }): Promise<unknown>;
  getAttribute(name: string): Promise<string | null>;
  evaluate<R>(fn: (node: HTMLElementLike) => R): Promise<R>;
}

/** The few DOM members the plugin touches inside `evaluate` callbacks. */
export interface HTMLElementLike {
  style: { display: string };
}

export interface PlaywrightFrame {
  waitForLoadState(state?: "load" | "domcontentloaded" | "networkidle"): Promise<void>;
}

/** Subset of Playwright's `page.pdf()` options. Numbers are CSS pixels. */
export interface PlaywrightPdfOptions {
  path?: string;
  width?: number | string;
  height?: number | string;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  printBackground?: boolean;
  preferCSSPageSize?: boolean;
}

export interface PlaywrightPage {
  goto(url: string, options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle"; timeout?: number }): Promise<unknown>;
  emulateMedia(options: { colorScheme?: "light" | "dark"; media?: "screen" | "print" }): Promise<void>;
  locator(selector: string): PlaywrightLocator;
  setDefaultTimeout(timeout: number): void;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  waitForLoadState(state?: "load" | "domcontentloaded" | "networkidle"): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  /** Evaluate a JS expression (string: page code is not type-checked against Node libs). */
  evaluate<R>(expression: string): Promise<R>;
  frames(): PlaywrightFrame[];
  pdf(options?: PlaywrightPdfOptions): Promise<unknown>;
}

export interface PlaywrightBrowserContext {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

export interface PlaywrightBrowser {
  newContext(options?: {
    viewport?: { width: number; height: number };
    deviceScaleFactor?: number;
  }): Promise<PlaywrightBrowserContext>;
  close(): Promise<void>;
}

export interface PlaywrightChromium {
  launch(options?: { headless?: boolean; env?: Record<string, string>; timeout?: number }): Promise<PlaywrightBrowser>;
}

/** Package loaded by `slidev export` — the one users are told to install. */
export const PLAYWRIGHT_PACKAGE = "playwright-chromium";

/**
 * Resolve `playwright-chromium` from the site directory (Node resolution walks
 * up, so a monorepo-hoisted install is found too). Returns `undefined` when the
 * package is not installed.
 */
export function resolvePlaywright(siteDir: string): string | undefined {
  try {
    return createRequire(path.join(siteDir, "package.json")).resolve(PLAYWRIGHT_PACKAGE);
  } catch {
    return undefined;
  }
}

/** Load `playwright-chromium`'s `chromium` launcher, or `undefined` if it is not installed. */
export function loadPlaywrightChromium(siteDir: string): PlaywrightChromium | undefined {
  const resolved = resolvePlaywright(siteDir);
  if (!resolved) return undefined;
  const mod = createRequire(resolved)(resolved) as { chromium?: PlaywrightChromium };
  return mod.chromium;
}
