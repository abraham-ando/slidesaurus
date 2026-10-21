---
sidebar_position: 5
---

# Themes & Addons

Slidev has a rich ecosystem of themes and addons. This plugin makes it easy to use them globally or on a per-presentation basis.

## How Themes Work

A Slidev theme is an npm package that provides custom layouts, styles, and components for your slides. The plugin resolves theme names using the same convention as Slidev:

| Shorthand     | Resolved Package            |
| ------------- | --------------------------- |
| `seriph`      | `@slidev/theme-seriph`      |
| `apple-basic` | `@slidev/theme-apple-basic` |
| `dracula`     | `slidev-theme-dracula`      |

The resolution order is:

1. `@slidev/theme-<name>` (official themes)
2. `slidev-theme-<name>` (community themes)

## Setting a Default Theme

The `theme` option has **no built-in default**. Without it, each presentation uses the theme declared in its own frontmatter, or the built-in default theme of Slidev. Set the option to apply a theme to every presentation that does not declare one:

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

When `autoInstall` is enabled, the plugin detects missing theme packages and installs them automatically before building. This means you can reference a published theme without manually installing it first.

`autoInstall` is **disabled by default** — you must opt in explicitly. This prevents unexpected package installations in CI or production environments (OWASP A05 — Principle of Least Privilege).

```ts
{
  autoInstall: true,  // opt in: install missing themes/addons automatically
}
```

Auto-install is deliberately conservative:

- Only packages that follow the Slidev naming convention are accepted: themes `slidev-theme-*`, `@slidev/theme-*` or `@scope/slidev-theme-*`; addons `slidev-addon-*`, `@slidev/addon-*` or `@scope/slidev-addon-*`. Anything else (including `@org/some-addon`) is refused.
- The package manager (pnpm, yarn or npm, detected from your lockfile) is run **without a shell** and with lifecycle scripts disabled (`--ignore-scripts`), with a 5-minute timeout and a filtered environment.
- Local paths (`./my-theme`) are never installed and must stay inside the project directory.

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

Addons follow the same shorthand resolution (`excalidraw` → `slidev-addon-excalidraw`; `@scope/…` names are kept as is) and auto-install behavior as themes. The addon list of a deck is the union of the global `addons` option and its frontmatter `addons`; the resolved list **replaces** the frontmatter value in the isolated build copy, so an addon is never loaded twice.

## Popular Themes

| Theme         | Description                           |
| ------------- | ------------------------------------- |
| `seriph`      | Clean, professional serif typography  |
| `apple-basic` | Minimal Apple-style slides            |
| `dracula`     | Dark theme with Dracula color palette |
| `default`     | The built-in Slidev default theme     |
| `bricks`      | Colorful, brick-like card layouts     |

Browse more at [sli.dev/themes/gallery](https://sli.dev/themes/gallery).

## Popular Addons

| Addon        | Description               |
| ------------ | ------------------------- |
| `excalidraw` | Embed Excalidraw diagrams |
| `tldraw`     | Embed tldraw whiteboard   |

Browse more at [sli.dev/addons](https://sli.dev/addons).
