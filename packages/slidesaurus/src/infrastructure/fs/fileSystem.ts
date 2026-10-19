/**
 * Core filesystem utilities shared across the plugin.
 *
 * Single responsibility: low-level helpers that multiple modules depend on —
 * plugin ID validation, cache directory resolution, source cleanup, and file hashing.
 *
 * Higher-level concerns are split into focused modules:
 *   - `hashManifest.ts`   — build-hashes.json read / write
 *   - `isolatedBuild.ts`  — per-presentation isolated build directories
 *   - `outputManager.ts`  — cache output detection and final-output copying
 *   - `dependencies.ts`   — files a presentation depends on (copy + cache hash)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PLUGIN_NAME } from "../../domain/constants";

export const SLIDEV_CACHE_DIR = PLUGIN_NAME;

/** Artifacts Slidev generates in source/build directories. */
export const SLIDEV_BUILD_ARTIFACTS = ["index.html", ".slidev", "dist"] as const;

/** Allowed characters for plugin ids and locale names used as path segments. */
const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate a pluginId before using it as a filesystem path component.
 * Rejects any value that could enable path traversal (dots, slashes, etc.).
 */
export function validatePluginId(pluginId: string): void {
  if (!SAFE_SEGMENT.test(pluginId)) {
    throw new Error(
      `[Security] Invalid pluginId "${pluginId}": must contain only letters, digits, underscores and dashes.`,
    );
  }
}

/**
 * Resolve the root cache directory for a given plugin instance.
 * Layout:
 *   `{siteDir}/.docusaurus/{PLUGIN_NAME}/{pluginId}/`                  (no locale)
 *   `{siteDir}/.docusaurus/{PLUGIN_NAME}/{pluginId}/i18n/{locale}/`    (per-locale)
 *
 * Each Docusaurus locale has its own `baseUrl` (e.g. `/fr/`), embedded by Vite
 * in every asset URL — so each locale needs its own build output and manifest.
 * Callers pass `locale` only for non-default locales, which keeps the
 * single-locale layout unchanged.
 */
export function getSlidevCacheDir(siteDir: string, pluginId: string, locale?: string): string {
  validatePluginId(pluginId);
  const base = path.join(siteDir, ".docusaurus", SLIDEV_CACHE_DIR, pluginId);
  if (!locale) return base;
  if (!SAFE_SEGMENT.test(locale)) {
    throw new Error(`[Security] Invalid locale "${locale}": must contain only letters, digits, underscores and dashes.`);
  }
  return path.join(base, "i18n", locale);
}

/**
 * Remove artifacts left in the source directory by previous plugin versions.
 *
 * Only the zero-byte `index.html` sentinel the plugin used to write is removed:
 * a non-empty `index.html`, a `dist/` or a `.slidev/` folder may be legitimate
 * user content (custom HTML, Slidev drawings persistence…) and are never deleted.
 * Builds now run in isolated directories, so nothing new is written here.
 */
export function cleanupSourceDirectory(sourcePath: string): void {
  const sentinel = path.join(sourcePath, "index.html");
  try {
    const stat = fs.lstatSync(sentinel);
    if (stat.isFile() && stat.size === 0) fs.rmSync(sentinel, { force: true });
  } catch {
    // absent — nothing to clean
  }
}

/**
 * Compute a SHA-256 hash of a file's content (binary-safe).
 */
export function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}
