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
}

export interface PlaywrightPage {
  goto(url: string, options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle"; timeout?: number }): Promise<unknown>;
  emulateMedia(options: { colorScheme?: "light" | "dark"; media?: "screen" | "print" }): Promise<void>;
  locator(selector: string): PlaywrightLocator;
  setDefaultTimeout(timeout: number): void;
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
