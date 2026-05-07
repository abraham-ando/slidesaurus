---
title: Introduction to slidesaurus
description: Learn what the plugin does and why you need it
theme: seriph
author: Training Team
tags: [introduction, overview]
date: 2026-01-01
position: 1
level: beginner
owner: Documentation Team
duration: 15
lastReviewed: 2026-05-07
playlist: Getting Started Track
---

# Introduction to slidesaurus

Welcome to the training!

Learn how to seamlessly integrate Slidev presentations into your Docusaurus documentation site.

---

# What is Slidev?

- Presentation framework built for developers
- Write slides in **Markdown**
- Syntax highlighting, LaTeX math, diagrams
- Themes, transitions, and animations
- Built on **Vue.js** + **Vite** for instant HMR

> "Developer-friendly slides as code"

---

# What is Docusaurus?

- Static site generator by Meta (Facebook)
- Designed for **documentation** websites
- MDX support, versioning, i18n
- Rich plugin ecosystem
- Used by React, Jest, Babel, and many more

---

# The Problem

You have **docs** in Docusaurus and **presentations** in Slidev.

That means:

- Two repositories
- Two build pipelines
- Two deployments
- Readers need to switch between sites

---

# The Solution

**slidesaurus** brings them together:

- Drop `.md` presentation files into a `slidev/` directory
- They are auto-discovered and built alongside your docs
- Accessible from your Docusaurus navbar
- Single build, single deployment

---

# Key Features

| Feature | Benefit |
|---|---|
| Auto-Discovery | No manual registration per file |
| Parallel Builds | Fast builds with SHA-256 incremental cache |
| Theme Support | Official and community Slidev themes |
| Categories | Organize decks into logical groups |
| Playlists | Sequential navigation across presentations |
| UI Themes | Built-in layouts + custom CSS theming |
| Embeddable | Preview slides inside doc pages with `SlidevLink` |

---

# Architecture Overview

```
Your Docusaurus Site
├── docs/           → Documentation pages
├── slidev/         → Presentation .md files
│   ├── intro.md
│   ├── tutorials/
│   │   ├── _category_.yml
│   │   └── basics.md
│   └── advanced/
│       ├── _category_.yml
│       └── deep-dive.md
└── docusaurus.config.ts
```

The plugin scans `slidev/`, builds each deck, and registers routes.

---

# Before and After

**Before the plugin:**

- Maintain docs site + separate slides repo
- Share links to external slide hosting
- Slides go stale, links break

**After the plugin:**

- Everything lives together
- One `npm run build` compiles all
- Presentations are first-class citizens of your site

---

# What You'll Learn

1. **Installation** — adding the plugin to a Docusaurus project
2. **Configuration** — all available options
3. **Creating Presentations** — Markdown, frontmatter, categories
4. **Embedding** — using `<SlidevLink>` in doc pages
5. **Theming** — changing the look of your slides
6. **Best Practices** — tips for production use

---

# Next Steps

Continue to the **Installation Guide** to set up the plugin in your project.

📖 Documentation: `/docs/intro`
