/**
 * Core abstractions for the Slidesaurus plugin.
 *
 * These interfaces decouple business logic from concrete implementations,
 * enabling dependency injection, easier testing (no vi.mock required), and
 * extension without modifying existing code (Open/Closed Principle).
 */
import type { BuildOptions, BuildContext, PresentationMetadata, PluginOptions } from "./types";

// ── ILogger ───────────────────────────────────────────────────────────────────

/**
 * Abstraction over the Docusaurus logger.
 * Inject a no-op or spy in tests instead of vi.mock("../logger").
 */
export interface ILogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
  /** Format a file path for display (e.g. with colour in terminals). */
  path(filePath: string): string;
  /** Format an inline code value for display. */
  code(value: string): string;
}

// ── ICache ────────────────────────────────────────────────────────────────────

/**
 * Abstraction over the incremental build cache.
 * `BuildCache` is the production implementation; tests can inject stubs.
 */
export interface ICache {
  /**
   * Returns true when the stored hash matches `hash` AND the output directory
   * contains a non-empty `index.html`.
   */
  isCached(presentationId: string, hash: string): boolean;
  /** Record the hash of a successfully built presentation. */
  recordHash(presentationId: string, hash: string): void;
  /** Remove an entry so it is rebuilt on the next run. */
  invalidate(presentationId: string): void;
  /** Persist all recorded hashes to the manifest on disk. */
  persist(): void;
  /** Combine a file content hash with an options fingerprint into a single cache key. */
  computeHash(sourceAbsolutePath: string, optionsFingerprint: string): string;
}

// ── IAssetPostProcessor ───────────────────────────────────────────────────────

/** Build artifacts handed to asset post-processors by the builder. */
export interface AssetProcessingContext {
  /**
   * Isolated, patched copy of the presentation `.md` (theme / addons injected).
   * Exports must use it instead of `presentation.sourceAbsolutePath` so that
   * the user's source directory is never written to.
   */
  sourcePath: string;
  /** Root of the isolated build directory (removed after post-processing). */
  isolatedDir: string;
}

/**
 * A post-build asset generator (thumbnail screenshot, PDF export, …).
 * Registered via the `postProcessors` parameter of `buildAllPresentations`
 * to extend asset generation without modifying the core build pipeline.
 */
export interface IAssetPostProcessor {
  /** Human-readable name used in log messages and error reporting. */
  readonly name: string;
  /**
   * Process one presentation after a successful build.
   * Returns `true` on success, `false` when the asset could not be produced.
   * Asset failures are NON-blocking: they are reported as warnings on the
   * `BuildResult` and never invalidate the cached HTML build.
   */
  process(
    presentation: PresentationMetadata,
    options: BuildOptions,
    context: BuildContext,
    assets?: AssetProcessingContext,
  ): Promise<boolean>;
  /**
   * Optional one-time setup before the first presentation of a build run is
   * processed (e.g. check that Playwright is installed, launch a shared
   * browser). Must not throw for a missing optional tool: warn instead.
   */
  prepare?(options: BuildOptions, context: BuildContext): Promise<void>;
  /** Optional teardown after the build run (close shared resources). */
  dispose?(): Promise<void>;
}

// ── ICliCommand ───────────────────────────────────────────────────────────────

/**
 * A single Docusaurus CLI command contributed by the plugin.
 * Implement this interface to add custom `slidev:*` commands that are
 * registered alongside the built-ins — without modifying `cliCommands.ts`.
 */
export interface ICliCommand {
  /** Full command name, e.g. `"slidev:list"`. */
  readonly name: string;
  /** One-line description shown in `--help`. */
  readonly description: string;
  /**
   * Execute the command.
   * Called by `registerCliCommands()` when the user invokes the command.
   */
  action(options: PluginOptions, context: BuildContext): Promise<void>;
}
