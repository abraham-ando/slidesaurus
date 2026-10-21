---
sidebar_position: 13
---

# Dev Server

During `docusaurus start`, the plugin builds presentations with the same pipeline as production and serves the static output through webpack's built-in static file server. The builds run **in the background**: the site opens right away, without waiting for Slidev — on this documentation site (6 decks, empty cache, Windows), in 30 s instead of 6 min 44 s.

## How It Works

There are no external Slidev processes, no ports to manage and no proxy involved.

1. **Background build on startup** — `loadContent()` scans the slides, schedules `buildAllPresentations()` (the same function used by `docusaurus build`) and returns immediately. The incremental SHA-256 cache applies: only presentations whose inputs have changed are rebuilt.
2. **Static serving** — `configureWebpack()` returns a `devServer.static` entry pointing to the plugin's cache output directory, mounted at `{baseUrl}{routeBasePath}` — the same URL the presentations were built for (e.g. `/slidev/getting-started/introduction/`).
3. **Build status** — the progress of every presentation (`pending`, `building`, `ready`, `failed`) is written to a small JSON file served at `{baseUrl}{routeBasePath}/__slidesaurus__/build-status.json`. The presentation page polls it.
4. **Watch and rebuild** — `getPathsToWatch()` tells Docusaurus to watch the slide sources. When one changes, Docusaurus calls `loadContent()` again, which schedules an incremental rebuild of the affected presentation.

Runs never overlap: a change saved while a build is running is queued, and a burst of saves triggers at most one extra run.

The watched files under `path` are:

- `**/*.md` and `**/_category_.yml` / `_category_.json`;
- Vue components and scripts (`.vue`, `.ts`, `.js`, `.json`);
- styles and images, and everything under `public/`.

```
docusaurus start → loadContent() → schedules the build, returns at once → site opens
background build → output/{id}/ replaced → build-status.json updated
presentation page → polls build-status.json → reloads its iframe when the deck is ready
```

## What the presentation page shows

While a presentation has never been built, its page shows **"Building this presentation…"** instead of the iframe, then opens the deck as soon as its output is ready — no manual refresh. If the build fails, the page shows the first line of the error (the full log is in the terminal); saving the file rebuilds it.

When a deck that already has an output is rebuilt, the previous build stays visible with a "Rebuilding…" bar; the iframe then reloads on the slide you were looking at. If the rebuild fails, the previous build stays visible with the error.

:::info No full-page reload
The cache output is **not** watched by webpack: a finished build never reloads the page you are reading. Only `SlidevPresentation` follows the build status. Other embeds (`SlidevCard` previews, `SlidevLink`) show the new build on the next page load.
:::

:::note Swizzled `SlidevPresentation`
`PluginData.isDev` has been removed. Its equivalent is `Boolean(buildStatusUrl)`: `buildStatusUrl` is set in `docusaurus start` only.

- A **wrapped** `SlidevPresentation` (`swizzle --wrap`) gets the build state automatically.
- An **ejected** copy made before this version keeps working: it loads the iframe directly. While a deck is not built yet the iframe shows the dev server's fallback page; reload the page once the terminal reports the build. To get the build state, eject the component again, or poll `buildStatusUrl` yourself — the file is `{ "presentations": { "<id>": { "state", "hasOutput", "builtAt", "error" } } }` (`BuildStatusFile` in [Types](./types.md)).
  :::

The cache directory layout mirrors production:

```
.docusaurus/slidesaurus/{id}/output/
  getting-started/introduction/index.html
  getting-started/introduction/assets/…
  advanced/best-practices/index.html
  …
.docusaurus/slidesaurus/{id}/status/build-status.json   ← dev only, never published
```

For non-default [Docusaurus locales](https://docusaurus.io/docs/i18n/introduction) the cache lives under `.docusaurus/slidesaurus/{id}/i18n/{locale}/`, because each locale has its own `baseUrl` embedded in the built assets.

:::info No Slidev HMR
Because presentations are built (not served by `slidev dev`), there is **no Slidev hot module replacement** inside the Docusaurus dev site. A change triggers a rebuild of that deck, which the presentation page picks up when it is done. For instant feedback while authoring a deck, run Slidev's own dev server alongside (see [Real-time slide editing](#real-time-slide-editing)).
:::

## Configuration

All options that control production builds also apply in dev mode (`theme`, `addons`, `maxParallelBuilds`, `buildTimeout`, `verbose`, `autoInstall`, `download`…).

:::caution `devServerBasePort` and `devServerTimeout` are deprecated
Earlier versions started one Slidev dev server per presentation and proxied it through webpack. That mechanism has been removed. Both options are still **accepted** so existing configs keep working, but they have **no effect** and a warning is logged. You can safely delete them.
:::

Setting `dryRun: true` skips builds in dev mode as well — presentations appear in the overview, and their pages show "failed to build" (`Not built (dryRun)`) unless an earlier output is in the cache.

If a presentation fails to build in dev mode, the error is logged and published in the build status; the rest of the site keeps working. In `docusaurus build` the builds are **not** in the background: the site build waits for them and fails if a presentation fails.

## Cache in dev mode

The incremental cache works the same way as in production. If you start `docusaurus start` after a prior `docusaurus build`, presentations that did not change are served instantly from cache.

To force a full rebuild, clear the cache:

```bash
slidesaurus cache clear
```

## Working on the plugin itself

In this repository, `pnpm dev:docs` / `pnpm dev:sample` build the plugin once (cached by Turbo) and start the site. To recompile the plugin on change, run its Rollup watcher in another terminal:

```bash
pnpm watch:plugin
```

## Real-time slide editing

For a fast live-editing loop on a single deck, run Slidev's own dev server in parallel:

```bash
# Terminal 1 — Docusaurus site
pnpm dev:docs

# Terminal 2 — Slidev standalone for the deck you are editing
cd slidev
slidev my-presentation.md
```

You get Vite HMR for the deck in the Slidev window while Docusaurus keeps serving the rest of the site.

## Troubleshooting

### "Building this presentation…" never ends

The background build may still be waiting for a slot (`maxParallelBuilds`) or running — check the terminal. A build is killed after `buildTimeout` seconds and the page then shows the failure.

### Presentation iframe is blank

Check the terminal for build errors. If the build succeeded, verify that `path` points to the correct directory and that the presentation appears in `npx docusaurus slidev:list`. Also check that `@slidev/cli` is installed.

### Changes not reflected after file save

Confirm the file you edited is under `path` (see the watched file types above). The presentation page reloads by itself when the rebuild is done; other pages need a refresh. Config file changes (`docusaurus.config.ts`) require a manual restart of `docusaurus start`.

### Build fails in dev mode

Enable verbose output to see the full `slidev build` log:

```ts
{
  verbose: true;
}
```

Check for missing themes or addons. Set `autoInstall: true` to let the plugin install them automatically, or pre-install them via your `package.json`.
