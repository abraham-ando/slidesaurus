---
sidebar_position: 13
---

# Dev Server

During `docusaurus start`, the plugin builds presentations with the same pipeline as production and serves the static output through webpack's built-in static file server.

## How It Works

There are no external Slidev processes, no ports to manage and no proxy involved.

1. **Build on startup** — `loadContent()` calls `buildAllPresentations()` (the same function used by `docusaurus build`). The incremental SHA-256 cache applies: only presentations whose inputs have changed are rebuilt.
2. **Static serving** — `configureWebpack()` returns a `devServer.static` entry pointing to the plugin's cache output directory, mounted at `{baseUrl}{routeBasePath}` — the same URL the presentations were built for (e.g. `/slidev/getting-started/introduction/`).
3. **Watch and rebuild** — `getPathsToWatch()` tells Docusaurus to watch the slide sources. When one changes, Docusaurus calls `loadContent()` again, which triggers an incremental rebuild of the affected presentation, and webpack serves the updated files.

The watched files under `path` are:

- `**/*.md` and `**/_category_.yml` / `_category_.json`;
- Vue components and scripts (`.vue`, `.ts`, `.js`, `.json`);
- styles and images, and everything under `public/`.

```
File change → Docusaurus detects via getPathsToWatch()
            → loadContent() → buildAllPresentations() (incremental)
            → webpack devServer.static serves updated files
            → reload the page to see the new build
```

The cache directory layout mirrors production:

```
.docusaurus/slidesaurus/{id}/output/
  getting-started/introduction/index.html
  getting-started/introduction/assets/…
  advanced/best-practices/index.html
  …
```

For non-default [Docusaurus locales](https://docusaurus.io/docs/i18n/introduction) the cache lives under `.docusaurus/slidesaurus/{id}/i18n/{locale}/`, because each locale has its own `baseUrl` embedded in the built assets.

:::info No Slidev HMR
Because presentations are built (not served by `slidev dev`), there is **no Slidev hot module replacement** inside the Docusaurus dev site. A change triggers a rebuild of that deck; refresh the page to see it. For instant feedback while authoring a deck, run Slidev's own dev server alongside (see [Real-time slide editing](#real-time-slide-editing)).
:::

## Configuration

All options that control production builds also apply in dev mode (`theme`, `addons`, `maxParallelBuilds`, `buildTimeout`, `verbose`, `autoInstall`, `download`…).

:::caution `devServerBasePort` and `devServerTimeout` are deprecated
Earlier versions started one Slidev dev server per presentation and proxied it through webpack. That mechanism has been removed. Both options are still **accepted** so existing configs keep working, but they have **no effect** and a warning is logged. You can safely delete them.
:::

Setting `dryRun: true` skips builds in dev mode as well — presentations appear in the overview but their pages will be empty.

If a presentation fails to build in dev mode, the error is logged and the rest of the site keeps working (in `docusaurus build`, the same failure fails the build).

## Cache in dev mode

The incremental cache works the same way as in production. If you start `docusaurus start` after a prior `docusaurus build`, presentations that did not change are served instantly from cache.

To force a full rebuild, clear the cache:

```bash
slidesaurus cache clear
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

### Presentation iframe is blank

The presentation may not have been built yet or its build failed. Check the terminal for build errors. If the build succeeded, verify that `path` points to the correct directory and that the presentation appears in `npx docusaurus slidev:list`. Also check that `@slidev/cli` is installed.

### Changes not reflected after file save

Confirm the file you edited is under `path` (see the watched file types above), then refresh the page. Config file changes (`docusaurus.config.ts`) require a manual restart of `docusaurus start`.

### Build fails in dev mode

Enable verbose output to see the full `slidev build` log:

```ts
{ verbose: true }
```

Check for missing themes or addons. Set `autoInstall: true` to let the plugin install them automatically, or pre-install them via your `package.json`.
