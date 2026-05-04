# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Slidesaurus** is a Docusaurus v3 plugin that integrates [Slidev](https://sli.dev) presentations into Docusaurus sites. It auto-discovers `.md` slide decks, builds them in parallel with incremental caching, serves them via iframe, and provides embeddable React components.

This is a **pnpm monorepo** managed with **Turbo**:
- `packages/slidesaurus` — the `slidesaurus` npm package (TypeScript, built with Rollup)
- `apps/docs` — documentation site (Docusaurus, port 3001)
- `apps/sample` — sample integration site (Docusaurus, port 3000)

---

## Commands

### Root (run from repo root)

```bash
pnpm build              # Build all packages in dependency order
pnpm build:plugin       # Build only the plugin package
pnpm dev:sample         # Dev server for sample app (port 3000)
pnpm dev:docs           # Dev server for docs site (port 3001)
pnpm clean              # Remove all build artifacts
```

### Plugin package (`packages/slidesaurus`)

```bash
pnpm build              # Rollup build → lib/ (CJS + ESM + .d.ts)
pnpm dev                # Rollup watch mode
pnpm test               # Vitest unit tests
pnpm test:integration   # Cucumber BDD integration tests
pnpm clean              # Remove lib/
```

### Run a single test

```bash
# From packages/slidesaurus — filter by filename
pnpm test -- scanner
pnpm test -- --reporter=verbose src/__tests__/builder.spec.ts

# Single Cucumber feature
pnpm test:integration -- features/scanning.feature
```

> **Note:** `pnpm build:plugin` must run before `pnpm dev:sample` or `pnpm dev:docs` because Turbo requires the plugin to be built first (declared in `turbo.json` `dependsOn`).

---

## Architecture

### Plugin lifecycle

The plugin implements the standard Docusaurus plugin interface (`packages/slidesaurus/src/index.ts`):

1. **`validateOptions`** — Joi schema validation; maps deprecated option aliases (e.g. `sourceDir` → `path`).
2. **`loadContent`** — Scans slides, then either builds (production) or starts dev servers.
3. **`contentLoaded`** — Creates Docusaurus routes (overview, category pages, presentation pages) and injects global data for theme components.
4. **`postBuild`** — Copies built presentations from the incremental cache into the final static output.

### Core modules (`packages/slidesaurus/src/`)

| Module | Responsibility |
|---|---|
| `scanner.ts` | Recursively discovers `.md` files in the configured `path`, reads `_category_.yml` for category metadata, extracts frontmatter via `gray-matter`, applies `transformFrontmatter` / `onPresentationScanned` hooks |
| `builder.ts` | Parallel build orchestration; SHA-256 hashes each file + options fingerprint for incremental caching; skips unchanged presentations; calls `buildRunner` per presentation |
| `buildRunner.ts` | Spawns `slidev build` CLI as a child process, handles timeouts, captures stdout/stderr |
| `devServer.ts` | Spawns one `slidev dev` process per presentation; allocates ports from `devServerBasePort` (default 8600); returns webpack proxy config to route `/slidev/{id}/*` to the right port |
| `packageResolver.ts` | Resolves theme shorthand (e.g. `"seriph"` → `"@slidev/theme-seriph"`), validates package names, auto-installs missing themes/addons |
| `fileSystem.ts` | Manages the incremental cache under `.docusaurus/slidesaurus/{pluginId}/`: hash manifest (`build-hashes.json`), per-presentation output dirs, isolated build dirs |
| `env.ts` | Filters environment variables passed to child processes — blocks secrets/tokens by allowlist |
| `types.ts` | All shared TypeScript types: `PluginOptions`, `PresentationMetadata`, `ScanResult`, `BuildContext` |

### Theme components (`packages/slidesaurus/theme/`)

React components exposed for Docusaurus swizzling:
- `SlidevOverview` — landing page listing all presentations and categories
- `SlidevPresentation` — individual presentation viewer (iframe)
- `SlidevCard` / `SlidevCategoryCard` — thumbnail cards
- `SlidevLink` / `SlidevListItem` — embeddable preview utilities

### Incremental cache

Stored in `.docusaurus/slidesaurus/{pluginId}/`:
```
output/{presentationId}/   ← Slidev static build (index.html, assets/)
builds/                    ← Temporary isolated build dirs (cleaned after build)
build-hashes.json          ← SHA-256 hash manifest
```

A presentation is rebuilt only when its hash (file content + relevant options) changes.

### Build output (`packages/slidesaurus/lib/`)

Rollup produces two passes:
- **Pass 1:** CJS (`index.cjs`) + ESM (`index.mjs`) with source maps
- **Pass 2:** Bundled type declarations (`index.d.ts`, `index.d.mts`)

External dependencies (not bundled): Node built-ins, `@docusaurus/*`, `gray-matter`, `js-yaml`.

---

## Tests

- **Unit tests:** Vitest, in `packages/slidesaurus/src/__tests__/*.spec.ts`. Globals disabled — import `describe`, `it`, `expect`, `vi` explicitly. Logger is mocked via `vi.mock("../logger", ...)`.
- **Integration tests:** Cucumber BDD, in `packages/slidesaurus/features/`. Feature files + step definitions test presentation discovery, category handling, and option validation end-to-end.
- Vitest config: `packages/slidesaurus/vitest.config.ts` — root `./src`, timeout 15 s.

---

## Documentation

Any change to `packages/slidesaurus` (options, hooks, types, behaviour, theme components) must be reflected in `apps/docs/docs/`. The docs site is the user-facing reference — keep it in sync with the code.

Key doc files to update depending on what changed:

| Changed area | Doc file(s) to update |
|---|---|
| Plugin options (`PluginOptions`) | `options.md` |
| Frontmatter fields | `frontmatter.md` |
| Categories / `_category_.yml` | `categories.md` |
| Theme components (`SlidevCard`, `SlidevLink`, …) | `slidev-card.md`, `slidev-link.md` |
| Overview / presentation pages | `overview-page.md`, `presentation-page.md` |
| Hooks (`transformFrontmatter`, `onBuildComplete`, …) | `plugin-api.md` |
| TypeScript types | `types.md` |
| Parallel builds / caching | `parallel-builds.md` |
| Themes & addons | `themes-addons.md` |

---

## Key conventions

- **TypeScript strict mode** throughout the plugin package.
- **Plugin ID** (`pluginId` option, defaults to `"default"`) namespaces the cache and supports multi-instance setups.
- **Environment filtering** (`env.ts`) is intentional security: only an explicit allowlist of env vars is passed to child Slidev processes.
- **Package name validation** rejects non-scoped names that don't start with `slidev-theme-` or `slidev-addon-` and scoped names that don't match `@*/slidev-theme-*` / `@*/slidev-addon-*`.
- **Dev server proxy:** in `docusaurus start`, each presentation gets its own Slidev dev server; webpack proxies `/slidev/{id}/*` to the correct localhost port.
