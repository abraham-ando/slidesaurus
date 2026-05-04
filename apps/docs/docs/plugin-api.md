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

Registers three CLI commands available via `npx docusaurus <command>`. These commands scan the configured `path` directory and operate without triggering a full Docusaurus build.

#### `slidev:list`

Lists all discovered presentations with their metadata.

```bash
npx docusaurus slidev:list
```

Outputs a table with each presentation's title, author, level, duration, and whether it is deprecated.

#### `slidev:validate`

Scans presentations and reports metadata issues without building. Flagged conditions include missing description, missing author, and deprecated status.

```bash
npx docusaurus slidev:validate
```

Exits with code `0` when no critical errors are found, making it suitable for use in CI pipelines.

#### `slidev:stats`

Prints a statistics summary across all discovered presentations.

```bash
npx docusaurus slidev:stats
```

Example output:

```
Slidev presentations — "./slidev"
  Total:       12
  Authors:     Alice, Bob
  Tags:        typescript, react, testing
  Levels:      beginner, intermediate
  Deprecated:  1
  Incomplete:  2 (missing description or author)
  Playlists:   2
    • Onboarding Track (4 items)
    • Advanced Series (3 items)
```

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
  ];
}
```

| Component | Description |
| --- | --- |
| `SlidevOverview` | The overview page (search, filters, grid/list toggle, sidebar) |
| `SlidevCard` | Card component used in the grid view |
| `SlidevListItem` | Row component used in the list view |
| `SlidevCategoryCard` | Section wrapper that groups presentations by category |
| `SlidevPresentation` | The individual presentation page with iframe and metadata |

Example swizzle command:

```bash
npx docusaurus swizzle slidesaurus SlidevCard --wrap
```

## Plugin Structure

```
packages/slidesaurus/
  src/
    index.ts          # Plugin entry, lifecycle hooks
    scanner.ts        # File discovery and frontmatter parsing
    builder.ts        # Slidev CLI invocation, thumbnail/PDF generation
    fileSystem.ts     # File system utilities
    filterUtils.ts    # Pure filter functions (matchesSearch, applyFilters)
    logger.ts         # Logging utilities
    utils.ts          # Shared helpers
    types.ts          # TypeScript interfaces
  theme/
    SlidevOverview/      # Overview page component (search, filters, sidebar)
    SlidevPresentation/  # Individual presentation component
    SlidevCard/          # Card component for grid view
    SlidevListItem/      # Row component for list view
    SlidevCategoryCard/  # Category section wrapper
    SlidevLink/          # Embeddable preview component
    useFavorites.ts      # Favorites state hook (localStorage)
```

## Extending the Plugin

The plugin does not currently expose a public extension API. To customize behavior:

1. **Swizzle theme components** to change rendering (see `getSwizzleComponentList` above).
2. **Fork the plugin** for deeper modifications.
3. **Use Docusaurus plugin composition** — write a separate plugin that reads the same `slidev/` directory for additional processing.
