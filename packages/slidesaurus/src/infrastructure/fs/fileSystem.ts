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
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PLUGIN_NAME } from "../../domain/constants";

export const SLIDEV_CACHE_DIR = PLUGIN_NAME;

/** Artifacts Slidev generates in source/build directories. */
export const SLIDEV_BUILD_ARTIFACTS = ["index.html", ".slidev", "dist"] as const;

/**
 * Validate a pluginId before using it as a filesystem path component.
 * Rejects any value that could enable path traversal (dots, slashes, etc.).
 */
export function validatePluginId(pluginId: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(pluginId)) {
    throw new Error(
      `[Security] Invalid pluginId "${pluginId}": must contain only letters, digits, underscores and dashes.`,
    );
  }
}

/**
 * Resolve the root cache directory for a given plugin instance.
 * Layout: `{siteDir}/.docusaurus/{PLUGIN_NAME}/{pluginId}/`
 */
export function getSlidevCacheDir(siteDir: string, pluginId: string): string {
  validatePluginId(pluginId);
  return path.join(siteDir, ".docusaurus", SLIDEV_CACHE_DIR, pluginId);
}

/**
 * Remove Slidev-generated artifacts from the source directory.
 * Prevents stale dist/ or .slidev/ from being committed alongside the sources.
 */
export function cleanupSourceDirectory(sourcePath: string): void {
  if (!fs.existsSync(sourcePath)) return;
  for (const name of SLIDEV_BUILD_ARTIFACTS) {
    const fullPath = path.join(sourcePath, name);
    if (fs.existsSync(fullPath)) fs.rmSync(fullPath, { recursive: true, force: true });
  }
}

/**
 * Compute a SHA-256 hash of a file's content (binary-safe).
 */
export function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}
