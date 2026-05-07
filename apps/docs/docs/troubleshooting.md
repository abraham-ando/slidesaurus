---
sidebar_position: 14
---

# Troubleshooting

Common issues and their solutions.

## Slidev CLI Not Found

**Error:** `slidev: command not found` or `Cannot find module '@slidev/cli'`

**Cause:** The Slidev CLI is a peer dependency and must be installed in your project.

**Solution:**

```bash
npm install -D @slidev/cli
```

If using a monorepo, ensure `@slidev/cli` is installed in the workspace root or in the same workspace as your Docusaurus site.

---

## Build Timeout

**Error:** `Build timed out after 120 seconds`

**Cause:** A presentation is too large or the build environment is slow.

**Solution:** Increase the `buildTimeout` option:

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

1. **Dev mode** — presentations are only built during `docusaurus build`, not `docusaurus start`. Run a full build first.
2. **Build failed silently** — enable `verbose: true` to see build output.
3. **Wrong base path** — ensure the `routeBasePath` matches the path configured in the plugin.

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
2. Files have valid frontmatter with at least a `title` field.
3. The `path` option points to the correct directory relative to the site root.
4. Files are not inside nested directories without a `_category_.yml` (they should still be discovered, but verify the directory structure).

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

1. The file has a YAML frontmatter block with at least a `title` field at the very top of the file.
2. The file extension is `.md` (not `.mdx` or `.txt`).
3. You ran `npm run build` or restarted `npm start` — the scanner only re-runs on a fresh `loadContent` cycle.
4. The `path` option in `docusaurus.config.ts` points to the directory that **contains** the file. Run `slidesaurus list` to see what the plugin actually discovered.

---

## Frontmatter Validation Warning

**Symptom:** A metadata field is ignored or missing from the card even though it is in frontmatter.

**Cause:** The field value failed validation and was silently discarded.

**Solution:** Check your terminal output for lines like:

```
[WARN] [Slidev Plugin] "level" is invalid for "intro/my-talk": expected one of beginner, intermediate, advanced — ignoring.
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

**Cause:** `download: true` requires `@playwright/test` to be installed.

**Solution:**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Then verify the setup with:

```bash
slidesaurus doctor
```

The doctor check will report `✗ Playwright browser not found` if the browser binary is missing.

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

4. **SSR specificity** — Some CSS Module class names are hashed; they cannot be targeted from global CSS. Use CSS custom property tokens (`--slidev-card-*`) instead of trying to target internal class names. See [Custom Styling](./custom-styling.md).

---

## Still Stuck?

1. Enable verbose logging: `verbose: true`
2. Clear the Docusaurus cache: `npx docusaurus clear`
3. Delete `node_modules` and reinstall
4. Open an issue on [GitHub](https://github.com/abraham-ando/slidesaurus/issues)
