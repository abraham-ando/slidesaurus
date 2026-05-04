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
lastReviewed: 2026-04-01
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
| `pageTitle` | `"Presentations"` | Page heading |
| `pageTagline` | `""` | Page sub-heading |

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
  maxParallelBuilds: 4,  // Concurrent builds
  buildTimeout: 120,     // Seconds per build
  verbose: false,        // Quiet by default
}
```

**Tips:**
- Increase `maxParallelBuilds` on powerful machines
- Increase `buildTimeout` on slow CI
- Enable `verbose` to debug slow builds

---

# Auto-Install

```ts
{
  autoInstall: true,  // Default: enabled
}
```

When enabled, the plugin automatically runs `npm install` for any theme or addon package that isn't found in `node_modules`.

**Disable it** if you want strict control over dependencies:

```ts
{
  autoInstall: false,
}
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
  download: false,
  buildTimeout: 120,
  maxParallelBuilds: 4,
  verbose: false,
  autoInstall: true,
}
```

---

# Recap

- **Minimal config** — just `path` and `routeBasePath`
- **Themes/addons** — global defaults, per-file overrides
- **Performance** — tune parallel builds and timeouts
- **Multiple instances** — separate collections with unique IDs

Next: **Working with Presentations** →
