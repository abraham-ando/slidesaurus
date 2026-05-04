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
5. Thumbnails and `pdf`/`pptx` exports are generated under the same concurrency budget.
6. Built outputs are moved to the final cache, then copied into the Docusaurus static output during `postBuild`.

The orchestrator uses a bounded worker pool (`runConcurrently`) at every stage — hashing, isolated dir prep, builds, asset generation, cleanup — so the same concurrency cap applies end-to-end.

## Why concurrency is safe for `slidev build`

Unlike `slidev dev`, which spins up a Vite dev server on a TCP port, `slidev build` is a one-shot Rollup compile that writes to disk and exits. There is no shared port, no shared state. Each invocation runs in its own isolated directory with a per-presentation `--base /route/category/id/` flag — Vite embeds the correct absolute asset paths and outputs cannot collide.

Earlier versions of the plugin ran builds sequentially out of caution. The `EADDRINUSE` risk that justified that choice only ever applied to `slidev dev`, not `slidev build`.

## Configuration

```ts
{
  maxParallelBuilds: 4,   // Default: 4, capped at os.cpus().length
  buildTimeout: 120,      // Default: 120 seconds per presentation
}
```

The effective concurrency is `min(maxParallelBuilds, cpuCount)`. On a 2-vCPU CI runner with `maxParallelBuilds: 8`, you still only get 2 concurrent builds.

### Choosing `maxParallelBuilds`

| Scenario | Recommended value |
| --- | --- |
| CI with 2 vCPUs | `2` |
| Development laptop (4–8 cores) | `4` (default) |
| Build server (16+ cores) | `8`–`12` |
| Memory-constrained environments | `2`–`3` |

Each Slidev build spawns a Node.js process and a Vite/Rollup compile. Memory usage is roughly 200–400 MB per concurrent build, plus ~300 MB per Playwright instance when generating thumbnails or PDF/PPTX exports.

### Build Timeout

If a single presentation takes longer than `buildTimeout` seconds, it is killed and the build continues with the remaining presentations. The failed presentation logs a warning.

```ts
{
  buildTimeout: 300,  // 5 minutes for complex presentations
}
```

## Incremental cache

The plugin maintains a SHA-256 hash manifest under `.docusaurus/slidesaurus/{pluginId}/build-hashes.json`. A presentation is rebuilt only when:

- the source `.md` content changes, **or**
- the build options fingerprint changes — covering `theme`, `addons`, `download`, `exportFormats`, `exportWithClicks`, `withoutNotes`, and `baseUrl`.

If you change one of these options, every presentation is invalidated automatically — no manual cache clear needed.

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

### CI caching warning

If your CI pipeline caches the `.docusaurus/` directory between runs, stale build outputs may carry over and prevent presentations from rebuilding when their sources change. Either:

- exclude `.docusaurus/slidesaurus/` from the CI cache, or
- add `rm -rf .docusaurus/slidesaurus` as a step before the build.

### Failed presentation retry

A presentation that fails to build is **invalidated from the cache** immediately. The next `docusaurus build` run will retry it — no manual intervention is required.

## Isolated build directories

Each presentation builds in its own temporary directory under `.docusaurus/slidesaurus/{pluginId}/builds/`. This ensures:

- No shared state between builds.
- Theme and addon resolution for one presentation does not affect another.
- A failing build does not corrupt other output.

The isolated `.md` is renamed to a `safeId` (slashes replaced with `__`) so Slidev's per-file output folder is unique even when many files coexist in the same root.

## Theme and addon resolution caching

Within a single build run, `ensureThemeAvailable` and `ensureAddonsAvailable` are memoized per `(siteDir, packageName)`. If 50 presentations share the same theme, the resolver walks `node_modules` once — not 50 times. Auto-installs are also de-duplicated, so concurrent builds that discover the same missing addon converge on a single `npm install`.

The Slidev CLI binary lookup (`resolveSlidevBin`) is similarly cached per `siteDir` for the lifetime of the process.

## Performance Tips

1. **Reduce slide count** — split large decks into smaller presentations so concurrency has more leverage.
2. **Pre-install themes** — set `autoInstall: false` and install themes once via `package.json`. This avoids any `npm install` during the build hot path.
3. **Avoid heavy addons in many presentations** — addons increase per-deck startup time.
4. **Increase `buildTimeout` for CI** — slower CI runners may need `buildTimeout: 300` for complex decks.
5. **Tune `maxParallelBuilds` to your hardware** — too low underuses the machine; too high causes memory pressure and contention. The default `4` is a sane starting point on most laptops.

## Build summary and speedup comparison

After each build run, the plugin prints a summary that includes a comparison against the equivalent sequential time:

```text
[slidesaurus] Slidev build complete — 8 presentation(s)
  Built:   6  (6 ok, 0 failed)
  Cached:  2
  Time:    42.30s (3.8x faster than sequential 161.2s)
```

The **sequential equivalent** is the sum of every individual build duration. The **speedup factor** is `sequentialTime / parallelTime` and appears when there is a measurable gain (i.e. when parallel time is strictly shorter than sequential time). A factor of `3.8x` means the 6 presentations together took 42 s instead of the 161 s they would have taken one after the other.

When all presentations are served from cache (nothing to build), no speedup line is printed — there is nothing to compare.

## Verbose output

Enable `verbose: true` to stream the full `slidev build` output for each presentation, which helps diagnose slow or failing builds:

```ts
{
  verbose: true,
}
```

Note that with high concurrency, verbose logs interleave between presentations. For a clean trace of a single deck, set `maxParallelBuilds: 1` and rebuild that one file.
