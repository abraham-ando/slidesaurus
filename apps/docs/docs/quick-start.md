---
sidebar_position: 3
---

# Quick Start

Get a presentation running inside your Docusaurus site in under 5 minutes.

## 1. Install

```bash
npm install slidesaurus
```

## 2. Configure

```ts title="docusaurus.config.ts"
plugins: [
  [
    "slidesaurus",
    {
      path: "./slidev",
      routeBasePath: "/presentations",
      theme: "seriph",
      pageTitle: "Presentations",
      pageTagline: "Browse all slide decks",
    },
  ],
],
```

## 3. Create a Presentation

```bash
mkdir -p slidev
```

Create `slidev/my-talk.md`:

```md title="slidev/my-talk.md"
---
title: My First Talk
description: A quick demo of slidesaurus
theme: seriph
author: Your Name
tags: [demo, intro]
date: 2026-01-15
position: 1
---

# My First Talk

Welcome to the presentation!

---

# Why This Plugin?

- Co-locate docs and slides
- One build, one deployment
- Auto-discovery of new decks

---

# Code Example

```ts
plugins: [
  ["slidesaurus", { path: "./slidev" }],
];
```

Configuration is minimal.

---

# Live Preview

Embed a preview anywhere with `<SlidevLink>`:

```tsx
import { SlidevLink } from "slidesaurus/theme/SlidevLink";

<SlidevLink title="My First Talk" route="/presentations/my-talk" />
```

---

# Thank You

Questions?
```

## 4. Start the Dev Server

```bash
npm start
```

Open your browser and navigate to `/presentations`. You will see the overview page with a card for **My First Talk**. Click it to view the full presentation.

## 5. Build for Production

```bash
npm run build
npm run serve
```

The production build compiles every presentation with `slidev build` and bundles the output into the Docusaurus static site.

## Adding Categories

Organize presentations into groups by creating subdirectories with a `_category_.yml` file:

```
slidev/
  tutorials/
    _category_.yml      # label: Tutorials, position: 1
    intro.md
    advanced.md
  workshops/
    _category_.yml      # label: Workshops, position: 2
    react-workshop.md
```

```yaml title="slidev/tutorials/_category_.yml"
label: Tutorials
position: 1
description: Step-by-step tutorial decks
```

## Next Steps

- [Options](./options.md) — full configuration reference.
- [Frontmatter](./frontmatter.md) — all available per-presentation fields.
- [Categories](./categories.md) — deep dive into the category system.
