# Audit complet — Slidesaurus

> Date : 2026-10-19 · Révision auditée : `2437ea4` (`main`)

## 0. Synchronisation avec la version en ligne

- **GitHub** (`origin` = `github.com/abraham-ando/slidesaurus`) : `main` local et ce worktree pointent tous les deux sur `2437ea4`, comme `origin/main` (0 commit d'avance, 0 de retard). Il n'y avait rien à synchroniser.
- **npm** : le paquet `slidesaurus` n'est **pas publié** (`npm view slidesaurus` répond 404). Le nom est donc encore libre.
- **Branches locales non fusionnées** :
  - 4 worktrees `worktree-agent-*` sont verrouillés sur `90223d7` et portent 14 commits absents de `main` ;
  - `claude/pedantic-johnson-9e18ea` porte 16 commits non fusionnés.

  Il faut les examiner avant tout nettoyage.

## Suivi des corrections (mis à jour le 2026-10-19)

> ⚠️ **Rien n'a été compilé, typé ni testé.** Toutes les corrections sont écrites mais restent **non vérifiées** tant que les commandes en fin de section n'ont pas été lancées.

Les corrections ont été faites par lots parallèles, puis fusionnées dans `claude/audit-complet-projet-51b81a` :

| Lot | Branche | Commits | Statut |
|---|---|---|---|
| 1 — Packaging, CI, dépendances | `claude/fix-packaging-ci-b13fe0` | dd9b9d5 | Fusionné |
| 2 — Cache, sécurité, routage | `claude/fix-core-cache-security-3045dc` | fb8e041 | Fusionné |
| 3 — Thème React, CLI, apps | `claude/fix-theme-cli-c25813` | e64ca5e, 43a4f48 | Fusionné |
| 4a — Tests isolés, hygiène | `claude/chore-tests-hygiene-a9140e` | 195367c, 11c47aa, abd6684 | Fusionné |
| 4b — Câblage, code mort, lint | (cette branche) | 14d6cd1, c5ede9c | Commité |
| 4b — Documentation | `claude/docs-resync-719277` | 0d4f026, 1868cf2, 0544801 | Fusionné |

**Constats traités**

| Constats | Statut | Résumé |
|---|---|---|
| C1–C5 | ✅ Corrigés | Packaging : sortie `index.mjs` avec types `.d.cts`/`.d.mts`, thème compilé dans `lib/theme`, dépendances runtime déclarées. CI : pnpm lu depuis `packageManager`. CLI : config chargée via `jiti`. |
| H1–H3 | ✅ Corrigés | Cache : hash couvrant toutes les dépendances du deck, échecs d'export réduits à des warnings, exports lancés depuis la copie isolée. |
| H4, H5 | ✅ Corrigés | `baseUrl` pris en compte côté serveur (route overview, `publicPath`) et côté thème (`useBaseUrl`). |
| H6, H7 | ✅ Corrigés | Slidev lancé sans `cmd.exe` ; arrêt de tout l'arbre de processus au timeout ; SIGKILL basé sur le vrai état de sortie. |
| H8 | ✅ Corrigé | Auto-install sans shell, `--ignore-scripts`, timeout ; noms de paquets stricts. |
| H9 | ✅ Corrigé | Données globales réduites à un DTO public, sans chemins absolus. |
| H10–H12 | ✅ Corrigés | CLI : `cache clear -p/--presentation`. Thème : HTML des cartes valide, règle des hooks respectée. |
| H13, H14 | ✅ Corrigés | engines `>=20.12`, peerDependency `@slidev/cli`, dépendances vulnérables mises à jour, CI ubuntu+windows avec job « pack & smoke ». |
| Moyennes | ✅ Majorité | Échec de build propagé en prod ; sorties orphelines purgées ; `copyRelativeAssets` corrigé ; collisions détectées ; `---js` refusé ; cache par locale ; proxy autorisé dans l'env ; hydratation et sandbox des iframes corrigées ; reprise de lecture en mode history ; CLI `new` et `cache clear` ; code mort `devServer*` supprimé ; ESLint + Prettier ; Docusaurus 3.10.2 ; nouvelles specs. |
| Documentation | ✅ Resynchronisée | 17 pages du site, deux README, CONTRIBUTING et CLAUDE.md. |

**Décisions de comportement à connaître**

- Le thème par défaut « unicorn » est supprimé : un deck sans thème garde le thème par défaut de Slidev.
- `devServerBasePort` et `devServerTimeout` sont acceptées mais n'ont plus d'effet (warning).
- `routeBasePath` doit commencer par `/` et `id` ne doit contenir que des caractères sûrs.
- Les commandes `slidev:*` reçoivent le suffixe `:<id>` pour les instances autres que celle par défaut.
- Un nom de paquet non Slidev (`@org/addon`) est refusé. Une collision de routes fait échouer le scan.
- Le format du hash a changé : le premier build après mise à jour reconstruit tout.

**Reste ouvert**

- **À faire par toi (bloquant)** : régénérer `pnpm-lock.yaml`, sinon la CI échoue sur `--frozen-lockfile`.
- **Montées de version majeures** : vitest passe de 3 à 4, à valider.
- **Formatage** : Prettier n'a jamais été appliqué. Un premier `pnpm format` produira un gros diff, à commiter à part. Le lint n'est pas encore exécuté en CI.
- **Points non traités** :
  - `theme: none` n'est pas géré ;
  - `isDev` est conservé dans `PluginData`, pour compatibilité avec les composants swizzlés ;
  - les sources TSX swizzlées importent leurs types depuis `src/`, qui n'est pas publié ;
  - deux builds simultanés sur le même cache ne sont pas supportés.
- **Doc non vérifiée** : rendu des pages non contrôlé, et `playlists.md` pas relu (format de `?playlist=`).
- **Branches à trier** : les worktrees `worktree-agent-*` (14 commits non fusionnés) et `claude/pedantic-johnson-9e18ea` (16 commits).

**Commandes de vérification** (depuis la racine) :

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm --filter slidesaurus test:integration
```

Ensuite : `pnpm dev:docs`, puis contrôler la navigation clavier sur les cartes et l'absence d'avertissements d'hydratation.

---

## 1. Synthèse

Le projet est bien structuré : architecture en couches `domain` / `application` / `infrastructure` / `presentation`, TypeScript strict, cache incrémental et allowlist d'environnement. En revanche, **il n'est pas publiable en l'état** :

- le paquet npm serait inutilisable, à cause de l'ESM cassé, du thème livré en TSX qui importe `src/` (absent du paquet) et de dépendances runtime non déclarées ;
- la CI échoue probablement dès l'installation ;
- le cache incrémental produit des sorties périmées ;
- `baseUrl ≠ "/"` casse le routage ;
- la documentation (README, CLAUDE.md, docs) décrit encore un mode dev qui n'existe plus.

| Gravité | Nb | Domaines principaux |
|---|---|---|
| Critique | 5 | Packaging npm, CI |
| Haute | 14 | Cache, Windows, sécurité, routage, CLI, accessibilité |
| Moyenne | ~25 | Robustesse du build, SSR, tests, outillage |
| Basse | ~20 | Hygiène, doc, petits défauts |

Légende : ✅ point vérifié manuellement pendant la consolidation · *(à confirmer)* point non reproduit.

---

## 2. Critique

| # | Constat | Preuve | Correctif |
|---|---|---|---|
| C1 ✅ | **Le build ESM est inchargeable.** `module` et `exports.import` pointent vers `lib/index.js`, qui est en syntaxe ESM, alors que `package.json` n'a pas `"type": "module"` : Node le charge comme du CJS et lève une `SyntaxError`. De plus, `__dirname` est utilisé dans le bundle ESM. | `packages/slidesaurus/package.json:6,18` ; `rollup.config.mjs:102` ; `src/presentation/plugin.ts:98` | Sortie en `index.mjs`, `import.meta.url`, types `.d.cts` et `.d.mts` séparés |
| C2 ✅ | **Le thème est inutilisable une fois publié.** `theme/types.ts:16` réexporte `PLUGIN_NAME` (une vraie valeur) depuis `../src/domain/constants`, mais `src/` n'est pas dans `files`. Par ailleurs, `getThemePath` renvoie du TSX brut, sans `getTypeScriptThemePath`. Le monorepo masque le problème grâce aux liens symboliques. | `theme/types.ts:13-16` ; `package.json` `files` ; `plugin.ts:97-99` | Compiler `theme/` en JS dans `lib/theme`, exposer les sources via `getTypeScriptThemePath`, copier les constantes |
| C3 | **Dépendances runtime non déclarées.** `@docusaurus/logger` et `@docusaurus/utils-validation` sont importés à l'exécution et laissés externes au bundle, mais ne sont déclarés qu'en devDependencies. Avec l'isolation stricte de pnpm, leur résolution échoue chez le consommateur. | `package.json:45-47` ; `rollup.config.mjs:19-25` | Les passer en `dependencies` |
| C4 ✅ | **La CI échoue probablement dès l'installation.** `pnpm/action-setup@v4` reçoit `version: 9` alors que `packageManager` déclare `pnpm@10.33.0`, et l'action refuse deux versions en conflit. | `.github/workflows/ci.yml:29-31,66-68` ; `package.json:37` | Supprimer `version:` |
| C5 | **La CLI dépend de `ts-node`, qui n'est qu'en devDependency.** Sur un `docusaurus.config.ts`, l'erreur est avalée et la CLI retombe en silence sur les valeurs par défaut : `new` écrit au mauvais endroit et `doctor` affiche « plugin not found ». | `src/cli/config.ts:60,78-127` | Passer à `jiti` ou `tsx` en dépendance, ou réutiliser le loader de config de Docusaurus |

## 3. Haute

### Cache incrémental et build

- **H1 — Le hash ne couvre que le fichier `.md`** (`application/buildCache.ts:41-61`). Rien d'autre ne déclenche de rebuild :
  - les sections importées via `src:`, les composants `.vue`, `styles/`, `setup/` et les images ;
  - les versions de Slidev, du thème et des addons ;
  - `routeBasePath`, alors que `--base` en dépend (`builder.ts:154`) ;
  - les modifications du frontmatter faites par les hooks.

  → Les sorties en cache deviennent périmées sans aucun signal.
- **H2 — Sans Playwright, le cache est neutralisé.** `runSlidevBuild` ne rejette jamais, donc le `catch` « Playwright not available » est mort. Un export en échec entraîne `cache.invalidate`, et tout est reconstruit à chaque build. Réf. : `infrastructure/process/buildRunner.ts:54-119`, `assetGenerator.ts:72-77`, `builder.ts:297-302`.
- **H3 — Les miniatures et exports PDF sont générés depuis la source d'origine** (`assetGenerator.ts:52,130`), pas depuis la copie isolée patchée. Ils sont donc rendus avec le mauvais thème et sans addons, et peuvent laisser des artefacts dans le dossier source.

### Routage avec `baseUrl`

- **H4 ✅ — La route de l'overview n'inclut pas `baseUrl`** (`presentation/routeBuilder.ts:47`), alors que les routes des catégories et des présentations l'incluent (`scanner.ts:185,277`). Avec `baseUrl: "/docs/"`, l'overview donne une 404. `SlidevOverview` construit aussi `basePath` et `backUrl` sans `baseUrl`.
- **H5 — En dev, `publicPath` ignore `baseUrl`** (`webpackConfig.ts:36`), ce qui provoque des 404 sur les assets dans les iframes.

### Windows et processus

- **H6 — Injection via `cmd.exe /c`.** `spawn("cmd.exe", ["/c", slidevBin, ...args])` est appelé avec des arguments dérivés des noms de fichiers. Un fichier `x&calc.md` exécute une commande en CI Windows. Ensuite, `child.kill()` ne tue que `cmd.exe` : le processus `node slidev`, avec Vite et Chromium, reste orphelin. Réf. : `buildRunner.ts:71-74`.
- **H7 ✅ — L'escalade SIGKILL ne se déclenche jamais.** `if (!child.killed)` est toujours faux après l'envoi d'un signal : `killed` signifie « signal envoyé », pas « processus mort ». Réf. : `buildRunner.ts:99`.
- **H8 — Auto-install.**
  - `execFile("pnpm.cmd")` sans shell donne `EINVAL` depuis le correctif CVE-2024-27980 (Node ≥ 18.20.2 / 20.12.2) : l'auto-install est cassé sous Windows.
  - La validation n'impose pas les préfixes `slidev-theme-*` / `slidev-addon-*` : `theme: "@evil/pkg"` est installé, scripts lifecycle compris, sans `--ignore-scripts` ni timeout.

  Réf. : `packageResolver.ts:38,147,180`, `shared/utils.ts:36`.

### Fuite de données, CLI et interface

- **H9 — Fuite de chemins absolus vers le client.** `setGlobalData(content)` publie `sourceAbsolutePath`, `outputPath` et toute la config dans le bundle JS, ce qui contredit `types.md`. Réf. : `routeBuilder.ts:39`.
- **H10 — Le flag `--id` a deux sens** : l'id du plugin au niveau global, l'id d'une présentation dans `cache clear`. Le vidage ciblé du cache est donc inaccessible *(à confirmer, comportement de commander)*. Réf. : `src/cli/index.ts:14,62`.
- **H11 — Éléments interactifs imbriqués dans des liens.** Des `<a>` et des `<button>` se trouvent à l'intérieur d'un `<a>` (`SlidevCard/index.tsx:134-200`, `SlidevListItem/index.tsx:88-137`). Le HTML est invalide, ce qui provoque des erreurs d'hydratation et dégrade l'accessibilité clavier et lecteur d'écran.
- **H12 ✅ — Règle des hooks enfreinte.** `SlidevCard` fait un `return` anticipé (`uiTheme === "minimal"`) avant `useRef` / `useFavorites` / `useState` (`SlidevCard/index.tsx:100-107`).

### Packaging et dépendances

- **H13 — Dépendances.**
  - `engines.node >=18` est faux : commander 14, p-limit 7 et Slidev 52 demandent Node ≥ 20.12.
  - `@slidev/cli` n'est déclaré nulle part dans le paquet (il faut au moins une peerDependency optionnelle).
  - `pnpm audit` remonte 6 vulnérabilités critiques et 51 hautes. Les actionnables en direct : `js-yaml` 4.1.1 (runtime), `vitest` 3.2.4 et `turbo` < 2.9.14. L'override `webpack-dev-server >=5.2.1` est insuffisant.
- **H14 — Couverture CI insuffisante.**
  - Ubuntu et Node 20 seulement, pas de Windows, alors que le code a des branches spécifiques (`.cmd`, `\`).
  - Pas de typecheck de `theme/` (exclu de `tsconfig`), pas de build de `apps/docs` ni de `apps/sample`, pas de lint.
  - Actions épinglées par tag et non par SHA.

## 4. Moyenne

**Robustesse du build**
- **Les échecs de build ne font pas échouer Docusaurus** (`plugin.ts:124`). `postBuild` copie tout `output/**`, y compris les sorties partielles et celles des presentations supprimées, car le dossier n'est jamais purgé.
- **Thème par défaut `"unicorn"`** (`plugin.ts:44`) : il est forcé sur les decks sans thème et fait échouer le build s'il n'est pas installé. `doctor` le résout d'ailleurs autrement que `packageResolver`.
- **Une seule présentation fautive interrompt tout le build.** `prepareIsolatedBuild` s'exécute hors du `try` (`builder.ts:272`), et le frontmatter n'est pas typé : `theme: 42` provoque un crash global.
- **✅ `copyRelativeAssets` ne copie jamais rien.** Les conditions `startsWith("..")` puis `!startsWith("../")` s'excluent mutuellement (`isolatedBuild.ts:97,100`), donc `![](../shared/logo.png)` est cassé.
- **`copyColocatedAssets` copie tous les dossiers voisins**, y compris les autres catégories. Le dossier `builds/` n'est jamais nettoyé de ces copies et grossit indéfiniment.
- **Collisions de routes et de sorties.**
  - `foo.md` et un dossier `foo/` donnent la même route.
  - La sortie de `foo/bar` est imbriquée dans celle de `foo`.
  - Un id avec espace ou `#` n'est pas encodé dans les URLs.
  - `postBuild` peut écraser le `index.html` wrapper généré par Docusaurus.
- **Exécution de code à la lecture.** gray-matter évalue le frontmatter `---js` (moteur `eval`) au scan et dans `slidev:validate` : il faut restreindre les moteurs.
- **i18n.** Le fingerprint inclut le `baseUrl` de la locale, mais le cache n'est clé que par `pluginId` : chaque locale reconstruit tout.
- **`getPathsToWatch` incomplet** : `_category_.yml`, `.vue`, `.ts`, styles et `public/` ne sont pas surveillés.
- **Allowlist d'environnement trop stricte pour un usage réel** : elle exclut `HTTP(S)_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS`, `PLAYWRIGHT_BROWSERS_PATH` et `CI`. Ça casse derrière un proxy d'entreprise.

**Thème React**
- **Divergences rendu serveur / client** : `localStorage` et `window` sont lus dans l'initialiseur de `useState`, et `Date.now()` est appelé pendant le rendu.
- **Effet de bord dans un updater** : `useFavorites` écrit dans `localStorage` depuis l'updater de `setState`.
- **Sandbox des iframes incohérente.** `allow-scripts allow-same-origin` sur du contenu de même origine neutralise le sandbox, ce que `SlidevIframe` interdit pourtant. À l'inverse, `SlidevLink` n'a que `allow-scripts` et risque de casser Slidev.
- **La reprise de lecture lit et écrit `#N`**, alors que Slidev est en mode `history` par défaut.
- **Badge « Build Required » obsolète en dev**, alors que le dev construit désormais les présentations.

**CLI**
- `new` : la valeur par défaut de `--template` empêche la question interactive de s'afficher ; le YAML n'est pas échappé (`:` ou `#` dans le titre) ; un nom vide crée un fichier `.md`.
- `cache clear --id .` supprime toute la racine `output/` (`cache.ts:37-62`).

**Code mort**
- `devServer.ts` et `devServerManager.ts` (≈ 385 lignes) ne sont importés nulle part ✅.
- Les options `devServerBasePort` et `devServerTimeout` sont validées mais sans effet.
- `IBuildEngine`, `IFrontmatterRule` et `extraCommands` ne sont pas utilisés.

**Tests et outillage**
- **Aucun test** pour `frontmatterValidator`, `hashManifest`, `assetGenerator`, `routeBuilder`, `webpackConfig`, `plugin.ts`, `cliCommands`, ni pour les commandes CLI `doctor` et `list`. Aucun test de rendu pour les composants du thème.
- **Tests fragiles** : ils dépendent du timing réel (`concurrentRunner.spec.ts`, `devServerManager.spec.ts`), et `buildRunner.spec.ts` ne teste pas `runSlidevBuild`.
- **Cucumber est mince** : 6 scénarios, qui recoupent les tests unitaires.
- **Aucun outil de lint ou de formatage**, malgré une tâche `lint` déclarée dans `turbo.json`. Pas de Dependabot ni de Renovate.
- **Rollup** : `p-limit` est inliné alors qu'il est déclaré en dépendance, `exclude: ["src/__tests__/**"]` est obsolète, et il n'y a pas de champ `sideEffects`.

**Applications**
- `apps/docs` est en Docusaurus 3.10.1 et `apps/sample` en 3.10.0.
- `apps/docs/docusaurus.config.ts:30` a `url: "http://localhost:3001"` en production.
- La CSP de `apps/sample` est active en dev, et son `editUrl` pointe vers `samples/`.
- La surcharge de `SlidevOverview` est rendue hors de `<Layout>`.

## 5. Basse (sélection)

- `clean: "rm -rf lib"` ne marche pas sous `cmd`.
- Le message d'erreur cite `--plugin-id` alors que le flag s'appelle `--id`.
- Annuler une confirmation dans la CLI quitte avec le code 0.
- `safeId` donne le même résultat pour `a/b` et `a__b`. `routeBasePath` et `pluginId` ne sont pas validés dans Joi.
- `notInstalledCache` n'a pas de TTL.
- `cleanupSourceDirectory` supprime un éventuel `index.html` légitime à la racine.
- Duplications : `copyDirRecursive` en double, la promotion de miniature écrite trois fois, `DEFAULT_OPTIONS` dupliqué avec le schéma Joi. Typage faible : `cli: any`, casts non vérifiés du frontmatter.
- `og:url` et `og:image` sont relatifs. La playlist utilise `<a>` au lieu de `Link`. Il manque `aria-pressed` sur le favori de `SlidevListItem`.
- `SECURITY.md` renvoie à une adresse Gmail personnelle, sans mentionner GitHub Private Vulnerability Reporting.
- 5 specs portent l'en-tête « Generated by GitHub Copilot ».

## 6. Documentation désynchronisée

| Fichier | Écarts |
|---|---|
| `CLAUDE.md` | Arborescence `src/` à plat (elle est en couches) ; « loadContent starts dev servers » et proxy webpack (supprimés) ; `index.mjs` / `index.d.mts` (en réalité `index.js` / `index.d.ts`) ; le build `lib/cli.cjs` manque ; tests dans `src/**/__tests__` ; logger mocké via `../shared/logger` ; l'option s'appelle `id`, pas `pluginId` ; `SlidevIframe`, `cli.md`, `dev-server.md`, `playlists.md` et `custom-styling.md` manquent |
| `README.md` | HMR et proxy vers les serveurs de dev (l.25, 34) ; `maxParallelBuilds` par défaut à 4 (en réalité nombre de CPU − 1) ; `autoInstall` à `true` (en réalité `false`) |
| `packages/slidesaurus/README.md` | Même description HMR/proxy obsolète ; l'auto-install est mis en avant alors qu'il est désactivé par défaut |
| `CONTRIBUTING.md` | Structure à plat ; pnpm ≥ 9 au lieu de 10 ; décrit un workflow de release (GitVersion, CHANGELOG, provenance npm) qui n'existe pas |
| `options.md` / `dev-server.md` | `devServer*` présentées comme actives ; alias dépréciés non documentés |
| `plugin-api.md` | Liste `SlidevLink` comme swizzlable alors que le code ne l'expose pas ; `postBuild` décrit comme l'étape de build ; `slidev:stats` et `slidev:validate` absents ; arborescence fausse |
| `types.md` | « omit server-only fields » est faux (voir H9) ; `DevServerOptions` manque |
| `cli.md` | Ambiguïté de `--id` ; tableau de `doctor` différent du code ; conseil `ts-node` sans effet |

## 7. Plan d'action recommandé

**Lot 1 — Rendre le paquet publiable (bloquant)**
1. Corriger C1–C5 : exports ESM/CJS, thème compilé et autonome, dépendances, CI pnpm, chargement de la config TS.
2. Passer `engines` à `>=20.12`, ajouter `@slidev/cli` en peerDependency, et `repository` / `homepage` / `bugs`.
3. Ajouter à la CI : une matrice Windows, le typecheck de `theme/`, le build des deux apps, et un test « pack & install » (`pnpm pack` → installation dans un projet Docusaurus vierge).

**Lot 2 — Correction et sécurité**
4. Hash du cache (H1), gestion d'erreur des exports (H2), source isolée pour les assets (H3).
5. `baseUrl` (H4, H5), `spawn` sans `cmd.exe` + arrêt de l'arbre de processus (H6, H7), restriction et `--ignore-scripts` pour l'auto-install (H8).
6. Filtrer `setGlobalData` (H9). Faire échouer le build si une présentation échoue, et purger les sorties orphelines.

**Lot 3 — Interface et CLI**
7. HTML des cartes (H11), règle des hooks (H12), hydratation, sandbox des iframes.
8. `--id` de la CLI (H10), garde de `cache clear`, échappement YAML dans `new`.

**Lot 4 — Hygiène**
9. Supprimer `devServer*` et les options mortes, ou les réactiver.
10. Ajouter des tests pour `routeBuilder`, `webpackConfig`, `hashManifest` et `frontmatterValidator` ; lint et formatage ; Renovate.
11. Resynchroniser `CLAUDE.md`, les README, `CONTRIBUTING.md` et `apps/docs/docs`.
12. Trier les branches et worktrees non fusionnés.
