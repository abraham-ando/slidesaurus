---
title: Slidev Theming Guide
description: How to use and customise Slidev themes in Docusaurus
author: Demo Author
theme: seriph
tags:
  - themes
  - styling
position: 2
---

# Slidev Theming Guide

Customising the look of your presentations

---

## Available Themes

**Official themes** (`@slidev/theme-*`):
- `seriph` — clean, professional
- `apple-basic` — minimal, Apple-inspired
- `bricks` — bold, geometric

**Community themes** (`slidev-theme-*`):
- `default` — simple, neutral
- `unicorn` — colorful, playful
- `academic` — academic / research style

---

## Setting a Theme

### Global (all presentations)

```ts
// docusaurus.config.ts
{
  theme: "seriph",
}
```

### Per-presentation (frontmatter)

```md
---
theme: unicorn
---
```

> Per-presentation overrides the global setting.

---

## Theme Resolution

Short names are resolved automatically:

| Input | Resolved Package |
|-------|-----------------|
| `seriph` | `@slidev/theme-seriph` |
| `unicorn` | `slidev-theme-unicorn` |
| `./my-theme` | Local path (used as-is) |
| `@org/slidev-theme-x` | Full name (used as-is) |

---

## Auto-Install

With `autoInstall: true`, the plugin runs:

```bash
npm install slidev-theme-unicorn
```

...automatically if the theme is not yet in `node_modules`.

---

## Thank You!
