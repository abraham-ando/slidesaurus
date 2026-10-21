---
sidebar_position: 16
---

# TypeScript Types

All public types exported by `slidesaurus`.

## `UITheme`

```ts
type UITheme = "default" | "compact" | "minimal" | (string & {});
```

Visual layout variant for plugin components. Set via the `uiTheme` plugin option.

- `"default"` — full card with preview area, description, and all metadata badges.
- `"compact"` — same DOM as `default`, CSS-only variant with a smaller preview and no description.
- `"minimal"` — text-only rows; different DOM structure, no thumbnails, no sidebar.
- Any other string — passed through as the `data-slidev-ui-theme` attribute on component roots; target it from `custom.css`.

---

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

Representation of a discovered presentation, combining frontmatter with computed fields. It is an alias of `EnrichedPresentationMetadata` (core fields + optional frontmatter-derived fields); `CorePresentationMetadata` and `EnrichedPresentationMetadata` are also exported for narrower typing.

`url` and `previewUrl` include the site `baseUrl`. Hooks such as `onPresentationScanned` receive the full object, including the server-only `sourceAbsolutePath` and `outputPath`; theme components receive the [`Presentation`](#theme-facing-types) subset.

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
  /** @deprecated No longer set — kept for backward compatibility. */
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
  /** Non-blocking problems (e.g. thumbnail / PDF export failed because Playwright is missing). */
  warnings?: string[];
}
```

A result with `success: true` and `warnings` means the presentation itself built correctly but an optional asset could not be generated. Such failures never invalidate the cache and never fail the build.

---

## `PresentationBuildError`

Thrown by `docusaurus build` when at least one presentation failed to build. `failures` carries every failed `BuildResult`; the message lists them all.

```ts
class PresentationBuildError extends Error {
  readonly failures: BuildResult[];
}

/** Failed results of a build run (asset warnings are NOT failures). */
function collectBuildFailures(results: BuildResult[]): BuildResult[];
/** Throws a PresentationBuildError if any result failed. */
function assertBuildSucceeded(results: BuildResult[]): void;
```

These helpers are internal to the plugin (not re-exported from the package entry point); they are documented here to explain the error you see in CI.

---

## `PresentationCollisionError`

Thrown during scanning when two presentations would be served from the same route or nested in each other's build output — for example `foo.md` next to a `foo/` directory, or ids that only differ by case (`Intro.md` / `intro.md`). `collisions` lists a human-readable description of each conflict. Rename a file or directory to fix it.

---

## `BuildContext`

Context passed to the builder, providing the Docusaurus site root and base URL.

```ts
interface BuildContext {
  siteDir: string;
  baseUrl: string;
  /**
   * Current Docusaurus locale, set ONLY for non-default locales. Selects a
   * per-locale build cache (each locale has its own baseUrl, embedded in the
   * built assets). Undefined → single, locale-less cache.
   */
  locale?: string;
}
```

---

## `PluginOptions`

Full plugin configuration. Extends `ScanOptions`, `BuildOptions`, `UIOptions` and `DevServerOptions`.

```ts
interface ScanOptions {
  /** Directory containing Slidev .md files, relative to the site root. Default: "./slidev" */
  path: string;
  /** Plugin instance ID. Default: "default" */
  id: string;
}

interface BuildOptions {
  /** Default theme. No built-in default: decks fall back to their own frontmatter theme or Slidev's default. */
  theme?: string;
  addons?: string[];
  /** Maximum duration of one presentation build, in seconds (10–600, default 300). */
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

/** @deprecated Both options are accepted but have no effect (no Slidev dev server any more). */
interface DevServerOptions {
  devServerBasePort: number;
  devServerTimeout: number;
}

interface UIOptions {
  routeBasePath: string;
  pageTitle: string;
  pageTagline: string;
  /** Visual layout variant. Default: "default". See {@link UITheme}. */
  uiTheme: UITheme;
}

interface PluginOptions
  extends ScanOptions, BuildOptions, UIOptions, DevServerOptions {
  onPresentationScanned?: (
    presentation: PresentationMetadata,
  ) => void | Promise<void>;
  onBuildComplete?: (results: BuildResult[]) => void | Promise<void>;
  transformFrontmatter?: (
    data: SlidevFrontmatter,
    filePath: string,
  ) => SlidevFrontmatter;
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
  /** `docusaurus start` only: URL of the build status file (see below). */
  buildStatusUrl?: string;
}
```

---

## Theme-facing types

These types are exposed to React theme components via `usePluginData()`. They omit server-only fields (`sourceAbsolutePath`, `outputPath`), and the global data only carries the UI-relevant part of the config — absolute paths, hooks and build options are never sent to the browser.

```ts
/** Presentation data exposed to theme components. */
type Presentation = Omit<
  PresentationMetadata,
  "sourceAbsolutePath" | "outputPath"
>;

/** Category data exposed to theme components. */
type Category = CategoryMetadata;

/** Plugin config subset exposed to theme components. */
interface PluginConfig {
  routeBasePath: string;
  path?: string;
  pageTitle?: string;
  pageTagline?: string;
  /** Active visual layout variant. Matches the `uiTheme` plugin option. */
  uiTheme: UITheme;
}

/** Global data shape consumed by usePluginData() in theme components. */
interface PluginData {
  presentations: Presentation[];
  categories: Category[];
  playlists: PlaylistData[];
  config: PluginConfig;
  /**
   * `docusaurus start` only: URL of the JSON build status file polled by
   * `SlidevPresentation` while presentations build in the background.
   * Undefined in production.
   */
  buildStatusUrl?: string;
}
```

:::caution `isDev` removed
`PluginData.isDev` (and `PluginContentData.isDev`) no longer exist. Use `Boolean(buildStatusUrl)` instead — see [Dev Server](./dev-server.md#what-the-presentation-page-shows).
:::

### Dev build status

Shape of the file at `buildStatusUrl` (`{baseUrl}{routeBasePath}/__slidesaurus__/build-status.json`):

```ts
type PresentationBuildState = "pending" | "building" | "ready" | "failed";

interface PresentationBuildStatus {
  state: PresentationBuildState;
  /** A complete output can be served (possibly a previous build). */
  hasOutput: boolean;
  /** mtime (ms) of the served index.html — changes on every rebuild. */
  builtAt?: number;
  /** First line of the build error (`failed` only). */
  error?: string;
}

interface BuildStatusFile {
  /** Keyed by presentation id. */
  presentations: Record<string, PresentationBuildStatus>;
}
```

Fetch it with `Accept: application/json` — otherwise the dev server answers a not-yet-written file with the site's HTML fallback. These types are not exported by the package entry point; copy them in a swizzled component if you need them.

---

## `useUITheme` hook

A convenience hook that reads the active `uiTheme` from plugin data. Useful when building custom swizzle wrappers that need to know the current theme variant.

```ts
import { useUITheme } from "@theme/useUITheme";

// Returns the uiTheme value from the plugin data (defaults to "default")
const uiTheme = useUITheme(); // uses pluginId "default"
const uiTheme = useUITheme("training"); // named plugin instance
```

---

## Usage

The package entry point (`slidesaurus`) exports the plugin itself (default export), `validateOptions`, `getSwizzleComponentList`, the `SlidesaurusPluginOptions` type (`Partial<PluginOptions>`) and every public type on this page:

```ts title="docusaurus.config.ts"
import type { SlidesaurusPluginOptions } from "slidesaurus";

const options: SlidesaurusPluginOptions = {
  path: "./slidev",
  onPresentationScanned(presentation) {
    // `presentation` is inferred as PresentationMetadata
  },
};
```

Import the other types by name when you type hooks or swizzled components:

```ts
import type {
  BuildResult,
  PresentationMetadata,
  SlidevFrontmatter,
  PluginData,
} from "slidesaurus";
```

Exported types: `BuildResult`, `Category`, `CategoryMetadata`, `CorePresentationMetadata`, `EnrichedPresentationMetadata`, `ExportFormat`, `PlaylistData`, `PluginConfig`, `PluginData`, `PluginOptions`, `Presentation`, `PresentationLevel`, `PresentationMetadata`, `SlidevFrontmatter`, `UITheme`. Build helpers such as `assertBuildSucceeded` stay internal.
