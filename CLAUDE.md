# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Slidesaurus** is a Docusaurus v3 plugin that integrates [Slidev](https://sli.dev) presentations into Docusaurus sites. It auto-discovers `.md` slide decks, builds them in parallel with incremental caching, serves them via iframe, and provides embeddable React components.

This is a **pnpm monorepo** (pnpm 10, Node >= 22.12; dev version Node 24 LTS in `.nvmrc`) managed with **Turbo**:

- `packages/slidesaurus` — the `slidesaurus` npm package (TypeScript, built with Rollup)
- `apps/docs` — documentation site (Docusaurus, port 3001)
- `apps/sample` — sample integration site (Docusaurus, port 3000)

---

## Commands

### Root (run from repo root)

```bash
pnpm build              # Build all packages in dependency order
pnpm build:plugin       # Build only the plugin package
pnpm watch:plugin       # Rollup watch of the plugin (run next to dev:docs / dev:sample)
pnpm dev:sample         # Dev server for sample app (port 3000)
pnpm dev:docs           # Dev server for docs site (port 3001)
pnpm lint               # ESLint
pnpm format             # Prettier (write)
pnpm format:check       # Prettier (check only)
pnpm typecheck          # tsc for the plugin (src) and the theme
pnpm test               # Unit tests
pnpm clean              # Remove all build artifacts
```

### Plugin package (`packages/slidesaurus`)

```bash
pnpm build              # Rollup build → lib/ (CJS + ESM + .d.ts + compiled theme)
pnpm watch              # Rollup watch mode (not `dev`: `turbo run dev` already builds the plugin once)
pnpm typecheck          # tsc --noEmit (src) + tsc (theme)
pnpm test               # Vitest unit tests
pnpm test:integration   # Cucumber BDD integration tests
pnpm clean              # Remove lib/
```

### Run a single test

```bash
# From packages/slidesaurus — filter by filename
pnpm test -- scanner
pnpm test -- --reporter=verbose src/application/__tests__/builder.spec.ts

# Single Cucumber feature
pnpm test:integration -- features/scanning.feature
```

> **Note:** `pnpm dev:sample` / `pnpm dev:docs` build the plugin first (`turbo.json` `dependsOn: ["^build"]`, cached by Turbo). The plugin has no `dev` script on purpose — a `rollup --watch` started by `turbo run dev` would compile it a second time; run `pnpm watch:plugin` yourself when working on the plugin. Turbo caches `lib/**` (plugin) and `build/**` (sites) only — never `.docusaurus/` (the Slidev cache).

---

## Architecture

### Plugin lifecycle

The plugin implements the standard Docusaurus plugin interface (`src/presentation/plugin.ts`, re-exported by `src/index.ts`):

1. **`validateOptions`** — Joi schema validation; maps deprecated aliases (`sourceDir` → `path`, `overviewPath` → `routeBasePath`, …); rejects unsafe `path`, `routeBasePath` and `id`.
2. **`loadContent`** — Scans slides, then **builds** them (incremental, parallel). In `docusaurus build` it waits for the builds and a failed presentation fails the build (`PresentationBuildError`). In `docusaurus start` the builds run **in the background** (`BackgroundBuildQueue`, one run at a time per cache dir) and `loadContent` returns at once; progress is written to `status/build-status.json` (`BuildStatusTracker`), published as `PluginData.buildStatusUrl` and polled by `SlidevPresentation`.
3. **`contentLoaded`** — Registers routes (overview, category pages, presentation pages) and a reduced public global-data DTO for theme components (no absolute paths).
4. **`postBuild`** — Copies built presentations from the cache into the final static output, writes presenter fallbacks and `presentations-index.json`.

In `docusaurus start` there are no Slidev dev servers: `configureWebpack` serves the cache output (and the status dir under `{routeBase}/__slidesaurus__/`) as static files, unwatched, and `getPathsToWatch` triggers rebuilds. `getThemePath()` points to the compiled theme (`lib/theme`); `getTypeScriptThemePath()` to the TSX sources (swizzle `--typescript`).

### Source layers (`packages/slidesaurus/src/`)

Dependencies point inwards: `presentation`/`cli` → `application` → `infrastructure` → `domain`; `shared` is usable by all.

| Layer                      | Key modules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/`                  | `types.ts` (`PluginOptions`, `PresentationMetadata`, `BuildResult`, `BuildContext`…), `interfaces.ts` (`ICache`, `IAssetPostProcessor`, `ICliCommand`), `constants.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `application/`             | `scanner.ts` (discovery, `_category_.*`, frontmatter, `PresentationCollisionError`), `builder.ts` (parallel orchestration, atomic output replace, `PresentationBuildError`), `buildCache.ts` (incremental fingerprint), `frontmatterValidator.ts` (validation, `---js` refused, addon/theme patching)                                                                                                                                                                                                                                                                                                                             |
| `infrastructure/fs/`       | `fileSystem.ts` (cache dirs, hashing), `dependencies.ts` (files a deck depends on — drives both the isolated copy and the hash), `isolatedBuild.ts`, `iconCollections.ts` (links / empty `@iconify-json/*` in the isolated dir so Slidev's icon lookups stop walking `node_modules`), `hashManifest.ts`, `outputManager.ts` (cache output, orphan purge, final copy), `buildStatus.ts` (dev build status file), `fsUtils.ts`                                                                                                                                                                                                      |
| `infrastructure/process/`  | `buildRunner.ts` (spawn `slidev build` without shell, kill process tree on timeout), `assetGenerator.ts` (`SharedBrowser`: one Chromium per run, thumbnails rendered from the built output; PDF = the file `slidev build --download` printed, hard-linked as `export.pdf`, re-printed from the built output by the shared browser when `exportWithClicks` is set; PPTX via `slidev export`; Playwright checked once, failures are warnings), `pdfRenderer.ts` (`/print` → `page.pdf()`, headmatter export settings), `playwright.ts` (optional `playwright-chromium` loader), `staticServer.ts` (loopback server of a built deck) |
| `infrastructure/packages/` | `packageResolver.ts` (theme/addon shorthand, strict name validation, shell-free `--ignore-scripts` auto-install), `env.ts` (env allowlist for child processes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `presentation/`            | `plugin.ts` (lifecycle), `routeBuilder.ts`, `cliCommands.ts` (`slidev:list                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | stats | validate`), `webpackConfig.ts` (dev static serving) |
| `shared/`                  | `logger.ts`, `utils.ts`, `concurrentRunner.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `cli/`                     | Standalone `slidesaurus` binary (`lib/cli.cjs`): `new`, `list`, `doctor`, `cache clear`; `config.ts` loads `docusaurus.config.{ts,js,mjs}` through jiti in a child process                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Theme components (`packages/slidesaurus/theme/`)

React components (TSX sources; compiled to `lib/theme` by `scripts/build-theme.mjs` during the Rollup build):

- `SlidevOverview` — landing page (accepts `children` rendered inside the Layout)
- `SlidevPresentation` — presentation viewer (iframe, resume bar, playlist bar, SEO tags; in dev, "building"/"failed" state and iframe reload via `useBuildStatus`)
- `SlidevCard` / `SlidevCategoryCard` / `SlidevListItem` — cards and rows (root `div` + stretched `.cardLink::after`)
- `SlidevLink` — embeddable inline preview (`link` is given without `baseUrl`)
- `SlidevIframe` — shared iframe wrapper owning the single sandbox policy `SLIDEV_IFRAME_SANDBOX`

Swizzlable list (`getSwizzleComponentList`): `SlidevOverview`, `SlidevCard`, `SlidevListItem`, `SlidevCategoryCard`, `SlidevPresentation`.

### Incremental cache

Stored in `.docusaurus/slidesaurus/{id}/` (non-default locales: `.../{id}/i18n/{locale}/`):

```
output/{presentationId}/   ← Slidev static build (index.html, assets/)
builds/                    ← Temporary isolated build dirs (cleaned after build)
status/build-status.json   ← Dev build status (docusaurus start only, never published)
build-hashes.json          ← Hash manifest
```

A presentation is rebuilt only when its fingerprint changes: `.md` content, dependency files (co-located Slidev folders, `src:` sections, referenced assets), `@slidev/cli`/theme/addon versions, build options + `baseUrl`, URL, and metadata after hooks.

### Build output (`packages/slidesaurus/lib/`)

Rollup produces two passes plus the compiled theme:

- **Pass 1:** `index.cjs` + `index.mjs` (with source maps) and `cli.cjs`; the theme is compiled to `lib/theme/`
- **Pass 2:** bundled type declarations (`index.d.cts`, `index.d.mts`)

External dependencies (not bundled): Node built-ins, `@docusaurus/*`, `gray-matter`, `js-yaml`.

### TypeScript toolchain (TypeScript 7)

`typescript` is **TypeScript 7** (native compiler) in the plugin and the apps. TS 7.0 ships **no JS compiler API**, so:

- `tsc` (TS 7) only type-checks (`pnpm typecheck`); nothing in the build type-checks.
- Rollup transpiles `src/` with **esbuild** (`rollup-plugin-esbuild`); Cucumber loads step definitions with **tsx** (`tsx/cjs`).
- Tools that still need the TS API use the TS 6 compatibility package **`@typescript/typescript6`**: `rollup-plugin-dts` (automatic fallback), `scripts/build-theme.mjs` (`transpileModule`, keeps comments in the compiled theme for swizzling), and `typescript-eslint` (the root `typescript` dependency is an alias to `@typescript/typescript6`).
- The plugin tsconfig uses `module: ESNext` + `moduleResolution: bundler` + `isolatedModules` (sources are bundled; each file is transpiled on its own). The apps unset the `baseUrl` inherited from `@docusaurus/tsconfig` (removed in TS 7) and redeclare `paths`.
- When TS 7.1 ships its new API and the tools support it, drop `@typescript/typescript6` and the root alias.

---

## Tests

- **Unit tests:** Vitest, in `packages/slidesaurus/src/**/__tests__/*.spec.ts`. Globals disabled — import `describe`, `it`, `expect`, `vi` explicitly. The logger is mocked by mocking the `shared/logger` module (`vi.mock("../../shared/logger", ...)`).
- **Integration tests:** Cucumber BDD, in `packages/slidesaurus/features/`. Feature files + step definitions test presentation discovery, category handling, and option validation end-to-end.
- Vitest config: `packages/slidesaurus/vitest.config.ts` — root `./src`, timeout 15 s.
- CI (`.github/workflows/ci.yml`): ubuntu + windows × Node 22/24/26 (typecheck, unit + integration tests; only ubuntu + Node 22 builds the sites, with an `actions/cache` of the Slidev cache), plus a pack & smoke job on Node 22/24/26 (tarball contents, `require`/`import`, CLI binary).

---

## Documentation

Any change to `packages/slidesaurus` (options, hooks, types, behaviour, theme components) must be reflected in `apps/docs/docs/`. The docs site is the user-facing reference — keep it in sync with the code.

Key doc files to update depending on what changed:

| Changed area                                                     | Doc file(s) to update                      |
| ---------------------------------------------------------------- | ------------------------------------------ |
| Plugin options (`PluginOptions`)                                 | `options.md`                               |
| Frontmatter fields                                               | `frontmatter.md`                           |
| Categories / `_category_.yml`                                    | `categories.md`                            |
| Playlists                                                        | `playlists.md`                             |
| Theme components (`SlidevCard`, `SlidevLink`, …)                 | `slidev-card.md`, `slidev-link.md`         |
| Overview / presentation pages                                    | `overview-page.md`, `presentation-page.md` |
| CSS tokens, `uiTheme`, swizzling                                 | `custom-styling.md`                        |
| Hooks (`transformFrontmatter`, `onBuildComplete`, …) / lifecycle | `plugin-api.md`                            |
| TypeScript types                                                 | `types.md`                                 |
| Parallel builds / caching                                        | `parallel-builds.md`                       |
| Themes & addons                                                  | `themes-addons.md`                         |
| `slidesaurus` CLI                                                | `cli.md`                                   |
| `docusaurus start` behaviour                                     | `dev-server.md`                            |

---

## Key conventions

- **TypeScript strict mode** throughout the plugin package.
- **Plugin instance ID** (`id` option, defaults to `"default"`) namespaces the cache and supports multi-instance setups. It is used as a directory name, so it is validated (letters, digits, `_`, `-`).
- **Environment filtering** (`infrastructure/packages/env.ts`) is intentional security: only an explicit allowlist of env vars is passed to child processes.
- **No shell**: Slidev and the package manager are spawned with `execFile`/`spawn` without a shell; timeouts kill the whole process tree.
- **Package name validation** only accepts `slidev-theme-*`, `@slidev/theme-*`, `@scope/slidev-theme-*` (and the `addon` equivalents); auto-install is opt-in (`autoInstall`, default `false`) and runs with `--ignore-scripts`.
- **Public data only**: never put absolute paths, hooks or build options in Docusaurus global data (see `toPublicPluginData` in `routeBuilder.ts`).
- **Never evaluate user JS in frontmatter**: always parse through `parseFrontmatter` (refuses `---js`).
