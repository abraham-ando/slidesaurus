import crypto from "node:crypto";
import type { PluginOptions } from "./types";
import {
  loadHashManifest,
  saveHashManifest,
  hasCachedOutput,
  computeFileHash,
} from "./fileSystem";

/**
 * Manages the incremental build cache: hash manifest I/O, staleness checking,
 * and options fingerprinting. Encapsulates the cache state for one build run.
 */
export class BuildCache {
  private readonly cacheDir: string;
  private readonly oldHashes: Record<string, string>;
  private readonly newHashes: Record<string, string> = {};

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.oldHashes = loadHashManifest(cacheDir);
  }

  /**
   * Compute a short fingerprint that captures all build-affecting options.
   * Any change to theme, addons, download/export config, withoutNotes, or
   * baseUrl invalidates cached output.
   *
   * `baseUrl` is included because Vite embeds it into every asset URL at
   * build time — a base change produces a functionally different build even
   * when the source file is unchanged.
   */
  static computeOptionsFingerprint(
    options: Pick<PluginOptions, "theme" | "addons" | "download" | "exportFormats" | "exportWithClicks" | "withoutNotes">,
    baseUrl: string,
  ): string {
    // Sort keys before serialising — JSON.stringify key order is insertion-order
    // and can vary across Node.js versions, producing different hashes for identical
    // option sets and needlessly invalidating the incremental cache.
    const raw: Record<string, unknown> = {
      addons: options.addons,
      baseUrl,
      download: options.download,
      exportFormats: options.exportFormats,
      exportWithClicks: options.exportWithClicks,
      theme: options.theme,
      withoutNotes: options.withoutNotes,
    };
    const sorted = Object.fromEntries(Object.entries(raw).sort(([a], [b]) => a.localeCompare(b)));
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(sorted))
      .digest("hex")
      .slice(0, 16);
  }

  /** Combine the file content hash with the options fingerprint into a single cache key. */
  computeHash(sourceAbsolutePath: string, optionsFingerprint: string): string {
    return `${computeFileHash(sourceAbsolutePath)}:${optionsFingerprint}`;
  }

  /**
   * True if the stored hash matches and the built output directory exists.
   * Returns false (not throws) for invalid presentationIds — the security
   * exception from hasCachedOutput is treated as a cache miss so the build
   * pipeline continues normally with a fresh build.
   */
  isCached(presentationId: string, hash: string): boolean {
    if (this.oldHashes[presentationId] !== hash) return false;
    try {
      return hasCachedOutput(this.cacheDir, presentationId);
    } catch {
      return false;
    }
  }

  /** Register the hash for a successfully built (or up-to-date) presentation. */
  recordHash(presentationId: string, hash: string): void {
    this.newHashes[presentationId] = hash;
  }

  /** Remove the hash for a failed build so it is retried next time. */
  invalidate(presentationId: string): void {
    delete this.newHashes[presentationId];
  }

  /** Persist the new hash manifest to disk. Call once after all builds complete. */
  persist(): void {
    saveHashManifest(this.cacheDir, this.newHashes);
  }
}
