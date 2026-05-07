---
title: Installation Guide
description: Step-by-step guide to installing and configuring the plugin
theme: seriph
author: Training Team
tags: [installation, setup]
date: 2026-01-01
position: 2
level: beginner
owner: Documentation Team
duration: 20
lastReviewed: 2026-05-07
playlist: Getting Started Track
---

# Installation Guide

Set up slidesaurus in your Docusaurus project.

---

# Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** installed
- An existing **Docusaurus v3** project
- A package manager: npm, pnpm, or yarn

```bash
node --version   # v18.0.0 or later
npx docusaurus --version   # 3.x
```

---

# Step 1: Install the Package

```bash
# npm
npm install slidesaurus

# pnpm
pnpm add slidesaurus

# yarn
yarn add slidesaurus
```

For monorepos, use a workspace reference:

```json
"slidesaurus": "workspace:*"
```

---

# Step 2: Add to Config

```ts
// docusaurus.config.ts
const config: Config = {
  plugins: [
    [
      "slidesaurus",
      {
        path: "./slidev",
        routeBasePath: "/presentations",
      },
    ],
  ],
};
```

That's the minimal setup — two lines of config!

---

# Step 3: Create the Directory

```bash
mkdir slidev
```

This is where all your presentation Markdown files will live.

---

# Step 4: Add a Presentation

Create `slidev/hello.md`:

```md
---
title: Hello World
description: My first presentation
---

# Hello World

This is my first slide!

---

# Slide Two

It works!
```

---

# Step 5: Build and Run

```bash
# Development (presentations are built via slidev build, then served statically)
npm start

# Production build (same pipeline, output bundled into Docusaurus static site)
npm run build
npm run serve
```

Navigate to `/presentations` to see your overview page.

---

# Verify It Works

You should see:

1. An **overview page** at `/presentations` with a card for "Hello World"
2. Click the card to open the **presentation page**
3. The presentation renders in an iframe with slide navigation

If something went wrong, check the [Troubleshooting](../docs/troubleshooting) guide.

---

# What's Next?

Now that the plugin is installed, learn how to:

- **Configure** all available options
- **Create** rich presentations with frontmatter
- **Organize** decks into categories

Continue to the **Configuration** training module.
