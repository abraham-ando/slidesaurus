/**
 * Core abstractions for the Slidesaurus plugin.
 *
 * These interfaces decouple business logic from concrete implementations,
 * enabling dependency injection, easier testing (no vi.mock required), and
 * extension without modifying existing code (Open/Closed Principle).
 */
import type { BuildOptions, BuildContext, PresentationMetadata, SlidevFrontmatter, PluginOptions } from "./types";

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

// ── IBuildEngine ──────────────────────────────────────────────────────────────

/**
 * Abstraction over the build tool (Slidev CLI by default).
 * Implement this interface to plug in an alternative engine (Marp, Reveal.js…)
 * without touching `builder.ts`.
 */
export interface IBuildEngine {
  build(
    sourcePath: string,
    outputPath: string,
    options: BuildOptions,
    context: BuildContext,
  ): Promise<{ success: boolean; error?: string; duration?: number }>;
}

// ── IAssetPostProcessor ───────────────────────────────────────────────────────

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
   * Returns `true` on success, `false` on failure (cache is invalidated on failure).
   */
  process(
    presentation: PresentationMetadata,
    options: BuildOptions,
    context: BuildContext,
  ): Promise<boolean>;
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

// ── IFrontmatterRule ──────────────────────────────────────────────────────────

/**
 * A single validation/transformation rule for Slidev frontmatter.
 * Rules are applied in sequence during the scan phase.
 * Implement this interface to add custom frontmatter validation without
 * modifying `FrontmatterValidator`.
 */
export interface IFrontmatterRule {
  /** Unique identifier used in error messages. */
  readonly name: string;
  /**
   * Validate or transform the frontmatter.
   * Must return the (possibly modified) frontmatter object.
   * Use `logger.warn()` for non-fatal issues; throw only for fatal errors.
   */
  validate(
    frontmatter: SlidevFrontmatter,
    filePath: string,
    logger: ILogger,
  ): SlidevFrontmatter;
}
