---
title: Getting Started with Slidev
description: A quick introduction to Slidev and this Docusaurus plugin
author: Demo Author
theme: seriph
tags:
  - slidev
  - intro
  - docusaurus
position: 1
---

# Getting Started with Slidev

A presentation integrated into Docusaurus via **slidesaurus**

---

## What is Slidev?

Slidev is a presentation tool built for developers.

- 📝 **Markdown-based** — write slides in `.md` files
- 🎨 **Themeable** — hundreds of community themes
- ⚡ **Fast** — powered by Vite + Vue 3
- 🧩 **Extensible** — addons for diagrams, animations, and more

---

## Plugin Features

The `slidesaurus` plugin lets you:

1. Drop `.md` files in a folder
2. They automatically appear in the overview page
3. Organize them into categories using sub-folders
4. Embed preview cards in any MDX document

---

## File Structure

```
your-docusaurus-site/
├── slidev/
│   ├── intro/
│   │   └── getting-started.md  ← this file
│   └── advanced/
│       └── deep-dive.md
├── docs/
└── docusaurus.config.ts
```

---

## Configuration

```ts
// docusaurus.config.ts
plugins: [
  [
    "slidesaurus",
    {
      path: "./slidev",
      routeBasePath: "/presentations",
      theme: "default",
    },
  ],
],
```

---

## Embedding in MDX

```mdx
import SlidevLink from "@theme/SlidevLink";

## My Presentation

<SlidevLink link="/presentations/intro/getting-started" />
```

---

## Thank You!

Visit `/presentations` to browse all presentations.

> Built with ❤️ using Slidev + Docusaurus
