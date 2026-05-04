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
| `theme` | `string` | `"unicorn"` | Default Slidev theme applied to all presentations. Can be overridden per-presentation via frontmatter. |
| `addons` | `string[]` | `[]` | Default Slidev addons applied to all presentations. |
| `download` | `boolean` | `false` | Show a download button on presentation pages and cards. Requires Playwright for file generation at build time. |
| `exportFormats` | `Array<"pdf" \| "pptx">` | `["pdf"]` | Output formats generated when `download` is enabled. Accepts `"pdf"` (Playwright PDF render) and/or `"pptx"` (PowerPoint export). |
| `exportWithClicks` | `boolean` | `false` | When `true`, each click animation step is exported as a separate page in the PDF/PPTX. Only relevant when `exportFormats` is non-empty. |
| `withoutNotes` | `boolean` | `false` | Strip presenter notes from the built presentation. Can also be set per-presentation via frontmatter (`withoutNotes: true`). |
| `buildTimeout` | `number` | `120` | Maximum time in seconds allowed for building a single presentation. |
| `maxParallelBuilds` | `number` | `4` | Number of presentations to build concurrently during `docusaurus build`. |
| `verbose` | `boolean` | `false` | Print detailed build output for each presentation. |
| `autoInstall` | `boolean` | `true` | Automatically install missing npm packages for themes and addons. |
| `dryRun` | `boolean` | `false` | When `true`, scans and validates all presentations without building them. Useful in CI pipelines to catch configuration errors early. |

## Hooks

Three optional hooks can be passed alongside the options above.

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

### Dry-Run in CI

```ts
plugins: [
  ["slidesaurus", { dryRun: process.env.CI === "true" }],
],
```

When running in a CI environment (`CI=true`), the plugin will scan and validate all presentations without triggering any builds. This lets you catch frontmatter errors, missing themes, or broken references without the overhead of a full Slidev build.
