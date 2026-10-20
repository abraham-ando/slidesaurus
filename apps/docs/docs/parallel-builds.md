---
sidebar_position: 12
---

# Parallel Builds

The plugin builds multiple Slidev presentations concurrently during `docusaurus build` to reduce total build time. Each presentation runs in its own isolated build directory and produces its own static output.

## How It Works

1. The scanner discovers all `.md` files and their metadata.
2. File hashes are computed in parallel and compared against the cache manifest. Unchanged presentations are skipped.
3. For everything that needs rebuilding, an isolated build directory is prepared (frontmatter patched, co-located assets copied).
4. Up to `maxParallelBuilds` presentations are built simultaneously by separate `slidev build` processes.
5. Each build writes to a temporary directory, and the cached output is replaced atomically only on success — if a build fails, the previous output (if any) is kept. The thumbnail is then rendered from the built output, and `pdf`/`pptx` exports are generated from the isolated copy of the deck (see [Thumbnails](#thumbnails)).
6. Outputs of deleted or renamed decks, and partial builds, are purged from the cache.
7. All of this happens in `loadContent`; during `postBuild` the cached outputs are simply copied into the Docusaurus static output.

The orchestrator uses a bounded worker pool (`runConcurrently`) for hashing and builds, so the same concurrency cap applies end-to-end.

## Why concurrency is safe for `slidev build`

Unlike `slidev dev`, which spins up a Vite dev server on a TCP port, `slidev build` is a one-shot Rollup compile that writes to disk and exits. There is no shared port, no shared state. Each invocation runs in its own isolated directory with a per-presentation `--base /route/category/id/` flag — Vite embeds the correct absolute asset paths and outputs cannot collide.

Earlier versions of the plugin ran builds sequentially out of caution. The `EADDRINUSE` risk that justified that choice only ever applied to `slidev dev`, not `slidev build`.

## Configuration

```ts
{
  // Default: min(cpus - 1, free memory in GiB), at least 1
  maxParallelBuilds: 4,
  buildTimeout: 120,  // Default: 120 seconds per presentation
}
```

The default is `min(os.cpus().length - 1, floor(os.freemem() / 1 GiB))`, at least `1`: one fewer than the number of logical CPUs (leaving one core free for Docusaurus and the OS), and no more builds than the free memory can hold — each `slidev build` peaks at about 1 GB. On an 8-core machine with 16 GB free this is `7`; on a 20-core machine with only 4 GB free it is `4`. Oversubscribing memory is the main cause of builds that all time out together.

The default is exported as `defaultMaxParallelBuilds()`, which helps when several sites are built **at the same time** (for example a monorepo built by Turbo): each site computes its own concurrency, so share the budget instead of letting each take all of it:

```ts title="docusaurus.config.ts"
import { defaultMaxParallelBuilds } from "slidesaurus";

// Two sites are built in parallel: each takes half of the machine.
maxParallelBuilds: Math.max(1, Math.floor(defaultMaxParallelBuilds() / 2)),
```

The option accepts values from 1 to 64, and the effective concurrency is additionally capped at the number of CPUs — setting `maxParallelBuilds: 64` on a 4-core machine runs at most 4 builds at once.

### Choosing `maxParallelBuilds`

| Scenario | Recommended value |
| --- | --- |
| CI with 2 vCPUs | the default (`1`) |
| Development laptop (4–8 cores) | the default |
| Build server (16+ cores) | `8`–`12` |
| Memory-constrained environments | `2`–`3` |

Each Slidev build spawns a Node.js process and a Vite/Rollup compile. Memory usage peaks at roughly 1 GB per concurrent build (measured on a small deck with `@slidev/cli` 52). Thumbnails share a single headless Chromium (~300 MB); each PDF/PPTX export starts its own.

### Build Timeout

If a single presentation takes longer than `buildTimeout` seconds, the Slidev process **and its child processes** are killed and the presentation is reported as failed; the remaining presentations keep building. In `docusaurus build`, the failure then fails the site build with a message listing every failed presentation; in `docusaurus start` it is only logged. Slidev is spawned without a shell, so the timeout reliably stops the whole process tree.

```ts
{
  buildTimeout: 300,  // 5 minutes for complex presentations
}
```

## Incremental cache

The plugin maintains a SHA-256 hash manifest under `.docusaurus/slidesaurus/{id}/build-hashes.json` (for non-default locales: `.docusaurus/slidesaurus/{id}/i18n/{locale}/`). A presentation is rebuilt only when its **fingerprint** changes. The fingerprint covers everything that influences the output:

- the content of the `.md` file;
- the files it depends on: co-located assets and Slidev folders (`components/`, `styles/`, `setup/`, `layouts/`, `public/`, `pages/`…), Markdown imported with `src:` sections, and relative assets referenced from the Markdown (e.g. `./img.png` or `../shared/logo.png`, as long as they stay inside the `path` directory). Files larger than 2 MB are fingerprinted by size and modification time instead of content;
- the installed versions of `@slidev/cli`, of the theme and of every addon;
- the build options: `theme`, `addons`, `download`, `exportFormats`, `exportWithClicks`, `withoutNotes` and `baseUrl`;
- the deck URL (base) and its metadata **after** the `transformFrontmatter` / `onPresentationScanned` hooks.

If any of these change, only the affected presentations are rebuilt — no manual cache clear needed.

:::note One-time full rebuild after upgrading
The hash format changed when the fingerprint was extended, so the first build after upgrading the plugin rebuilds every presentation once.
:::

Failures to generate **optional assets** (thumbnail, PDF/PPTX export — typically because Playwright is not installed) are recorded as `BuildResult.warnings`; they do not invalidate the cache, so a missing Playwright does not trigger a rebuild on every run.

### Cache hits in `onBuildComplete`

The `BuildResult` type exposes a `cacheHit` field you can use to distinguish presentations that were skipped from those that were actually rebuilt:

```ts
onBuildComplete: (results) => {
  const built  = results.filter((r) => !r.cacheHit);
  const cached = results.filter((r) =>  r.cacheHit);
  console.log(`Built: ${built.length}, cached: ${cached.length}`);
},
```

### Forcing a full rebuild

Delete the cache directory to invalidate all hashes:

```bash
rm -rf .docusaurus/slidesaurus
```

Or use the built-in CLI command:

```bash
slidesaurus cache clear
```

### Caching in CI

The cache is safe to persist between CI runs: every deck is fingerprinted (see above), so a restored cache only skips the decks whose inputs did not change. Persisting it turns a cold build of every deck into a build of the changed decks only. With GitHub Actions:

```yaml title=".github/workflows/ci.yml"
- name: Restore Slidev build cache
  uses: actions/cache@v6
  with:
    path: .docusaurus/slidesaurus
    key: slidesaurus-${{ runner.os }}-${{ hashFiles('slidev/**', 'pnpm-lock.yaml') }}
    # An older cache is fine: the plugin rebuilds only what changed.
    restore-keys: |
      slidesaurus-${{ runner.os }}-
```

The key only decides when a new cache entry is saved; correctness comes from the plugin's fingerprint. Cache `.docusaurus/slidesaurus/` only — not the whole `.docusaurus/` directory, which Docusaurus regenerates. To force a full rebuild, run `slidesaurus cache clear` (or `rm -rf .docusaurus/slidesaurus`) before the build.

### Failed presentation retry

A presentation that fails to build is **invalidated from the cache** immediately. The next `docusaurus build` run will retry it — no manual intervention is required. Because outputs are replaced atomically, a failed rebuild never leaves a half-written output behind.

## Isolated build directories

Each presentation builds in its own temporary directory under `.docusaurus/slidesaurus/{id}/builds/`, containing a copy of the deck and its dependencies. Your source directory is never modified (the `.slidev/` and `dist/` folders you may have there are left untouched). This ensures:

- No shared state between builds.
- Theme and addon resolution for one presentation does not affect another.
- A failing build does not corrupt other output.

The isolated `.md` is renamed to a `safeId` (slashes replaced with `__`) so Slidev's per-file output folder is unique even when many files coexist in the same root.

## Thumbnails

The card thumbnail (`thumbnail.png`, first slide) is rendered **from the built output**, not with `slidev export`: the plugin serves the deck's output directory on a loopback port under its `--base` and screenshots slide 1 at 1280×720 in a headless Chromium. One browser is launched per build run and shared by every deck; it is closed when the run ends. A thumbnail takes a few seconds, instead of the ~1 minute (and frequent timeouts) of `slidev export`, which compiles the whole deck again in a Vite dev server.

Before the builds start, the plugin checks once that `playwright-chromium` can be resolved from the site directory and that its Chromium starts. If not, all thumbnails are skipped with a single warning that says what to install (`npm install -D playwright-chromium`, then `npx playwright install chromium`); the cards then fall back to their placeholder. PDF/PPTX exports (`download: true`) still use `slidev export` and are skipped the same way when Playwright is missing.

## Theme and addon resolution caching

Within a single build run, `ensureThemeAvailable` and `ensureAddonsAvailable` are memoized per `(siteDir, packageName)`. If 50 presentations share the same theme, the resolver walks `node_modules` once — not 50 times. Auto-installs are also de-duplicated, so concurrent builds that discover the same missing addon converge on a single install.

The Slidev CLI lookup is similarly cached per `siteDir` for the lifetime of the process. The plugin runs the CLI JavaScript entry point with Node directly (no shell, no `.bin` shim).

## Performance Tips

1. **Reduce slide count** — split large decks into smaller presentations so concurrency has more leverage.
2. **Pre-install themes** — keep `autoInstall: false` (the default) and install themes once via `package.json`. This avoids any package installation during the build hot path.
3. **Avoid heavy addons in many presentations** — addons increase per-deck startup time.
4. **Increase `buildTimeout` for CI** — slower CI runners may need `buildTimeout: 300` for complex decks.
5. **Tune `maxParallelBuilds` to your hardware** — too low underuses the machine; too high causes memory pressure and contention. The default (CPU count − 1, capped by free memory) is a sane starting point; only override it when you have a measured reason to, or when several sites build at the same time.

## Build summary and speedup comparison

After each build run, the plugin prints a summary that includes a comparison against the equivalent sequential time:

```text
[slidesaurus] Slidev build complete — 8 presentation(s)
  Built:   6  (6 ok, 0 failed)
  Cached:  2
  Time:    42.30s (3.8x faster than sequential 161.2s)
  Asset warnings: 1 presentation(s)
```

The **sequential equivalent** is the sum of every individual build duration. The **speedup factor** is `sequentialTime / parallelTime` and appears when there is a measurable gain (i.e. when parallel time is strictly shorter than sequential time). A factor of `3.8x` means the 6 presentations together took 42 s instead of the 161 s they would have taken one after the other.

The `Asset warnings` line only appears when a thumbnail or export could not be generated. When all presentations are served from cache (nothing to build), the summary is replaced by a single "up-to-date" message — there is nothing to compare.

## Verbose output

Enable `verbose: true` to stream the full `slidev build` output for each presentation, which helps diagnose slow or failing builds:

```ts
{
  verbose: true,
}
```

Note that with high concurrency, verbose logs interleave between presentations. For a clean trace of a single deck, set `maxParallelBuilds: 1` and rebuild that one file.
