---
sidebar_position: 3
---

# Quick Start

Get a presentation running inside your Docusaurus site in under 5 minutes.

:::note Prerequisites
Node.js 18+, an existing Docusaurus v3 project, and `@slidev/cli` installed.
Not set up yet? Follow the [Installation guide](./installation.md) first.
:::

## 1. Install and configure

```bash
npm install slidesaurus
```

Add the plugin to `docusaurus.config.ts`:

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

## 2. Create a presentation

```bash
mkdir -p slidev
```

Create `slidev/my-talk.md`:

```md title="slidev/my-talk.md"
---
title: My First Talk
description: A quick demo of slidesaurus
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

# Thank You

Questions?
```

## 3. Start the dev server

```bash
npm start
```

Navigate to `/presentations`. You will see the **overview page** showing a card for *My First Talk* — click it to view the full presentation in an iframe.

:::tip What you're seeing
The **overview page** is the auto-generated index of all your presentations. It includes a search bar, tag/level filters, and switches between grid and list views. See [Overview Page](./overview-page.md) for the full feature list.
:::

## 4. Build for production

```bash
npm run build
npm run serve
```

The production build compiles every presentation with `slidev build` and bundles the output into the Docusaurus static site.

## 5. Embed a preview in a doc page

Use `SlidevLink` to embed a scaled-down preview of any presentation inside an MDX page:

```mdx title="docs/my-page.mdx"
import SlidevLink from "@theme/SlidevLink";

<SlidevLink link="/presentations/my-talk" />
```

`link` must match the URL of the presentation as it appears in your browser. See [SlidevLink](./slidev-link.md) for all props.

## Adding categories

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

See [Categories](./categories.md) for the complete reference.

## Next Steps

- [Options](./options.md) — full configuration reference.
- [Frontmatter](./frontmatter.md) — all available per-presentation metadata fields.
- [Categories](./categories.md) — deep dive into the category system.
- [Playlists](./playlists.md) — define ordered sequences of presentations.
