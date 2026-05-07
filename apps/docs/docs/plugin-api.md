---
sidebar_position: 15
---

# Plugin API

`slidesaurus` implements several Docusaurus plugin lifecycle hooks to discover, build, and serve presentations.

## Lifecycle Hooks

### `loadContent`

Runs during the content-loading phase. The plugin:

1. Invokes the **Scanner** to walk the configured `path` directory.
2. Reads each `.md` file's frontmatter using gray-matter.
3. Reads `_category_.yml` files for category metadata.
4. Returns an array of presentation objects with metadata, file paths, and category assignments.

```ts
async loadContent(): Promise<PluginContentData> {
  // Scan directory, parse frontmatter, build category tree
}
```

### `contentLoaded`

Receives the content from `loadContent` and registers Docusaurus routes:

1. **Overview route** — at `routeBasePath`, rendering the `SlidevOverview` component with all presentation metadata.
2. **Presentation routes** — one route per presentation, rendering the `SlidevPresentation` component.

```ts
async contentLoaded({ content, actions }): Promise<void> {
  const { createData, addRoute } = actions;
  // Create JSON data files for each presentation
  // Register overview and individual routes
}
```

### `postBuild`

Runs after the Docusaurus build is complete. The plugin:

1. Creates a build queue from all discovered presentations.
2. Builds up to `maxParallelBuilds` presentations concurrently.
3. Each build invokes `slidev build <file>` with the appropriate theme and addons.
4. Copies the build output (static HTML/JS) into the Docusaurus build directory.
5. Generates static thumbnail PNGs (`thumbnail.png`) for each presentation.
6. Generates PDF exports (`export.pdf`) when `download: true` is set in frontmatter (requires Playwright).
7. Writes a `presentations-index.json` search index at `{routeBasePath}/presentations-index.json` containing title, description, tags, author, category, level, duration, deprecated, and playlist for each presentation.
8. Prints a build telemetry summary: total built, cache hits, failures, and total duration.

```ts
async postBuild({ outDir }): Promise<void> {
  // Parallel Slidev CLI builds
  // Thumbnail and PDF generation
  // Search index generation
  // Copy output to outDir
}
```

### `getThemePath`

Returns the path to the plugin's theme components directory. This is how Docusaurus knows where `SlidevOverview`, `SlidevPresentation`, and other components live.

```ts
getThemePath(): string {
  return path.resolve(__dirname, "../theme");
}
```

### `extendCli`

Registers a `slidev:list` command available via `npx docusaurus slidev:list`. This command scans the configured `path` directory and outputs a summary table without triggering a full Docusaurus build.

```bash
npx docusaurus slidev:list
```

For the full developer CLI (`slidesaurus new`, `slidesaurus doctor`, `slidesaurus cache clear`, etc.) see the [CLI Reference](./cli.md).

### `getSwizzleComponentList`

Exposes theme components that users can safely swizzle. Docusaurus uses this list to enable the `swizzle` command for the plugin.

```ts
getSwizzleComponentList(): string[] {
  return [
    "SlidevOverview",
    "SlidevCard",
    "SlidevListItem",
    "SlidevCategoryCard",
    "SlidevPresentation",
    "SlidevLink",
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
| `SlidevLink` | Embeddable inline preview component for MDX pages |

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
      constants.ts                  # Plugin name, shared constants
    application/
      scanner.ts                    # File discovery and frontmatter parsing
      builder.ts                    # Parallel build orchestration
      buildCache.ts                 # SHA-256 hash manifest, cache hits
      frontmatterValidator.ts       # Frontmatter validation and patching
    infrastructure/
      fs/
        fileSystem.ts               # Cache directory management
        outputManager.ts            # Copy built files to Docusaurus output
        hashManifest.ts             # Read/write build-hashes.json
        isolatedBuild.ts            # Isolated per-presentation build dirs
      process/
        buildRunner.ts              # Spawn `slidev build` child processes
        assetGenerator.ts           # Thumbnail and PDF/PPTX generation
      packages/
        packageResolver.ts          # Theme/addon resolution and auto-install
        env.ts                      # Environment variable allowlist (security)
    presentation/
      plugin.ts                     # Docusaurus plugin lifecycle hooks
      routeBuilder.ts               # Route registration (overview + per-deck)
      cliCommands.ts                # `slidev:list` Docusaurus CLI command
      webpackConfig.ts              # Dev-mode static file serving config
    shared/
      logger.ts                     # Structured logger
      utils.ts                      # Shared helpers
      concurrentRunner.ts           # Bounded worker pool (runConcurrently)
      filterUtils.ts                # Pure filter functions (matchesSearch, applyFilters)
  cli/
    index.ts                        # Standalone `slidesaurus` CLI entry
    commands/
      new.ts                        # `slidesaurus new`
      list.ts                       # `slidesaurus list`
      doctor.ts                     # `slidesaurus doctor`
      cache.ts                      # `slidesaurus cache clear`
  theme/
    SlidevOverview/                 # Overview page (search, filters, grid/list, sidebar)
    SlidevPresentation/             # Individual presentation page (iframe, resume bar)
    SlidevCard/                     # Card for grid view
    SlidevListItem/                 # Row for list view
    SlidevCategoryCard/             # Category card
    SlidevLink/                     # Embeddable inline preview
    useFavorites.ts                 # Favorites state hook (localStorage)
    useUITheme.ts                   # Reads active uiTheme from plugin data
    filterUtils.ts                  # Shared filter functions for theme components
    types.ts                        # Theme-facing type re-exports
```

## Extending the Plugin

The plugin does not currently expose a public extension API. To customize behavior:

1. **Swizzle theme components** to change rendering (see `getSwizzleComponentList` above).
2. **Fork the plugin** for deeper modifications.
3. **Use Docusaurus plugin composition** — write a separate plugin that reads the same `slidev/` directory for additional processing.
