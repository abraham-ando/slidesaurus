/**
 * Versioned hash manifest — persists incremental build hashes between runs.
 *
 * Single responsibility: read and write the `build-hashes.json` file.
 * Version field guards against silently using stale data after a format change.
 */
import fs from "node:fs";
import path from "node:path";
import { log } from "../../shared/logger";

const HASH_MANIFEST = "build-hashes.json";

/**
 * Increment when the manifest format changes in a backward-incompatible way.
 * Old manifests are then treated as missing → full rebuild rather than stale data.
 */
const CACHE_MANIFEST_VERSION = 2;

interface HashManifest {
  version: number;
  hashes: Record<string, string>;
}

/**
 * Load the hash manifest from the cache directory.
 * Returns a map of presentationId → hash.
 * Returns {} (rebuild all) when the manifest is absent, malformed, or on a
 * different version — prevents silently using data from an incompatible format.
 */
export function loadHashManifest(cacheDir: string): Record<string, string> {
  const manifestPath = path.join(cacheDir, HASH_MANIFEST);
  if (!fs.existsSync(manifestPath)) return {};
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    if (
      typeof raw !== "object" ||
      raw === null ||
      (raw as Record<string, unknown>).version !== CACHE_MANIFEST_VERSION
    ) {
      log.info("Cache manifest version mismatch — rebuilding all presentations");
      return {};
    }
    return (raw as HashManifest).hashes ?? {};
  } catch {
    log.warn("Failed to read build hash manifest, rebuilding all");
    return {};
  }
}

/**
 * Save the hash manifest to the cache directory, creating it if absent.
 */
export function saveHashManifest(cacheDir: string, manifest: Record<string, string>): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  const data: HashManifest = { version: CACHE_MANIFEST_VERSION, hashes: manifest };
  fs.writeFileSync(
    path.join(cacheDir, HASH_MANIFEST),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}
