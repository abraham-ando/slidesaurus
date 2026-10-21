---
id: options
sidebar_position: 2
---

# Plugin Options

Full reference of all `slidesaurus` configuration options.

## Usage

```ts title="docusaurus.config.ts"
plugins: [
  [
    "slidesaurus",
    {
      // All options shown with their defaults
      path: "./slidev",
      routeBasePath: "/slidev",
      pageTitle: "Slidev Presentations",
      pageTagline: "Interactive presentation overview",
      theme: "unicorn",
      addons: [],
      download: false,
      buildTimeout: 120,
      verbose: false,
      maxParallelBuilds: 4,
      autoInstall: true,
    },
  ],
],
```

## Option Details

### `path`

- **Type:** `string`
- **Default:** `"./slidev"`

Path (relative to `siteDir`) to the directory containing your Slidev `.md` files.
Sub-folders become browsable categories.

---

### `routeBasePath`

- **Type:** `string`
- **Default:** `"/slidev"`

The URL prefix for the overview page and all presentation routes.

---

### `pageTitle`

- **Type:** `string`
- **Default:** `"Slidev Presentations"`

Title displayed on the overview page header.

---

### `pageTagline`

- **Type:** `string`
- **Default:** `"Interactive presentation overview"`

Subtitle displayed on the overview page.

---

### `theme`

- **Type:** `string`
- **Default:** `"unicorn"`

Default Slidev theme applied to all presentations. Can be overridden per-presentation in frontmatter.

Short names are resolved to npm packages:

- `"seriph"` → `@slidev/theme-seriph`
- `"unicorn"` → `slidev-theme-unicorn`
- `"./local"` → local path (used as-is)

---

### `addons`

- **Type:** `string[]`
- **Default:** `[]`

List of Slidev addons applied globally. Merged with per-presentation addons from frontmatter.

---

### `download`

- **Type:** `boolean`
- **Default:** `false`

When `true`, adds a PDF download button to each built presentation. Requires `playwright-chromium`.

---

### `buildTimeout`

- **Type:** `number`
- **Default:** `120`

Maximum build time (in seconds) allowed per presentation. Builds exceeding this are killed.

---

### `verbose`

- **Type:** `boolean`
- **Default:** `false`

When `true`, logs the full Slidev CLI command and output for each build. Useful for debugging.

---

### `maxParallelBuilds`

- **Type:** `number`
- **Default:** `4`

Maximum number of presentations built concurrently. Capped to available CPU cores.

---

### `autoInstall`

- **Type:** `boolean`
- **Default:** `true`

When `true`, automatically runs `npm install <package>` for any missing theme or addon before building.
