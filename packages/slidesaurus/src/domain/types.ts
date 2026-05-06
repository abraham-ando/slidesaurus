// ============================================
// Segregated option interfaces (ISP)
// ============================================

/** Options related to scanning and discovering presentations. */
export interface ScanOptions {
  path: string;
  id: string;
}

export type ExportFormat = "pdf" | "pptx";

/** Options related to building presentations. */
export interface BuildOptions {
  theme?: string;
  addons?: string[];
  buildTimeout: number;
  verbose: boolean;
  maxParallelBuilds: number;
  autoInstall: boolean;
  download: boolean;
  /** Formats to generate when download is enabled. Each format adds a download button. Defaults to ["pdf"]. */
  exportFormats: ExportFormat[];
  dryRun: boolean;
  /** Exclude presenter notes from the production bundle. Per-slide frontmatter overrides this. Defaults to false. */
  withoutNotes: boolean;
  /** Generate one PDF page per click animation when exporting. Defaults to false. */
  exportWithClicks: boolean;
}

/** Options related to the Slidev dev server (used during `docusaurus start`). */
export interface DevServerOptions {
  /**
   * Base port for Slidev dev servers. Each presentation gets basePort+index.
   * Useful to avoid collision when multiple plugin instances are configured.
   * Defaults to 8600.
   */
  devServerBasePort: number;
  /**
   * Maximum time (ms) to wait for a Slidev dev server to become ready.
   * Defaults to 60000 (60 s).
   */
  devServerTimeout: number;
}

/**
 * Visual layout variant for plugin UI components.
 *
 * Built-in values: `"default"` | `"compact"` | `"minimal"`.
 *
 * Accepts **any string** — custom values are applied as a
 * `data-slidev-ui-theme` attribute on every component root element,
 * letting you style them via CSS in `custom.css`:
 *
 * ```css
 * [data-slidev-ui-theme="my-brand"] .card { ... }
 * ```
 */
export type UITheme = "default" | "compact" | "minimal" | (string & {});

/** Options related to UI / routing. */
export interface UIOptions {
  routeBasePath: string;
  pageTitle: string;
  pageTagline: string;
  /**
   * Pre-built visual layout variant for all plugin theme components.
   * - `"default"` — full-featured cards with thumbnail previews (default)
   * - `"compact"` — denser cards, reduced padding, no description text
   * - `"minimal"` — text-only rows, no thumbnails, maximum information density
   */
  uiTheme: UITheme;
}

/** Full plugin options — union of all segregated interfaces. */
export interface PluginOptions extends ScanOptions, BuildOptions, UIOptions, DevServerOptions {
  /**
   * Called once per discovered presentation, before any build starts.
   * May return a Promise. Modifications to `presentation` are applied in-place.
   * If this hook throws, the presentation is skipped with a warning (not a fatal error).
   * Invocations are parallelised (bounded by `maxParallelBuilds`).
   * Called after `transformFrontmatter`.
   */
  onPresentationScanned?: (presentation: PresentationMetadata) => void | Promise<void>;
  /**
   * Called once after all builds complete — both successful and failed ones.
   * Errors thrown here are logged but do NOT affect the overall build result
   * or the process exit code.
   */
  onBuildComplete?: (results: BuildResult[]) => void | Promise<void>;
  /**
   * Synchronous transform applied to raw Slidev frontmatter before validation.
   * Must return the (possibly modified) data object. Called before `onPresentationScanned`.
   * The `filePath` parameter receives a relative path only — absolute paths are never exposed.
   */
  transformFrontmatter?: (data: SlidevFrontmatter, filePath: string) => SlidevFrontmatter;
}

export type PresentationLevel = "beginner" | "intermediate" | "advanced";

export interface SlidevFrontmatter {
  title?: string;
  description?: string;
  theme?: string;
  /** Slidev color scheme for this presentation. Picked up natively by Slidev during build. */
  colorSchema?: "dark" | "light" | "auto";
  /** Exclude presenter notes from the build for this presentation only. */
  withoutNotes?: boolean;
  addons?: string[];
  author?: string;
  tags?: string[];
  date?: string;
  position?: number;
  owner?: string;
  level?: PresentationLevel;
  duration?: number;
  lastReviewed?: string;
  deprecated?: boolean;
  playlist?: string | string[];
}

/**
 * Core fields always present immediately after a presentation is scanned.
 * These are the minimum required fields for routing and filesystem operations.
 */
export interface CorePresentationMetadata {
  id: string;
  title: string;
  sourcePath: string;
  sourceAbsolutePath: string;
  url: string;
  outputPath: string;
  previewUrl: string;
  category: string;
}

/**
 * Enriched metadata: adds optional fields read from the Slidev frontmatter.
 * These fields are populated during the scan phase and may be undefined.
 */
export interface EnrichedPresentationMetadata extends CorePresentationMetadata {
  description?: string;
  theme?: string;
  /** Color scheme declared in frontmatter. Exposed to theme components for iframe styling. */
  colorSchema?: "dark" | "light" | "auto";
  /** Whether presenter notes are excluded from the build for this presentation. */
  withoutNotes?: boolean;
  addons?: string[];
  author?: string;
  tags?: string[];
  date?: string;
  position?: number;
  owner?: string;
  level?: PresentationLevel;
  duration?: number;
  lastReviewed?: string;
  deprecated?: boolean;
  /** Playlist name(s) this presentation belongs to. */
  playlist?: string[];
  devUrl?: string;
  thumbnailUrl?: string;
  /** URLs to pre-generated export files (one per format). Only set when options.download is true. */
  exportUrls?: string[];
}

/**
 * Backward-compatible alias — resolves to the most complete metadata shape.
 * Use `CorePresentationMetadata` or `EnrichedPresentationMetadata` directly
 * for narrower typing in new code.
 */
export type PresentationMetadata = EnrichedPresentationMetadata;

/** An ordered sequence of presentations. */
export interface PlaylistData {
  /** Normalized slug derived from the playlist title. */
  id: string;
  /** Original playlist name as written in frontmatter. */
  title: string;
  /** Ordered list of presentation IDs. */
  items: string[];
}

export interface CategoryMetadata {
  path: string;
  label: string;
  description?: string;
  position: number;
  count: number;
  url: string;
}

export interface ScanResult {
  presentations: PresentationMetadata[];
  categories: CategoryMetadata[];
  playlists: PlaylistData[];
}

export interface PluginContentData {
  presentations: PresentationMetadata[];
  categories: CategoryMetadata[];
  playlists: PlaylistData[];
  config: PluginOptions;
  isDev: boolean;
}

export interface BuildResult {
  id: string;
  success: boolean;
  error?: string;
  duration?: number;
  /** True when the result was served from the incremental cache (no rebuild occurred). */
  cacheHit?: boolean;
}

export interface BuildContext {
  siteDir: string;
  baseUrl: string;
}

// ============================================
// Theme-facing type aliases
// These are consumed by React theme components via ../theme/types.ts.
// They expose a subset of the plugin's internal types without
// server-only fields like sourceAbsolutePath or outputPath.
// ============================================

/** Presentation data exposed to theme components (subset of PresentationMetadata). */
export type Presentation = Omit<PresentationMetadata, "sourceAbsolutePath" | "outputPath">;

/** Category data exposed to theme components (alias of CategoryMetadata). */
export type Category = CategoryMetadata;

/** Plugin config subset exposed to theme components. */
export interface PluginConfig {
  routeBasePath: string;
  path?: string;
  pageTitle?: string;
  pageTagline?: string;
  uiTheme: UITheme;
}

/** Global data shape consumed by usePluginData() in theme components. */
export interface PluginData {
  presentations: Presentation[];
  categories: Category[];
  playlists: PlaylistData[];
  config: PluginConfig;
  isDev: boolean;
}
