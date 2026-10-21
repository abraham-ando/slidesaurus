# 🦕 Slidesaurus

> **Slidesaurus transforme les présentations Slidev d'artefacts isolés en contenu first-class du site Docusaurus — découvrables, embarquables, déployables avec le reste de la doc, sans configuration ni glue code.**

[![npm version](https://img.shields.io/npm/v/slidesaurus)](https://www.npmjs.com/package/slidesaurus)
[![license](https://img.shields.io/npm/l/slidesaurus)](./LICENSE)

Le plugin Docusaurus v3 qui fait cohabiter votre **documentation** et vos **présentations [Slidev](https://sli.dev)** dans un seul site, un seul build, une seule URL.

---

## ✨ Pourquoi Slidesaurus ?

Vous avez de la doc. Vous avez des slides. Aujourd'hui, ils vivent sur deux mondes parallèles : deux build pipelines, deux déploiements, deux URLs, et zéro lien entre les deux.

**Slidesaurus comble le fossé.**

| Sans Slidesaurus                            | Avec Slidesaurus                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Builder chaque deck avec `slidev build`     | Drop un `.md`, c'est en ligne                                                      |
| Copier les outputs dans `static/` à la main | Pipeline auto, cache SHA-256, builds parallèles                                    |
| Liens en dur entre docs et slides           | Routing unifié, recherche commune                                                  |
| Iframe maison pour embarquer une preview    | `<SlidevLink link="/slidev/intro" />` en MDX                                       |
| Rebuild complet à chaque changement         | Cache incrémental — seul le modifié se rebuild                                     |
| Lancer `slidev dev` à part, port à port     | `docusaurus start` construit les decks (cache incrémental) et les sert en statique |

---

## 🎯 La valeur pour les développeurs

### Productivité maximale

- **Auto-discovery** — déposez un `.md` Slidev, il apparaît dans le site. Pas de config, pas de boilerplate.
- **Builds parallèles + cache incrémental** — un build complet de 10 présentations en quelques secondes sur incrémental.
- **Dev simple** — `docusaurus start` construit les présentations avec le même pipeline que la prod (cache incrémental) et les sert en statique : pas de serveur Slidev, pas de port, pas de proxy (donc pas de HMR Slidev ; lancez `slidev` à côté pour éditer un deck en direct).
- **Auto-install optionnel** des thèmes/addons Slidev manquants (`autoInstall: true`, désactivé par défaut).

### Doc vivante

Embarquez une présentation dans n'importe quelle page MDX :

```mdx
import SlidevLink from "@theme/SlidevLink";

<SlidevLink link="/slidev/intro-to-rust" />
```

Vos slides deviennent des **objets de première classe** du contenu : citables, embarquables, indexables.

### À l'échelle

- **Catégories** par sous-dossier (`_category_.yml`) pour organiser les decks par thème, équipe ou cours.
- **Multi-instance** (option `id`) — plusieurs collections distinctes (`talks/`, `trainings/`, `internal/`) sur le même site.
- **Frontmatter structuré** (`tags`, `author`, `date`, `position`) — base pour filtrer, trier, rechercher.

### Cohérence visuelle

Thème Slidev par défaut au niveau du projet (option `theme`, sinon chaque deck garde son thème ou celui par défaut de Slidev) → tous les decks alignés sur votre branding. Composants `SlidevOverview`, `SlidevCard`, `SlidevCategoryCard`, `SlidevListItem`, `SlidevPresentation` swizzlables pour matcher votre design system.

---

## 👥 Pour qui c'est un game-changer

| Profil                              | Gain principal                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| 🎤 **DevRel / Developer Advocate**  | Centraliser docs et talks dans un seul portail, embed inline dans les guides |
| 🎓 **Équipes formation / training** | Catégoriser les modules, capitaliser les decks dans la knowledge base        |
| 📦 **Mainteneurs OSS**              | Slides de release notes ou conférences alignés à la doc officielle           |
| 🏢 **Équipes internes**             | Onboarding unifié : doc + slides au même endroit, search commune             |
| 📚 **Auteurs techniques**           | Compléter un tutoriel par sa présentation embarquée                          |

---

## 🚀 Installation

```bash
npm install slidesaurus @slidev/cli
```

```bash
pnpm add slidesaurus @slidev/cli
```

```bash
yarn add slidesaurus @slidev/cli
```

> **Prérequis** : Docusaurus v3, Node.js ≥ 22.12. `@slidev/cli` est une peer dependency **optionnelle** : installez-la dans votre projet, sinon aucune présentation n'est construite.

---

## ⚙️ Configuration

Ajoutez le plugin à votre `docusaurus.config.ts` :

```ts title="docusaurus.config.ts"
import type { Config } from "@docusaurus/types";

const config: Config = {
  // ...
  plugins: [
    [
      "slidesaurus",
      {
        path: "./slidev", // dossier des présentations
        routeBasePath: "/presentations", // URL de base (défaut: /slidev)
        theme: "seriph", // thème Slidev par défaut
      },
    ],
  ],
};

export default config;
```

Créez votre première présentation dans `slidev/my-talk.md` :

```md
---
title: My First Slidev Talk
theme: seriph
---

# Hello Docusaurus

Press space to advance.

---

## Markdown power

- ✨ Auto-discovered
- 🚀 Auto-built
- 🎨 Auto-themed
```

Lancez le serveur de dev (les présentations sont construites puis servies en statique) :

```bash
npx docusaurus start
```

Visitez **http://localhost:3000/presentations** — votre talk est là. C'est tout.

---

## 🎨 Composants embarquables

| Composant            | Usage                                                        |
| -------------------- | ------------------------------------------------------------ |
| `SlidevOverview`     | Page de listing complète                                     |
| `SlidevPresentation` | Visionneuse iframe individuelle                              |
| `SlidevCard`         | Carte miniature cliquable                                    |
| `SlidevCategoryCard` | Carte de catégorie                                           |
| `SlidevLink`         | Aperçu inline pour MDX (`@theme/SlidevLink`, non swizzlable) |
| `SlidevListItem`     | Item de liste compact                                        |

Tous **swizzlables** :

```bash
npx docusaurus swizzle slidesaurus SlidevCard --wrap
```

---

## 🔧 Options principales

| Option              | Type       | Défaut                   | Description                                                                                                                   |
| ------------------- | ---------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `path`              | `string`   | `"./slidev"`             | Dossier des fichiers `.md` Slidev                                                                                             |
| `routeBasePath`     | `string`   | `"/slidev"`              | URL de base des présentations                                                                                                 |
| `theme`             | `string`   | _(aucun)_                | Thème Slidev par défaut (sinon : thème du deck ou thème par défaut de Slidev)                                                 |
| `addons`            | `string[]` | `[]`                     | Addons Slidev globaux                                                                                                         |
| `download`          | `boolean`  | `false`                  | Générer les exports PDF/PPTX et afficher les boutons de téléchargement (nécessite Playwright)                                 |
| `pageTitle`         | `string`   | `"Slidev Presentations"` | Titre de la page d'overview                                                                                                   |
| `maxParallelBuilds` | `number`   | `CPU − 1` (min. 1)       | Builds en parallèle max (plafonné au nombre de CPU)                                                                           |
| `buildTimeout`      | `number`   | `300`                    | Timeout par build (s, 10–600)                                                                                                 |
| `autoInstall`       | `boolean`  | `false`                  | Auto-installer les thèmes/addons manquants (noms `slidev-theme-*` / `slidev-addon-*` uniquement, sans scripts d'installation) |

→ [Documentation complète des options](./apps/docs/docs/options.md)

---

## 🔌 Hooks (Plugin API)

Personnalisez le pipeline sans fork :

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
      onBuildComplete: (results) => {
        console.log(`Built ${results.length} presentations`);
      },
    },
  ],
],
```

→ [Documentation complète du Plugin API](./apps/docs/docs/plugin-api.md)

---

## 📚 Documentation

Documentation complète : **[apps/docs](./apps/docs/docs/)**

- [Quick Start](./apps/docs/docs/quick-start.md)
- [Configuration](./apps/docs/docs/options.md)
- [Frontmatter](./apps/docs/docs/frontmatter.md)
- [Catégories](./apps/docs/docs/categories.md)
- [Composants thème](./apps/docs/docs/slidev-card.md)
- [Plugin API](./apps/docs/docs/plugin-api.md)
- [Builds parallèles & cache](./apps/docs/docs/parallel-builds.md)
- [Themes & Addons](./apps/docs/docs/themes-addons.md)
- [Troubleshooting](./apps/docs/docs/troubleshooting.md)
- [CLI `slidesaurus`](./apps/docs/docs/cli.md)
- [Dev server](./apps/docs/docs/dev-server.md)

---

## 🤝 Contribuer

Le repo est un monorepo pnpm + Turbo :

- `packages/slidesaurus` — le plugin npm `slidesaurus`
- `apps/docs` — site de documentation (port 3001)
- `apps/sample` — site d'exemple (port 3000)

```bash
pnpm install
pnpm build:plugin
pnpm dev:sample
```

Qualité : `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`. Voir [CONTRIBUTING.md](./CONTRIBUTING.md).

→ Voir [CLAUDE.md](./CLAUDE.md) pour l'architecture détaillée.

---

## 📄 Licence

MIT — fait avec 🦕 pour la communauté Docusaurus & Slidev.
