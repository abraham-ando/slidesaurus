---
sidebar_position: 5
---

# Themes & Addons

Slidev has a rich ecosystem of themes and addons. This plugin makes it easy to use them globally or on a per-presentation basis.

## How Themes Work

A Slidev theme is an npm package that provides custom layouts, styles, and components for your slides. The plugin resolves theme names using the same convention as Slidev:

| Shorthand | Resolved Package |
|---|---|
| `seriph` | `@slidev/theme-seriph` |
| `apple-basic` | `@slidev/theme-apple-basic` |
| `dracula` | `slidev-theme-dracula` |

The resolution order is:

1. `@slidev/theme-<name>` (official themes)
2. `slidev-theme-<name>` (community themes)

## Setting a Default Theme

Set the `theme` option in your plugin configuration to apply a theme to all presentations:

```ts title="docusaurus.config.ts"
plugins: [
  [
    "slidesaurus",
    {
      theme: "seriph",
    },
  ],
],
```

## Per-Presentation Theme Override

Override the default theme in a presentation's frontmatter:

```md title="slidev/my-talk.md"
---
title: My Talk
theme: apple-basic
---

# Slide 1
This presentation uses apple-basic instead of the default theme.
```

## Auto-Install

When `autoInstall` is enabled, the plugin detects missing theme packages and installs them automatically before building. This means you can reference any published theme without manually running `npm install`.

`autoInstall` is **disabled by default** — you must opt in explicitly. This prevents unexpected package installations in CI or production environments (OWASP A05 — Principle of Least Privilege).

```ts
{
  autoInstall: true,  // opt in: install missing themes/addons automatically
}
```

:::tip Pre-install for performance
For faster and more predictable builds, add themes and addons to `package.json` and keep `autoInstall: false`. This avoids network requests during the build hot path.
:::

## Addons

Addons extend Slidev with extra components or functionality (e.g., Excalidraw drawings, recording support).

### Default Addons

```ts
plugins: [
  [
    "slidesaurus",
    {
      addons: ["slidev-addon-excalidraw"],
    },
  ],
],
```

### Per-Presentation Addons

```md
---
title: Diagrams Talk
addons: [excalidraw]
---
```

Addons follow the same shorthand resolution and auto-install behavior as themes.

## Popular Themes

| Theme | Description |
|---|---|
| `seriph` | Clean, professional serif typography |
| `apple-basic` | Minimal Apple-style slides |
| `dracula` | Dark theme with Dracula color palette |
| `default` | The built-in Slidev default theme |
| `bricks` | Colorful, brick-like card layouts |

Browse more at [sli.dev/themes/gallery](https://sli.dev/themes/gallery).

## Popular Addons

| Addon | Description |
|---|---|
| `excalidraw` | Embed Excalidraw diagrams |
| `tldraw` | Embed tldraw whiteboard |

Browse more at [sli.dev/addons](https://sli.dev/addons).
