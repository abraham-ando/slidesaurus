---
title: Configuration Deep Dive
description: Explore every configuration option with practical examples
theme: seriph
author: Training Team
tags: [configuration, options]
date: 2026-01-15
position: 1
level: intermediate
owner: Documentation Team
duration: 30
lastReviewed: 2026-05-07
playlist: Deep Dive Track
---

# Configuration Deep Dive

Master every plugin option.

---

# Where Options Go

```ts
// docusaurus.config.ts
plugins: [
  [
    "slidesaurus",
    {
      // ← all options go here
    },
  ],
],
```

All options have sensible defaults — you only set what you need.

---

# Path and Routing

```ts
{
  path: "./slidev",              // Where .md files live
  routeBasePath: "/presentations", // URL prefix
  pageTitle: "Slide Decks",       // Overview page heading
  pageTagline: "Browse our talks", // Sub-heading
}
```

| Option | Default | Purpose |
|---|---|---|
| `path` | `"./slidev"` | Source directory |
| `routeBasePath` | `"/slidev"` | URL base |
| `pageTitle` | `"Slidev Presentations"` | Page heading |
| `pageTagline` | `"Interactive presentation overview"` | Page sub-heading |

---

# Theme and Addons

```ts
{
  theme: "seriph",
  addons: ["excalidraw"],
}
```

- **`theme`** — sets the default Slidev theme for all presentations
- **`addons`** — adds functionality like Excalidraw diagrams
- Both can be overridden per-presentation in frontmatter

---

# Build Performance

```ts
{
  // Defaults to os.cpus().length - 1 (one less than your CPU count)
  maxParallelBuilds: 4,
  buildTimeout: 120,  // Seconds per build
  verbose: false,     // Quiet by default
}
```

**Tips:**
- `maxParallelBuilds` auto-detects your CPU count — only override for CI
- Increase `buildTimeout` on slow CI runners
- Enable `verbose` to debug slow or failing builds

---

# Auto-Install

```ts
{
  autoInstall: false,  // Default: disabled
}
```

`autoInstall` is **off by default**. You must explicitly opt in. When enabled, the plugin runs `npm install` for any missing theme or addon package.

**Pre-install themes instead** — it is faster and safer for CI:

```bash
npm install @slidev/theme-seriph
```

---

# Download Button

```ts
{
  download: true,
}
```

Adds a download button to each presentation page. The button triggers `slidev export` to generate a PDF.

Default: `false`

---

# UI Theme

Control the visual layout of the overview page:

```ts
{
  uiTheme: "default",   // Built-in: "default" | "compact" | "minimal"
}
```

| Value | Effect |
|---|---|
| `"default"` | Full cards with thumbnail, title, description |
| `"compact"` | Smaller cards, description hidden |
| `"minimal"` | Text-only list, no thumbnails |
| `"glass"` *(custom)* | Any string sets `data-slidev-ui-theme` for CSS targeting |

---

# Dev Server Options

```ts
{
  devServerBasePort: 8600,  // Starting port for Slidev dev servers
  devServerTimeout: 60000,  // ms to wait for a server to become ready
}
```

Each presentation gets its own port: `basePort + index`.
Use distinct ranges when running multiple plugin instances.

---

# Multiple Instances

Run two separate sets of presentations:

```ts
plugins: [
  [
    "slidesaurus",
    {
      id: "talks",
      path: "./talks",
      routeBasePath: "/talks",
      pageTitle: "Conference Talks",
    },
  ],
  [
    "slidesaurus",
    {
      id: "workshops",
      path: "./workshops",
      routeBasePath: "/workshops",
      pageTitle: "Workshop Materials",
    },
  ],
],
```

Each instance must have a unique `id`.

---

# Full Example

```ts
{
  path: "./slidev",
  routeBasePath: "/presentations",
  pageTitle: "Presentations",
  pageTagline: "Browse all slide decks",
  theme: "seriph",
  addons: [],
  uiTheme: "default",
  download: false,
  buildTimeout: 120,
  maxParallelBuilds: 4,   // Defaults to os.cpus().length - 1
  verbose: false,
  autoInstall: false,     // Disabled by default — opt in explicitly
  devServerBasePort: 8600,
  devServerTimeout: 60000,
}
```

---

# Recap

- **Minimal config** — just `path` and `routeBasePath`
- **Themes/addons** — global defaults, per-file overrides
- **UI theme** — built-in layouts or custom CSS via `uiTheme`
- **Performance** — parallel builds auto-sized to CPU count
- **autoInstall** — disabled by default, opt in for CI-free setup
- **Multiple instances** — separate collections with unique IDs

Next: **Working with Presentations** →
