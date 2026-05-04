---
sidebar_position: 2
---

# Installation

This guide walks you through adding `slidesaurus` to an existing Docusaurus site.

## Prerequisites

- Node.js **18+**
- An existing Docusaurus v3 project
- A package manager: npm, pnpm, or yarn

## 1. Install the Package

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="npm" label="npm">

```bash
npm install slidesaurus
```

</TabItem>
<TabItem value="pnpm" label="pnpm">

```bash
pnpm add slidesaurus
```

</TabItem>
<TabItem value="yarn" label="yarn">

```bash
yarn add slidesaurus
```

</TabItem>
</Tabs>

:::info Monorepo?
If the plugin lives in the same monorepo, use a workspace reference instead:
```json
"slidesaurus": "workspace:*"
```
:::

## 2. Add to Docusaurus Config

Open `docusaurus.config.ts` and add the plugin:

```ts title="docusaurus.config.ts"
const config: Config = {
  // ...existing config
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

That is the minimal configuration. See [Options](./options.md) for the full list.

## 3. Create the Slidev Directory

```bash
mkdir slidev
```

## 4. Add Your First Presentation

Create a Markdown file inside the directory:

```bash
touch slidev/hello-world.md
```

```md title="slidev/hello-world.md"
---
title: Hello World
description: My first Slidev presentation
---

# Hello World

This is my first slide!

---

# Second Slide

Powered by slidesaurus.
```

## 5. Start the Dev Server

```bash
npm start
```

Navigate to `/presentations` to see the overview page, then click your presentation.

## 6. Build for Production

```bash
npm run build
```

The plugin runs `slidev build` for every presentation during the Docusaurus build and copies the output into the final site.

## What's Next?

- [Quick Start](./quick-start.md) — a complete walkthrough with a richer example.
- [Themes & Addons](./themes-addons.md) — add visual flair to your slides.
