---
sidebar_position: 13
---

# Dev Server

During `docusaurus start`, the plugin builds presentations using the same pipeline as production and serves the static output through webpack's built-in static file server.

## How It Works

There are no external processes, no ports, and no proxies involved.

1. **Build on startup** — `loadContent()` calls `buildAllPresentations()` (the same function used by `docusaurus build`). The incremental SHA-256 cache applies: only presentations whose source or options have changed are rebuilt.
2. **Static serving** — `configureWebpack()` returns a `devServer.static` entry pointing to the plugin's cache output directory. Webpack serves these files directly at the same URL path as production (e.g. `/slidev/getting-started/introduction/`).
3. **Watch and rebuild** — `getPathsToWatch()` tells Docusaurus to watch all `.md` files and assets in the configured `path` directory. When a slide file changes, Docusaurus calls `loadContent()` again, which triggers an incremental rebuild of the affected presentation. Webpack's file watcher picks up the updated static files automatically.

```
File change → Docusaurus detects via getPathsToWatch()
            → loadContent() → buildAllPresentations() (incremental)
            → webpack devServer.static serves updated files
            → Browser reloads
```

The cache directory layout mirrors production exactly:

```
.docusaurus/slidesaurus/{pluginId}/output/
  getting-started/introduction/index.html
  getting-started/introduction/assets/…
  advanced/best-practices/index.html
  …
```

## Configuration

Most options that control production builds also apply in dev mode. In addition, two options are specific to the dev server:

| Option | Type | Default | Description |
|---|---|---|---|
| `devServerBasePort` | `number` | `8600` | Base port for Slidev dev servers. Each presentation gets `basePort + index`. |
| `devServerTimeout` | `number` | `60000` | Max wait time (ms) for a dev server to become ready. Increase on slow machines. |

```ts title="docusaurus.config.ts"
plugins: [
  [
    "slidesaurus",
    {
      path: "./slidev",
      maxParallelBuilds: 4,
      buildTimeout: 120,
      devServerBasePort: 8700,   // avoid collision with another instance on 8600
      devServerTimeout: 90000,   // allow 90 s on first Vite cold start
    },
  ],
],
```

Setting `dryRun: true` skips builds in dev mode as well — presentations appear in the overview but their iframes will be empty.

### Multiple instances — port allocation

When two plugin instances run simultaneously during `docusaurus start`, their dev servers must use non-overlapping port ranges:

```ts
plugins: [
  ["slidesaurus", { id: "talks",    path: "./talks",    devServerBasePort: 8600 }],
  ["slidesaurus", { id: "training", path: "./training", devServerBasePort: 8700 }],
],
```

Instance `talks` claims ports 8600–8699; instance `training` claims 8700–8799 (assuming fewer than 100 presentations each).

## Cache in dev mode

The incremental cache works the same way as in production. If you start `docusaurus start` after a prior `docusaurus build`, presentations that did not change are served instantly from cache without rebuilding.

To force a full rebuild, clear the cache:

```bash
slidesaurus cache clear
```

## Real-time slide editing

The rebuild on file change is triggered by Docusaurus (not Vite HMR). For a fast live-editing loop on a single deck, run Slidev's own dev server in parallel:

```bash
# Terminal 1 — Docusaurus docs site
pnpm dev:docs

# Terminal 2 — Slidev standalone for the deck you are editing
cd slidev
slidev dev my-presentation.md
```

This gives you Vite HMR for the deck in the Slidev window while Docusaurus continues serving the rest of the site.

## Troubleshooting

### Presentation iframe is blank

The presentation may not have been built yet. Check the terminal for build errors. If the build succeeded, verify that `options.path` points to the correct directory and that the presentation appears in `npx docusaurus slidev:list`.

### Changes not reflected after file save

Confirm that `getPathsToWatch()` covers the file you edited (`.md` files and image assets under `options.path` are watched). Config file changes (`docusaurus.config.ts`) require a manual restart of `docusaurus start`.

### Build fails in dev mode

Enable verbose output to see the full `slidev build` log:

```ts
{ verbose: true }
```

Check for missing themes or addons. Set `autoInstall: true` to let the plugin install them automatically, or pre-install them via your `package.json`.
