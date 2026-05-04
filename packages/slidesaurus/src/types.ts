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

/** Options related to UI / routing. */
export interface UIOptions {
  routeBasePath: string;
  pageTitle: string;
  pageTagline: string;
}

/** Options related to dev server. */
/** Full plugin options — union of all segregated interfaces. */
export interface PluginOptions extends ScanOptions, BuildOptions, UIOptions {
  /** Hook called after each presentation is scanned. Can modify metadata in-place. */
  onPresentationScanned?: (presentation: PresentationMetadata) => void | Promise<void>;
  /** Hook called after all builds complete. Receives the full results array. */
  onBuildComplete?: (results: BuildResult[]) => void | Promise<void>;
  /** Hook called to transform frontmatter before processing. Return modified data. */
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

export interface PresentationMetadata {
  id: string;
  title: string;
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
  sourcePath: string;
  sourceAbsolutePath: string;
  url: string;
  outputPath: string;
  previewUrl: string;
  devUrl?: string;
  thumbnailUrl?: string;
  /** URLs to pre-generated export files (one per format). Only set when options.download is true. */
  exportUrls?: string[];
  category: string;
}

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
}

/** Global data shape consumed by usePluginData() in theme components. */
export interface PluginData {
  presentations: Presentation[];
  categories: Category[];
  playlists: PlaylistData[];
  config: PluginConfig;
  isDev: boolean;
}
