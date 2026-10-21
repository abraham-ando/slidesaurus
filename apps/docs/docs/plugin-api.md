---
sidebar_position: 15
---

# Plugin API

`slidesaurus` implements several Docusaurus plugin lifecycle hooks to discover, build, and serve presentations.

## Lifecycle Hooks

### `validateOptions`

Runs first. Validates the options with a Joi schema, maps deprecated aliases (`sourceDir` → `path`, `overviewPath` → `routeBasePath`, `overviewTitle` → `pageTitle`, `overviewTagline` → `pageTagline`; the new name wins if both are given, with a warning) and rejects unsafe values: an absolute `path` or one escaping the site directory, a `routeBasePath` that does not start with `/` or contains `..`, and an `id` containing anything other than letters, digits, `_` and `-`. The deprecated `devServerBasePort` / `devServerTimeout` are accepted but ignored (warning).

### `loadContent`

Runs during the content-loading phase, in both `docusaurus build` and `docusaurus start`. The plugin:

1. Invokes the **Scanner** to walk the configured `path` directory (skipping dotfiles, `_*` entries, `node_modules`, `sections/` and symlinks).
2. Reads each `.md` file's frontmatter with gray-matter (`---js` frontmatter is refused), validates it, and applies `transformFrontmatter` and `onPresentationScanned`.
3. Reads `_category_.yml` / `.yaml` / `.json` files for category metadata.
4. Throws a `PresentationCollisionError` when two presentations would share a route (e.g. `foo.md` next to a `foo/` directory, or ids differing only by case).
5. **Builds the presentations** (unless `dryRun` is set or `@slidev/cli` is missing): hashes each deck, skips unchanged ones, builds the rest with up to `maxParallelBuilds` concurrent `slidev build` processes, generates thumbnails and optional PDF/PPTX exports, and calls `onBuildComplete`.
6. In `docusaurus build`, waits for the builds and throws a `PresentationBuildError` listing every presentation that failed. In `docusaurus start`, step 5 runs **in the background**: `loadContent` returns right after the scan, so the site opens without waiting for Slidev; runs are queued (never concurrent), errors are logged and published in the build status file (`PluginContentData.buildStatusUrl`, see [Dev Server](./dev-server.md)).

```ts
async loadContent(): Promise<PluginContentData> {
  // Scan → build (incremental, parallel; background in dev) → return presentations, categories, playlists
}
```

### `contentLoaded`

Receives the content from `loadContent` and registers Docusaurus routes:

1. **Overview route** — at `{baseUrl}{routeBasePath}`, rendering `SlidevOverview`; plus one route per category.
2. **Presentation routes** — one route per presentation, rendering `SlidevPresentation`. Ids are percent-encoded in the URL.
3. **Global data** — a reduced, public DTO (presentations without `sourceAbsolutePath` / `outputPath`, categories, playlists, only the UI-relevant config, and in dev the `buildStatusUrl`). Absolute filesystem paths, hooks and build options are never serialised into the client bundle.

### `postBuild`

Runs after the Docusaurus build (production only). The builds already happened in `loadContent`; this step only publishes their output:

1. Copies the built presentations from the cache (`.docusaurus/slidesaurus/{id}/output/`) into `{outDir}{routeBasePath}`.
2. Creates a `presenter/index.html` fallback per presentation so static hosts can serve the presenter view.
3. Writes a `presentations-index.json` search index at `{routeBasePath}/presentations-index.json` containing id, title, description, url, tags, author, owner, category, level, duration, deprecated and playlist for each presentation.

### `getPathsToWatch`

Tells Docusaurus which files trigger a `loadContent()` reload in dev mode: `.md`, `_category_.yml` / `_category_.json`, `.vue`, `.ts`, `.js`, `.json`, styles, images and everything under `public/` in the `path` directory.

### `configureWebpack`

In dev mode only, serves the cache output directory as static files under `{baseUrl}{routeBasePath}`, and the build status directory under `{baseUrl}{routeBasePath}/__slidesaurus__/`. Neither is watched by webpack (a finished build does not reload the open pages). See [Dev Server](./dev-server.md).

### `getThemePath` / `getTypeScriptThemePath`

`getThemePath()` returns the **compiled** JavaScript theme (`lib/theme/`) — Docusaurus does not transpile TSX coming from `node_modules`. `getTypeScriptThemePath()` returns the raw TSX sources (`theme/`), used by `docusaurus swizzle --typescript`.

```ts
getThemePath(): string {
  return path.resolve(__dirname, "theme");        // lib/theme (compiled)
}
getTypeScriptThemePath(): string {
  return path.resolve(__dirname, "../theme");     // theme/ (TSX sources)
}
```

### `extendCli`

Registers three commands, available via `npx docusaurus`. They scan the configured `path` directory without triggering a build:

| Command | Description |
| --- | --- |
| `slidev:list` | Lists discovered presentations (category/file → title, author, level, duration, deprecation) |
| `slidev:stats` | Prints totals: authors, tags, levels, deprecated and incomplete presentations, playlists |
| `slidev:validate` | Reports metadata issues (missing description or author, deprecated decks) |

```bash
npx docusaurus slidev:list
npx docusaurus slidev:stats
npx docusaurus slidev:validate
```

For the standalone developer CLI (`slidesaurus new`, `slidesaurus doctor`, `slidesaurus cache clear`, etc.) see the [CLI Reference](./cli.md).

### `getSwizzleComponentList`

Exposes the theme components that users can swizzle. Docusaurus uses this list to enable the `swizzle` command for the plugin.

```ts
getSwizzleComponentList(): string[] {
  return [
    "SlidevOverview",
    "SlidevCard",
    "SlidevListItem",
    "SlidevCategoryCard",
    "SlidevPresentation",
  ];
}
```

| Component | Description |
| --- | --- |
| `SlidevOverview` | The overview page (search, filters, grid/list toggle, sidebar) |
| `SlidevCard` | Card component used in the grid view |
| `SlidevListItem` | Row component used in the list view |
| `SlidevCategoryCard` | Category card used in grid and list views |
| `SlidevPresentation` | The individual presentation page with iframe and metadata |

`SlidevLink` and `SlidevIframe` ship in the theme and can be imported via `@theme/SlidevLink` / `@theme/SlidevIframe`, but are not in the swizzle list.

Example swizzle command:

```bash
npx docusaurus swizzle slidesaurus SlidevCard --wrap
```

## Plugin Structure

```
packages/slidesaurus/
  src/
    index.ts                        # Rollup entry — thin re-export
    domain/
      types.ts                      # All TypeScript types and interfaces
      interfaces.ts                 # ICache, IAssetPostProcessor, ICliCommand…
      constants.ts                  # Plugin name, timeouts, shared constants
    application/
      scanner.ts                    # File discovery, frontmatter, collision detection
      builder.ts                    # Parallel build orchestration, failure aggregation
      buildCache.ts                 # Incremental fingerprint + hash manifest checks
      frontmatterValidator.ts       # Frontmatter validation and patching
    infrastructure/
      fs/
        fileSystem.ts               # Cache directory resolution, file hashing
        fsUtils.ts                  # Containment checks, atomic directory replace
        dependencies.ts             # Files a deck depends on (copy + cache hash)
        hashManifest.ts             # Read/write build-hashes.json
        isolatedBuild.ts            # Isolated per-presentation build dirs
        iconCollections.ts          # Fast @iconify-json resolution in the isolated dir
        buildStatus.ts              # Dev build status file (docusaurus start)
        outputManager.ts            # Cache output, orphan purge, final copy, search index
      process/
        buildRunner.ts              # Spawn `slidev build` (no shell, kills process tree)
        assetGenerator.ts           # Shared browser: thumbnail + PDF from the built output; PPTX via slidev export
        pdfRenderer.ts              # /print → page.pdf(), headmatter export settings
        playwright.ts               # Optional playwright-chromium loader
        staticServer.ts             # Loopback server of a built deck (thumbnails, PDF)
      packages/
        packageResolver.ts          # Theme/addon resolution and auto-install
        env.ts                      # Environment variable allowlist (security)
    presentation/
      plugin.ts                     # Docusaurus plugin lifecycle hooks
      routeBuilder.ts               # Route registration + public global data
      cliCommands.ts                # `slidev:list|stats|validate` Docusaurus commands
      webpackConfig.ts              # Dev-mode static file serving config
    shared/
      logger.ts                     # Structured logger
      utils.ts                      # Shared helpers (route paths, name validation)
      concurrentRunner.ts           # Bounded worker pool (runConcurrently)
    cli/
      index.ts                      # Standalone `slidesaurus` CLI entry
      config.ts                     # Loads docusaurus.config.{ts,js,mjs} via jiti
      commands/                     # new, list, doctor, cache
  theme/
    SlidevOverview/                 # Overview page (search, filters, grid/list, sidebar)
    SlidevPresentation/             # Individual presentation page (iframe, resume bar)
    SlidevCard/                     # Card for grid view
    SlidevListItem/                 # Row for list view
    SlidevCategoryCard/             # Category card
    SlidevLink/                     # Embeddable inline preview
    SlidevIframe/                   # Shared sandboxed iframe wrapper
    useFavorites.ts                 # Favorites state hook (localStorage)
    useUITheme.ts                   # Reads active uiTheme from plugin data
    filterUtils.ts                  # Shared filter functions for theme components
    types.ts                        # Theme-facing type re-exports
  scripts/build-theme.mjs           # Compiles theme/ → lib/theme/
```

The published package contains `lib/` (`index.cjs`, `index.mjs`, `index.d.cts`, `index.d.mts`, `cli.cjs`, and the compiled `lib/theme/`) and `theme/` (TSX sources).

## Extending the Plugin

The plugin does not currently expose a public extension API. To customize behavior:

1. **Swizzle theme components** to change rendering (see `getSwizzleComponentList` above).
2. **Fork the plugin** for deeper modifications.
3. **Use Docusaurus plugin composition** — write a separate plugin that reads the same `slidev/` directory for additional processing.
