---
id: intro
sidebar_position: 1
---

# 🦕 Introduction

`slidesaurus` integrates [Slidev](https://sli.dev) presentations directly into your Docusaurus site.

## How it works

1. You create Slidev presentations as `.md` files inside a directory (default: `./slidev`)
2. The plugin scans that directory at build time
3. Each presentation is compiled using the Slidev CLI into a standalone SPA
4. The compiled output is served under `/presentations/<id>`
5. A browsable overview page lists all presentations with live previews

## Quick Start

### 1. Install the plugin

```bash
npm install slidesaurus @slidev/cli
```

### 2. Register the plugin

```ts title="docusaurus.config.ts"
plugins: [
  [
    "slidesaurus",
    {
      path: "./slidev",
      routeBasePath: "/presentations",
    },
  ],
],
```

### 3. Create a presentation

```md title="slidev/my-first-slide.md"
---
title: My First Slide
description: A quick intro
author: Your Name
---

# My First Slide

Hello from Docusaurus!

---

## Slide 2

- Point A
- Point B
```

### 4. Build and serve

```bash
npm run build
npm run serve
```

Navigate to `http://localhost:3000/presentations` to see the overview.

:::tip Development mode
In `npm run start` (dev mode), the plugin detects that Slidev builds are not available and shows a placeholder.
Presentations are only fully rendered after `npm run build`.
:::
