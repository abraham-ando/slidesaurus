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

1. Ensure `autoInstall: true` (the default).
2. Or install manually:

```bash
npm install @slidev/theme-seriph
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

## Still Stuck?

1. Enable verbose logging: `verbose: true`
2. Clear the Docusaurus cache: `npx docusaurus clear`
3. Delete `node_modules` and reinstall
4. Open an issue on [GitHub](https://github.com/abraham-ando/slidesaurus/issues)
