---
sidebar_position: 16
---

# TypeScript Types

All public types exported by `slidesaurus`.

## `ExportFormat`

```ts
type ExportFormat = "pdf" | "pptx";
```

Accepted values for the `exportFormats` option.

---

## `PresentationLevel`

```ts
type PresentationLevel = "beginner" | "intermediate" | "advanced";
```

Difficulty level shown as a color-coded badge on presentation cards.

---

## `SlidevFrontmatter`

Fields parsed from the YAML frontmatter block at the top of each Slidev Markdown file.

```ts
interface SlidevFrontmatter {
  title?: string;
  description?: string;
  theme?: string;
  /** Slidev color scheme. Picked up natively by Slidev during build. */
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
```

---

## `PresentationMetadata`

Internal representation of a discovered presentation, combining frontmatter with computed fields.

```ts
interface PresentationMetadata {
  id: string;
  title: string;
  description?: string;
  theme?: string;
  colorSchema?: "dark" | "light" | "auto";
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
  /** Playlist name(s) this presentation belongs to (normalized to array). */
  playlist?: string[];
  sourcePath: string;
  sourceAbsolutePath: string;
  url: string;
  outputPath: string;
  previewUrl: string;
  devUrl?: string;
  thumbnailUrl?: string;
  /** URLs to pre-generated export files. Only set when options.download is true. */
  exportUrls?: string[];
  category: string;
}
```

---

## `CategoryMetadata`

Metadata for a category directory, parsed from `_category_.yml`.

```ts
interface CategoryMetadata {
  path: string;
  label: string;
  description?: string;
  position: number;
  count: number;
  url: string;
}
```

---

## `PlaylistData`

An ordered sequence of presentations.

```ts
interface PlaylistData {
  /** Normalized slug derived from the playlist title. */
  id: string;
  /** Original playlist name as written in frontmatter. */
  title: string;
  /** Ordered list of presentation IDs. */
  items: string[];
}
```

---

## `ScanResult`

The object returned by the scanner after discovering all presentations.

```ts
interface ScanResult {
  presentations: PresentationMetadata[];
  categories: CategoryMetadata[];
  playlists: PlaylistData[];
}
```

---

## `BuildResult`

The result of a single presentation build.

```ts
interface BuildResult {
  id: string;
  success: boolean;
  error?: string;
  duration?: number;
  /** True when the result was served from the incremental cache (no rebuild occurred). */
  cacheHit?: boolean;
}
```

---

## `BuildContext`

Context passed to the builder, providing the Docusaurus site root and base URL.

```ts
interface BuildContext {
  siteDir: string;
  baseUrl: string;
}
```

---

## `PluginOptions`

Full plugin configuration. Extends `ScanOptions`, `BuildOptions`, and `UIOptions`.

```ts
interface ScanOptions {
  /** Directory containing Slidev .md files, relative to the site root. Default: "./slidev" */
  path: string;
  /** Plugin instance ID. Default: "default" */
  id: string;
}

interface BuildOptions {
  theme?: string;
  addons?: string[];
  buildTimeout: number;
  verbose: boolean;
  maxParallelBuilds: number;
  autoInstall: boolean;
  download: boolean;
  /** Formats to generate when download is enabled. Default: ["pdf"] */
  exportFormats: ExportFormat[];
  dryRun: boolean;
  withoutNotes: boolean;
  exportWithClicks: boolean;
}

interface UIOptions {
  routeBasePath: string;
  pageTitle: string;
  pageTagline: string;
}

interface PluginOptions extends ScanOptions, BuildOptions, UIOptions {
  onPresentationScanned?: (presentation: PresentationMetadata) => void | Promise<void>;
  onBuildComplete?: (results: BuildResult[]) => void | Promise<void>;
  transformFrontmatter?: (data: SlidevFrontmatter, filePath: string) => SlidevFrontmatter;
}
```

---

## `PluginContentData`

The content object passed between `loadContent` and `contentLoaded`.

```ts
interface PluginContentData {
  presentations: PresentationMetadata[];
  categories: CategoryMetadata[];
  playlists: PlaylistData[];
  config: PluginOptions;
  isDev: boolean;
}
```

---

## Theme-facing types

These types are exposed to React theme components via `usePluginData()`. They omit server-only fields (`sourceAbsolutePath`, `outputPath`).

```ts
/** Presentation data exposed to theme components. */
type Presentation = Omit<PresentationMetadata, "sourceAbsolutePath" | "outputPath">;

/** Category data exposed to theme components. */
type Category = CategoryMetadata;

/** Plugin config subset exposed to theme components. */
interface PluginConfig {
  routeBasePath: string;
  path?: string;
  pageTitle?: string;
  pageTagline?: string;
}

/** Global data shape consumed by usePluginData() in theme components. */
interface PluginData {
  presentations: Presentation[];
  categories: Category[];
  playlists: PlaylistData[];
  config: PluginConfig;
  isDev: boolean;
}
```

---

## Usage

```ts
import type {
  PluginOptions,
  PresentationMetadata,
  CategoryMetadata,
  PlaylistData,
  ScanResult,
  BuildResult,
  BuildContext,
  ExportFormat,
  PresentationLevel,
  SlidevFrontmatter,
} from "slidesaurus";
```
