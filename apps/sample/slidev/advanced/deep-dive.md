---
title: Plugin Configuration Deep Dive
description: All options explained with practical examples
author: Demo Author
theme: seriph
tags:
  - config
  - advanced
position: 1
---

# Plugin Configuration Deep Dive

All `slidesaurus` options explained

---

## Required Option: `path`

```ts
{
  path: "./slidev",   // directory relative to siteDir
}
```

The plugin scans this directory **recursively** for `.md` files.

- Supports nested sub-folders → categories
- Ignores files/folders starting with `.` or `_`
- Ignores `node_modules` and `sections`

---

## Routing: `routeBasePath`

```ts
{
  routeBasePath: "/presentations",  // default: "/slidev"
}
```

Controls the base URL of the overview page and all sub-routes:

| Route | Content |
|---|---|
| `/presentations` | Overview (all categories + root presentations) |
| `/presentations/intro` | Category "intro" |
| `/presentations/intro/getting-started` | Single presentation |

---

## Themes & Addons

```ts
{
  theme: "default",        // global theme
  addons: ["excalidraw"],  // global addons
}
```

Per-presentation override via **frontmatter**:

```md
---
theme: seriph
addons:
  - excalidraw
  - mermaid
---
```

> Short names are automatically resolved to npm package names.

---

## Performance Options

```ts
{
  maxParallelBuilds: 4,  // defaults to CPU count
  buildTimeout: 120,     // seconds per presentation
  autoInstall: true,     // npm install missing themes/addons
}
```

---

## Option Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | `string` | `"./slidev"` | Source directory |
| `routeBasePath` | `string` | `"/slidev"` | URL prefix |
| `pageTitle` | `string` | `"Slidev Presentations"` | Overview page title |
| `pageTagline` | `string` | `"Interactive presentation overview"` | Overview subtitle |
| `theme` | `string` | `"unicorn"` | Default Slidev theme |
| `addons` | `string[]` | `[]` | Global Slidev addons |
| `download` | `boolean` | `false` | Add PDF download button |
| `buildTimeout` | `number` | `120` | Per-build timeout (seconds) |
| `verbose` | `boolean` | `false` | Enable verbose CLI output |
| `maxParallelBuilds` | `number` | `4` | Max concurrent builds |
| `autoInstall` | `boolean` | `true` | Auto-install missing packages |

---

## That's All!

For more examples, browse the source code on GitHub.
