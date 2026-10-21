import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  BuildContext,
  PluginOptions,
  PresentationMetadata,
} from "../domain/types";
import type { ICache } from "../domain/interfaces";
import { computeFileHash } from "../infrastructure/fs/fileSystem";
import {
  loadHashManifest,
  saveHashManifest,
} from "../infrastructure/fs/hashManifest";
import { hasCachedOutput } from "../infrastructure/fs/outputManager";
import { collectPresentationDependencies } from "../infrastructure/fs/dependencies";
import {
  getInstalledPackageVersion,
  resolveAddonPackageName,
  resolveThemePackageName,
} from "../infrastructure/packages/packageResolver";
import { resolveSlidevCli } from "../infrastructure/process/buildRunner";
import { isLocalPath, stableStringify } from "../shared/utils";

/** Files above this size are fingerprinted by size + mtime instead of content. */
const LARGE_FILE_BYTES = 2 * 1024 * 1024;

function shortHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/**
 * Memoized file fingerprints for one build run — sibling decks share most of
 * their dependencies (components/, public/…), each file is read only once.
 */
export class FileHashMemo {
  private readonly hashes = new Map<string, string>();

  get(filePath: string): string {
    let h = this.hashes.get(filePath);
    if (h === undefined) {
      try {
        const stat = fs.statSync(filePath);
        h =
          stat.size > LARGE_FILE_BYTES
            ? `${stat.size}:${stat.mtimeMs}`
            : computeFileHash(filePath);
      } catch {
        h = "missing";
      }
      this.hashes.set(filePath, h);
    }
    return h;
  }
}

/** Fingerprint of a theme / addon reference: resolved package name + installed version. */
function packageFingerprint(name: string, siteDir: string): string {
  if (isLocalPath(name)) return `${name}@local`;
  return `${name}@${getInstalledPackageVersion(name, siteDir) ?? "missing"}`;
}

/** Inputs of `computePresentationFingerprint` that are constant for a build run. */
export interface FingerprintInputs {
  options: Pick<PluginOptions, "theme" | "addons">;
  context: BuildContext;
  /** Root directory of all slides (plugin `path`), resolved. */
  slidesRoot: string;
  /** Run-wide fingerprint of build options (`BuildCache.computeOptionsFingerprint`). */
  optionsFingerprint: string;
  /** Shared file-hash memo. */
  memo?: FileHashMemo;
}

/**
 * Compute everything — besides the entry `.md` content — that determines the
 * output of one presentation build:
 *   - build options fingerprint (theme/addons defaults, download, notes, baseUrl);
 *   - dependency files (co-located assets and Slidev dirs, `src:` imports,
 *     referenced relative assets) — path AND content;
 *   - resolved versions of `@slidev/cli`, the theme and every addon;
 *   - the effective base URL of the deck (`presentation.url`);
 *   - the presentation metadata AFTER `transformFrontmatter` /
 *     `onPresentationScanned` (theme / addons overrides, withoutNotes…).
 */
export function computePresentationFingerprint(
  presentation: PresentationMetadata,
  inputs: FingerprintInputs,
): string {
  const { options, context, slidesRoot, optionsFingerprint } = inputs;
  const memo = inputs.memo ?? new FileHashMemo();

  const deps = collectPresentationDependencies(
    presentation.sourceAbsolutePath,
    slidesRoot,
  ).map(
    (abs) =>
      `${path.relative(slidesRoot, abs).replace(/\\/g, "/")}=${memo.get(abs)}`,
  );

  const themeRaw = presentation.theme || options.theme;
  const theme = themeRaw
    ? packageFingerprint(
        resolveThemePackageName(themeRaw, context.siteDir),
        context.siteDir,
      )
    : null;
  const addons = [
    ...new Set([...(options.addons ?? []), ...(presentation.addons ?? [])]),
  ]
    .map((a) => packageFingerprint(resolveAddonPackageName(a), context.siteDir))
    .sort();

  // Absolute paths are machine-specific and must not influence the hash.
  const {
    sourceAbsolutePath: _src,
    outputPath: _out,
    ...metadata
  } = presentation;

  return shortHash(
    stableStringify({
      addons,
      cli: resolveSlidevCli(context.siteDir)?.version ?? null,
      deps,
      metadata,
      options: optionsFingerprint,
      theme,
      url: presentation.url,
    }),
  );
}

/**
 * Manages the incremental build cache: hash manifest I/O, staleness checking,
 * and options fingerprinting. Encapsulates the cache state for one build run.
 *
 * Implements `ICache` so it can be substituted by a stub in unit tests without
 * mocking the filesystem.
 */
export class BuildCache implements ICache {
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
    options: Pick<
      PluginOptions,
      | "theme"
      | "addons"
      | "download"
      | "exportFormats"
      | "exportWithClicks"
      | "withoutNotes"
    >,
    baseUrl: string,
  ): string {
    // Sort keys before serialising — JSON.stringify key order is insertion-order
    // and can vary across Node.js versions, producing different hashes for identical
    // option sets and needlessly invalidating the incremental cache.
    return shortHash(
      stableStringify({
        addons: options.addons,
        baseUrl,
        download: options.download,
        exportFormats: options.exportFormats,
        exportWithClicks: options.exportWithClicks,
        theme: options.theme,
        withoutNotes: options.withoutNotes,
      }),
    );
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
