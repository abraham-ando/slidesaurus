---
sidebar_position: 4
---

# Plugin Options

Complete reference of all configuration options accepted by `slidesaurus`.

## Usage

```ts title="docusaurus.config.ts"
plugins: [
  [
    "slidesaurus",
    {
      // options go here
    },
  ],
],
```

## Options Reference

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `path` | `string` | `"./slidev"` | Directory containing Slidev Markdown files, relative to the site directory. |
| `routeBasePath` | `string` | `"/slidev"` | URL base path where presentations are served. |
| `pageTitle` | `string` | `"Slidev Presentations"` | Title displayed on the overview page. |
| `pageTagline` | `string` | `"Interactive presentation overview"` | Tagline displayed below the title on the overview page. |
| `id` | `string` | `"default"` | Plugin instance ID. Use when registering multiple instances. |
| `theme` | `string` | `"unicorn"` | Default Slidev theme applied to all presentations. Use a shorthand (`"seriph"`) or full package name (`"@slidev/theme-seriph"`). Can be overridden per-presentation via the `theme` frontmatter field. See [Themes & Addons](./themes-addons.md). |
| `addons` | `string[]` | `[]` | Default Slidev addons applied to all presentations (e.g. `["slidev-addon-excalidraw"]`). Addons extend Slidev with extra components or functionality. Can be supplemented per-presentation via the `addons` frontmatter field (not replaced). See [Themes & Addons](./themes-addons.md). |
| `download` | `boolean` | `false` | Show a download button that generates PDF and/or PPTX exports at build time. Requires `@playwright/test` to be installed (`npm install -D @playwright/test`). Configure output formats with `exportFormats`. |
| `exportFormats` | `Array<"pdf" \| "pptx">` | `["pdf"]` | Output formats generated when `download: true`. `"pdf"` uses Playwright's headless browser; `"pptx"` uses Slidev's built-in PowerPoint export. |
| `exportWithClicks` | `boolean` | `false` | When `true`, click-triggered animations are exported as separate pages instead of being flattened into one. Useful for presentations that rely heavily on step-by-step reveals. Only relevant when `exportFormats` is non-empty. |
| `withoutNotes` | `boolean` | `false` | Strip presenter notes from the built presentation. Can also be set per-presentation via frontmatter (`withoutNotes: true`). |
| `buildTimeout` | `number` | `120` | Maximum time in seconds allowed for building a single presentation. |
| `maxParallelBuilds` | `number` | `os.cpus().length - 1` | Number of presentations to build concurrently during `docusaurus build`. Defaults to one fewer than your CPU count (minimum 1). |
| `verbose` | `boolean` | `false` | Print detailed build output for each presentation. |
| `autoInstall` | `boolean` | `false` | Automatically install missing npm packages for themes and addons. **Off by default** — opt-in explicitly to avoid unexpected installs in CI or production. |
| `dryRun` | `boolean` | `false` | When `true`, scans and validates all presentations without building them. Useful in CI pipelines to catch configuration errors early. |
| `uiTheme` | `string` | `"default"` | Visual layout variant applied to all plugin components. Built-in values: `"default"`, `"compact"`, `"minimal"`. Accepts any string — custom values are set as `data-slidev-ui-theme` on component roots for CSS targeting. See [Custom Styling](./custom-styling.md). |
| `devServerBasePort` | `number` | `8600` | Base port for Slidev dev servers during `docusaurus start`. Each presentation gets `basePort + index`. Useful when running multiple plugin instances to avoid port collisions. |
| `devServerTimeout` | `number` | `60000` | Maximum time in milliseconds to wait for a Slidev dev server to become ready. Increase this if your machine is slow or the first Vite start takes longer than 60 s. |

## Hooks

Three optional hooks can be passed alongside the options above.

| Hook | When to use |
|---|---|
| `onPresentationScanned` | Dynamically modify metadata before it reaches the UI — e.g. mark presentations `deprecated` based on tags, inject a default author, or override the category. |
| `onBuildComplete` | React to build results — log failures to a monitoring system, post a Slack notification, or fail CI when more than N presentations failed. |
| `transformFrontmatter` | Normalize raw YAML before the plugin processes it — e.g. remap legacy field names, fill in computed defaults, or sanitize user input. |

```ts title="docusaurus.config.ts"
plugins: [
  [
    "slidesaurus",
    {
      /** Called after each presentation is scanned. Can modify the metadata object in-place. */
      onPresentationScanned(presentation) {
        if (presentation.tags?.includes("internal")) {
          presentation.deprecated = true;
        }
      },

      /** Called after all builds complete. Receives the full results array. */
      async onBuildComplete(results) {
        const failed = results.filter((r) => !r.success);
        if (failed.length > 0) {
          console.error(`${failed.length} presentation(s) failed to build.`);
        }
      },

      /** Transforms raw frontmatter before the plugin processes it. Must return the modified data. */
      transformFrontmatter(data, filePath) {
        // Inject a default author when none is declared
        return { ...data, author: data.author ?? "Platform Team" };
      },
    },
  ],
],
```

| Hook | Signature | Description |
| --- | --- | --- |
| `onPresentationScanned` | `(presentation: PresentationMetadata) => void \| Promise<void>` | Called once per presentation after scanning. Mutate the object in-place to override any field. |
| `onBuildComplete` | `(results: BuildResult[]) => void \| Promise<void>` | Called once after all presentations are built. Use `result.cacheHit` to distinguish rebuilt from cached. |
| `transformFrontmatter` | `(data: SlidevFrontmatter, filePath: string) => SlidevFrontmatter` | Called before the plugin processes frontmatter. Return the modified data. |

See [Plugin API](./plugin-api.md) for the full hook reference.

## Detailed Examples

### Minimal

```ts
plugins: [
  ["slidesaurus", {}],
],
```

Uses all defaults: discovers presentations in `./slidev`, serves at `/slidev`.

### Custom Path and Route

```ts
plugins: [
  [
    "slidesaurus",
    {
      path: "./presentations",
      routeBasePath: "/slides",
      pageTitle: "Slide Decks",
      pageTagline: "Conference talks and workshops",
    },
  ],
],
```

### With Theme and Addons

```ts
plugins: [
  [
    "slidesaurus",
    {
      theme: "apple-basic",
      addons: ["slidev-addon-excalidraw"],
    },
  ],
],
```

### High-Performance Build

```ts
plugins: [
  [
    "slidesaurus",
    {
      maxParallelBuilds: 8,
      buildTimeout: 300,
      verbose: true,
    },
  ],
],
```

### Multiple Instances

```ts
plugins: [
  [
    "slidesaurus",
    {
      id: "talks",
      path: "./talks",
      routeBasePath: "/talks",
      pageTitle: "Conference Talks",
    },
  ],
  [
    "slidesaurus",
    {
      id: "training",
      path: "./training",
      routeBasePath: "/training",
      pageTitle: "Training Modules",
    },
  ],
],
```

:::caution Multiple Instances
Each instance must have a unique `id` and `routeBasePath`.
:::

### UI Theme Variants

```ts
plugins: [
  [
    "slidesaurus",
    {
      // Built-in compact layout: smaller cards, no description text
      uiTheme: "compact",

      // Or: text-only minimal layout (no thumbnails, list view only)
      // uiTheme: "minimal",

      // Or: any string for a fully custom CSS theme
      // uiTheme: "glass",
    },
  ],
],
```

See [Custom Styling](./custom-styling.md) for how to implement custom `uiTheme` values.

### Dev Server Port Range

```ts
plugins: [
  ["slidesaurus", { id: "talks",    path: "./talks",    devServerBasePort: 8600 }],
  ["slidesaurus", { id: "training", path: "./training", devServerBasePort: 8700 }],
],
```

Each instance uses a distinct port range to avoid collisions during `docusaurus start`.

### Dry-Run in CI

```ts
plugins: [
  ["slidesaurus", { dryRun: process.env.CI === "true" }],
],
```

When running in a CI environment (`CI=true`), the plugin will scan and validate all presentations without triggering any builds. This lets you catch frontmatter errors, missing themes, or broken references without the overhead of a full Slidev build.
