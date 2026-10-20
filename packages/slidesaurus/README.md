# 🦕 slidesaurus

> **Slidesaurus transforme les présentations Slidev d'artefacts isolés en contenu first-class du site Docusaurus — découvrables, embarquables, déployables avec le reste de la doc, sans configuration ni glue code.**

[![npm version](https://img.shields.io/npm/v/slidesaurus)](https://www.npmjs.com/package/slidesaurus)
[![license](https://img.shields.io/npm/l/slidesaurus)](../../LICENSE)

Le plugin Docusaurus v3 qui intègre vos **présentations [Slidev](https://sli.dev)** dans votre site Docusaurus — auto-discovery, builds parallèles, cache incrémental, composants embarquables. **Zéro glue code.**

---

## ⚡ TL;DR

```bash
npm install slidesaurus @slidev/cli
```

```ts title="docusaurus.config.ts"
plugins: [
  ["slidesaurus", { path: "./slidev", routeBasePath: "/presentations" }],
],
```

Drop un `.md` Slidev dans `./slidev/`. Lancez `docusaurus start`. **C'est en ligne.**

---

## 🎯 Pour les développeurs

| Avantage | Concrètement |
|---|---|
| 🔍 **Auto-discovery** | Drop un `.md`, il apparaît. Pas de config par présentation. |
| ⚡ **Builds parallèles + cache** | Hash SHA-256 par fichier, seul le modifié se rebuild. |
| 🔄 **Dev sans serveur Slidev** | `docusaurus start` construit les decks (cache incrémental) et les sert en statique — ni port, ni proxy, ni HMR Slidev. |
| 🎨 **Composants embarquables** | `<SlidevLink>`, `<SlidevCard>` directement utilisables en MDX. |
| 📦 **Auto-install (opt-in)** | `autoInstall: true` installe les thèmes/addons manquants (noms Slidev stricts, sans scripts). Désactivé par défaut. |
| 🗂️ **Catégories** | Organisation par sous-dossiers + `_category_.yml`. |
| 🔌 **Hooks** | `transformFrontmatter`, `onPresentationScanned`, `onBuildComplete`. |
| 🧩 **Multi-instance** | Plusieurs collections (`talks/`, `trainings/`) via l'option `id`. |

---

## 📦 Installation

```bash
# npm
npm install slidesaurus @slidev/cli

# pnpm
pnpm add slidesaurus @slidev/cli

# yarn
yarn add slidesaurus @slidev/cli
```

**Prérequis** : Docusaurus v3, Node.js ≥ 22.12.

`@slidev/cli` est une **peer dependency optionnelle** — Slidev compile les présentations, le plugin orchestre. Installez-le dans votre projet : sans lui, aucune présentation n'est construite (un avertissement est affiché).

Le package fournit aussi la CLI `slidesaurus` (`new`, `list`, `doctor`, `cache clear`) — voir la [doc CLI](../../apps/docs/docs/cli.md).

---

## ⚙️ Configuration dans Docusaurus

```ts title="docusaurus.config.ts"
import type { Config } from "@docusaurus/types";

const config: Config = {
  title: "My Project",
  url: "https://example.com",
  baseUrl: "/",

  plugins: [
    [
      "slidesaurus",
      {
        // Dossier des présentations Slidev
        path: "./slidev",

        // URL de base (défaut: "/slidev")
        routeBasePath: "/presentations",

        // Thème Slidev global, optionnel (résolution courte: "seriph" → "@slidev/theme-seriph")
        // Sans valeur : thème du frontmatter de chaque deck, sinon thème par défaut de Slidev
        theme: "seriph",

        // Addons globaux
        addons: [],

        // Builds parallèles (défaut: nombre de CPU − 1, min. 1)
        maxParallelBuilds: 4,

        // Auto-installer les thèmes/addons manquants (défaut: false — opt-in)
        autoInstall: false,

        // Page d'overview
        pageTitle: "Mes présentations",
        pageTagline: "Toutes mes slides au même endroit",
      },
    ],
  ],
};

export default config;
```

### Première présentation

```md title="slidev/intro.md"
---
title: Introduction
theme: seriph
author: Jane Doe
tags: [intro, getting-started]
---

# Welcome 👋

Une présentation Slidev complète, intégrée à Docusaurus.

---

## Slide 2

- Markdown standard
- Code highlight
- Animations Slidev

---

## Slide 3

C'est tout, vraiment.
```

```bash
npx docusaurus start
```

→ Visitez **http://localhost:3000/presentations**

---

## 🎨 Composants à embarquer dans vos pages MDX

```mdx title="docs/chapter-1.mdx"
import SlidevLink from '@theme/SlidevLink';

# Chapitre 1

Pour aller plus loin, voici la présentation associée :

<SlidevLink link="/presentations/intro" />
```

| Composant | Usage |
|---|---|
| `SlidevOverview` | Page de listing |
| `SlidevPresentation` | Iframe d'une présentation |
| `SlidevCard` | Carte miniature cliquable (utilisée par l'overview) |
| `SlidevCategoryCard` | Carte de catégorie |
| `SlidevLink` | Preview inline MDX |
| `SlidevListItem` | Item compact (vue liste) |

**Swizzlables** (sauf `SlidevLink`) :
```bash
npx docusaurus swizzle slidesaurus SlidevCard --wrap
```

---

## 🔌 Hooks (Plugin API)

```ts
plugins: [
  [
    "slidesaurus",
    {
      path: "./slidev",

      transformFrontmatter: (data, filePath) => ({
        ...data,
        author: data.author ?? "Default Author",
      }),

      onPresentationScanned: (presentation) => {
        console.log(`Found: ${presentation.id}`);
      },

      onBuildComplete: (results) => {
        const failed = results.filter((r) => !r.success);
        if (failed.length) console.error(`${failed.length} builds failed`);
      },
    },
  ],
],
```

---

## 🗂️ Catégories

Organisez vos présentations par sous-dossiers :

```
slidev/
├── basics/
│   ├── _category_.yml
│   ├── intro.md
│   └── setup.md
└── advanced/
    ├── _category_.yml
    └── deep-dive.md
```

```yaml title="slidev/basics/_category_.yml"
label: Bases
description: Démarrer rapidement
position: 1
```

---

## 🧩 Multi-instance

Plusieurs collections sur le même site :

```ts
plugins: [
  ["slidesaurus", { id: "talks", path: "./talks", routeBasePath: "/talks" }],
  ["slidesaurus", { id: "trainings", path: "./trainings", routeBasePath: "/trainings" }],
],
```

Chaque instance a son propre cache (`.docusaurus/slidesaurus/{id}/`) et ses propres routes.

---

## 📚 Documentation complète

→ **[Site de documentation](../../apps/docs/docs/)**

- [Quick Start](../../apps/docs/docs/quick-start.md)
- [Toutes les options](../../apps/docs/docs/options.md)
- [Frontmatter](../../apps/docs/docs/frontmatter.md)
- [Catégories](../../apps/docs/docs/categories.md)
- [Plugin API](../../apps/docs/docs/plugin-api.md)
- [Builds parallèles & cache](../../apps/docs/docs/parallel-builds.md)
- [Themes & Addons](../../apps/docs/docs/themes-addons.md)
- [Troubleshooting](../../apps/docs/docs/troubleshooting.md)
- [CLI `slidesaurus`](../../apps/docs/docs/cli.md)
- [Dev server](../../apps/docs/docs/dev-server.md)

---

## 📄 Licence

MIT — voir [LICENSE](../../LICENSE).
