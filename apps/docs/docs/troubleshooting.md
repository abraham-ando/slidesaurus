---
sidebar_position: 14
---

# Troubleshooting

Common issues and their solutions.

## Slidev CLI Not Found

**Error:** `slidev: command not found` or `Cannot find module '@slidev/cli'`

**Cause:** `@slidev/cli` is an optional peer dependency — the plugin does not install it for you, and without it no presentation is built (a warning is logged).

**Solution:**

```bash
npm install -D @slidev/cli
```

If using a monorepo, ensure `@slidev/cli` is installed in the workspace root or in the same workspace as your Docusaurus site.

---

## Build Timeout

**Error:** `Build timed out after 120 seconds`

**Cause:** A presentation is too large, the build environment is slow, or too many builds run at once. Each `slidev build` peaks at about 1 GB of memory: when concurrent builds exceed the free memory, every build swaps and they all time out together. This also happens when several sites are built at the same time (a monorepo built by Turbo), since each site computes its own concurrency.

**Solution:** Lower `maxParallelBuilds` (the default already caps it by free memory — see [Parallel Builds](./parallel-builds.md#configuration)), or increase the `buildTimeout` option:

```ts
{
  buildTimeout: 300,  // 5 minutes
}
```

You can also enable `verbose: true` to see where the build gets stuck.

---

## Theme Not Found

**Error:** `Cannot find theme 'xyz'` or `ENOENT: no such file or directory`

**Cause:** The theme npm package is not installed.

**Solution:**

1. Install the theme manually:

```bash
npm install @slidev/theme-seriph
```

2. Or enable auto-install (disabled by default):

```ts
{ autoInstall: true }
```

Check the theme name spelling. Official themes use `@slidev/theme-*`, community themes use `slidev-theme-*`.

---

## Blank Iframe

**Symptom:** The presentation page shows an empty or white iframe.

**Possible causes:**

1. **`@slidev/cli` not installed** — nothing is built. Check the terminal for the warning and run `slidesaurus doctor`.
2. **Build failed** — in `docusaurus start` a failed build is only logged. Enable `verbose: true` to see the Slidev output.
3. **`dryRun: true`** — builds are skipped, so there is nothing to show.
4. **Wrong base URL** — presentations embed the site `baseUrl` at build time. If you changed `baseUrl` or `routeBasePath`, rebuild (the cache detects the change automatically).
5. **Stale cache from CI** — see [CI caching warning](./parallel-builds.md#ci-caching-warning).

Presentations are built in `docusaurus start` too (and served as static files) — see [Dev Server](./dev-server.md).

---

## Build Fails With "N Slidev presentation(s) failed to build"

**Cause:** In `docusaurus build`, any presentation that fails makes the whole build fail, so a broken deck never ships as a missing page. The error lists every failed presentation with the first line of its error (timeout, missing theme or addon, Slidev error…).

**Solution:** Fix the listed presentations (re-run with `verbose: true` for the complete Slidev output). In `docusaurus start`, the same failures are only logged.

---

## Route Collision

**Error:** `Slidev presentation route collision(s)` (`PresentationCollisionError`)

**Cause:** Two presentations would be served from the same place: `foo.md` next to a `foo/` directory that contains other decks, or file names that only differ by case (`Intro.md` and `intro.md`).

**Solution:** Rename one of the files or directories.

---

## Thumbnails or Exports Missing

**Symptom:** Cards show a live iframe instead of a thumbnail, or the download button leads to a missing file. The build log shows an "Asset warnings" line.

**Cause:** Thumbnail and PDF/PPTX generation need Playwright (`playwright-chromium`) and its Chromium browser. Before building, the plugin checks once that both are available; when they are not, it logs a **single** warning saying what to install and skips every thumbnail (and export) — the presentations themselves are fine.

- `Thumbnails skipped: playwright-chromium is not installed` — the package cannot be resolved from the site directory.
- `Thumbnails skipped: Chromium for Playwright could not be started` — the package is installed but its browser was not downloaded (common in CI, or when install scripts are disabled).

**Solution:**

```bash
npm install -D playwright-chromium
npx playwright install chromium
```

Thumbnails are rendered from the already built presentation (served locally to a single headless Chromium shared by all decks), so they take a few seconds each. Asset failures do not invalidate the cache: after installing Playwright, run `slidesaurus cache clear` (or edit the deck) so the cached decks are rebuilt with their thumbnails.

---

## Webpack Conflicts in Monorepos

**Error:** `Module not found` or duplicate React/webpack issues.

**Cause:** Multiple copies of React or webpack are resolved from different `node_modules`.

**Solutions:**

1. **Hoist dependencies** — in pnpm, add to `.npmrc`:

```ini title=".npmrc"
shamefully-hoist=true
```

2. **Deduplicate React** — ensure only one version of `react` and `react-dom` is installed:

```bash
npm ls react
```

3. **Webpack aliases** — add to your Docusaurus config:

```ts title="docusaurus.config.ts"
webpack: {
  configure: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve('./node_modules/react'),
    };
    return config;
  },
},
```

---

## Presentations Not Discovered

**Symptom:** The overview page is empty.

**Checklist:**

1. Files are `.md` format and located in the `path` directory (default: `./slidev`).
2. Frontmatter is optional; without a `title`, the file name is used.
3. The `path` option points to the correct directory relative to the site root.
4. Files and directories starting with `.` or `_`, `node_modules` and `sections/` are ignored. Symlinks are not followed.
5. Nested directories are fine without a `_category_.yml` — the label is derived from the directory name.

---

## Port Conflicts

**Error:** `Port 3000 is already in use`

**Solution:** Use a different port:

```bash
npx docusaurus start --port 3001
```

Or configure it in your `package.json` scripts:

```json
"start": "docusaurus start --port 3001"
```

---

## Presentation Does Not Appear After Adding It

**Symptom:** A new `.md` file was added to the `slidev/` directory but the card never shows on the overview page.

**Checklist:**

1. If you use frontmatter, it is valid YAML at the very top of the file (`---js` frontmatter is refused).
2. The file extension is `.md` (not `.mdx` or `.txt`), and its path has no segment starting with `.` or `_`.
3. You ran `npm run build` or restarted `npm start` — the scanner only re-runs on a fresh `loadContent` cycle.
4. The `path` option in `docusaurus.config.ts` points to the directory that **contains** the file. Run `slidesaurus list` to see what the plugin actually discovered.

---

## Frontmatter Validation Warning

**Symptom:** A metadata field is ignored or missing from the card even though it is in frontmatter.

**Cause:** The field value failed validation and was discarded (with a warning).

**Solution:** Check your terminal output for lines like:

```
[WARN] Invalid "level": must be one of beginner, intermediate, advanced in intro/my-talk.md
```

Common mistakes:

| Field | Valid | Invalid |
|---|---|---|
| `level` | `beginner`, `intermediate`, `advanced` | `"hard"`, `"easy"` |
| `date` | `2026-03-15` | `15/03/2026`, `"March 2026"` |
| `deprecated` | `true`, `false` | `"yes"`, `1` |
| `duration` | `45` | `"45 min"`, `-5` |

Enable `verbose: true` to see full validation output during a build.

---

## Download / Export Not Generated

**Symptom:** The download button is missing, or the PDF/PPTX file is not created.

**Cause:** `download: true` requires Playwright. When `playwright-chromium` is missing, every export is skipped with a single warning (checked once before the build).

**Solution:**

```bash
npm install -D playwright-chromium
npx playwright install chromium
```

Then verify the setup with `slidesaurus doctor`, which reports whether `playwright-chromium` is resolvable from your project.

---

## Custom Styles Not Applying

**Symptom:** CSS overrides in `custom.css` have no visible effect on plugin components.

**Possible causes and fixes:**

1. **Wrong selector** — CSS custom properties must be on `:root` (or `[data-theme="dark"]` for dark mode), not on class names:

```css
/* ✅ Correct */
:root { --slidev-card-radius: 12px; }

/* ❌ Wrong — custom properties are consumed by the component, not applied here */
.slidev-card { --slidev-card-radius: 12px; }
```

2. **Import order** — Ensure `custom.css` (or your theme file) is imported **after** any Docusaurus default stylesheets. Docusaurus automatically places `custom.css` last, so this is usually not an issue unless you are using `@import` chains.

3. **Custom uiTheme not matching** — If you wrote CSS targeting `[data-slidev-ui-theme="glass"]` but the plugin option is `uiTheme: "default"`, no element will ever carry the `glass` attribute. Confirm the `uiTheme` option in `docusaurus.config.ts`.

4. **SSR specificity** — Some CSS Module class names are hashed; they cannot be targeted from global CSS. Use CSS custom property tokens (`--slidev-card-*`) or the `data-slidev-ui-theme` attribute instead of trying to target internal class names. Do not rely on an `a` tag for card roots — they are `<div>` elements. See [Custom Styling](./custom-styling.md).

---

## Auto-Install Refuses a Package

**Error:** `Invalid Slidev theme package …` / `Invalid Slidev addon package …`

**Cause:** `autoInstall` only installs packages named like Slidev themes/addons (`slidev-theme-*`, `@slidev/theme-*`, `@scope/slidev-theme-*`, and the same for addons). Anything else — including `@org/some-addon` — is refused.

**Solution:** Install the package yourself, or rename it to follow the convention. See [Themes & Addons](./themes-addons.md#auto-install).

---

## Still Stuck?

1. Enable verbose logging: `verbose: true`
2. Clear the Docusaurus cache: `npx docusaurus clear`
3. Delete `node_modules` and reinstall
4. Open an issue on [GitHub](https://github.com/abraham-ando/slidesaurus/issues)
