---
sidebar_position: 10
---

# CLI Reference

The `slidesaurus` package includes a command-line interface for common developer tasks.  
It reads your `docusaurus.config.ts` automatically — no separate configuration file needed.

```bash
slidesaurus <command> [options]
```

## Global Options

| Option            | Description                                 | Default     |
| ----------------- | ------------------------------------------- | ----------- |
| `--id <pluginId>` | Plugin instance ID (multi-instance support) | `"default"` |
| `-v, --version`   | Print the installed version                 |             |
| `-h, --help`      | Show help for a command                     |             |

---

## `slidesaurus new [name]`

Scaffold a new Slidev presentation with pre-filled frontmatter.

```bash
slidesaurus new intro/getting-started
slidesaurus new my-talk --template talk --theme seriph --category engineering
```

If `name` is omitted, the CLI prompts for it. The template and theme are also asked interactively when `--template` / `--theme` are not given. Cancelling a prompt (Ctrl+C) exits with code `130`.

### Arguments

| Argument | Description                                                                     |
| -------- | ------------------------------------------------------------------------------- |
| `name`   | Presentation name, optionally prefixed with `category/` (e.g. `intro/overview`) |

### Options

| Option                      | Description                              | Default                                                          |
| --------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `-c, --category <category>` | Category sub-folder                      |                                                                  |
| `-t, --theme <theme>`       | Slidev theme                             | Asked interactively (default: the plugin `theme`, else `seriph`) |
| `--template <template>`     | Template: `basic`, `tutorial`, or `talk` | Asked interactively (default `basic`)                            |
| `--force`                   | Overwrite if the file already exists     |                                                                  |

Names are slugified (`My Talk` → `my-talk`) and a trailing `.md` is ignored. A name or category that reduces to nothing, an unknown template or an invalid theme package name is rejected with a clear error. Values written to the frontmatter (title, theme) are YAML-escaped.

### Templates

| Template   | Use case                   | Extra frontmatter                     |
| ---------- | -------------------------- | ------------------------------------- |
| `basic`    | General-purpose slide deck | —                                     |
| `tutorial` | Step-by-step guide         | `level: beginner`, `duration: 30`     |
| `talk`     | Conference talk            | `level: intermediate`, `duration: 45` |

### Example output

```
✔ Created intro/getting-started.md
  Template: basic
  File:     /your-project/slidev/intro/getting-started.md
  URL:      /presentations/intro/getting-started/
```

---

## `slidesaurus list`

List all presentations discovered in the configured `path` directory.

```bash
slidesaurus list
slidesaurus list --json
```

### Options

| Option   | Description                                                |
| -------- | ---------------------------------------------------------- |
| `--json` | Output as JSON (machine-readable, suitable for CI scripts) |

### Example output (default)

```
  Presentations — slidev (3)

  ID                           TITLE                    CATEGORY   THEME   LEVEL     TAGS
  ────────────────────────────────────────────────────────────────────────────────────────────
  intro/getting-started        Getting Started          intro      seriph  —         intro, overview
  advanced/deep-dive           Deep Dive                advanced   seriph  advanced  typescript
  architecture                 Architecture Overview    —          seriph  —         —

  2 category(ies): Intro, Advanced
```

---

## `slidesaurus doctor`

Run a diagnostic check on your project configuration.  
Exits with code `0` if all checks pass, `1` if any fail.

```bash
slidesaurus doctor
slidesaurus doctor --id secondary   # for a secondary plugin instance
```

### Checks performed

| #   | Check                         | Pass condition                                                                                                                                                  |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Config file found**         | `docusaurus.config.ts`, `.js` or `.mjs` exists in cwd                                                                                                           |
| 2   | **Plugin registered**         | `slidesaurus` plugin found with the correct `id`                                                                                                                |
| 3   | **Slidev directory exists**   | The configured `path` directory exists                                                                                                                          |
| 4   | **`@slidev/cli` installed**   | Slidev CLI available in `node_modules` (searched up the monorepo tree)                                                                                          |
| 5   | **Themes & addons installed** | Global `theme`, per-slide themes and all addons are resolvable (same resolution as the build)                                                                   |
| 6   | **Cache coherent**            | Hash manifest entries have matching output directories (only checked if a cache exists)                                                                         |
| 7   | **Node.js version**           | Node.js ≥ 22.12                                                                                                                                                 |
| 8   | **Playwright**                | Informational only, never a failure — `playwright-chromium` (the package `slidev export` loads) is optional and only needed for thumbnails and PDF/PPTX exports |

### Example output

```
  slidesaurus doctor

  ✓ docusaurus.config found — docusaurus.config.ts
  ✓ slidesaurus plugin found (id="default")
  ✓ Slidev directory exists — slidev
  ✓ @slidev/cli installed
  ✓ Global theme "seriph" installed
  ✓ Cache manifest coherent (3 entries)
  ✓ Node.js version ≥ 22.12 — v24.22.0
  ✓ playwright-chromium installed (thumbnails/exports)

  ✔ All 8 checks passed.
```

### Example failure output

```
  slidesaurus doctor

  ✓ docusaurus.config found — docusaurus.config.ts
  ✓ slidesaurus plugin found (id="default")
  ✓ Slidev directory exists — slidev
  ✗ @slidev/cli installed — Run: pnpm add @slidev/cli
  ✓ Global theme "seriph" installed
  ✓ Node.js version ≥ 22.12 — v24.22.0

  5 passed  1 failed
```

---

## `slidesaurus cache clear`

Clear the incremental build cache — either all presentations or a single one.

```bash
slidesaurus cache clear               # clears everything (with confirmation)
slidesaurus cache clear --yes         # no confirmation prompt
slidesaurus cache clear --presentation intro/getting-started   # single presentation
```

### Options

| Option                    | Description                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `-p, --presentation <id>` | Clear cache for a specific presentation only (`--id` is the plugin instance and stays a global option) |
| `-y, --yes`               | Skip the confirmation prompt                                                                           |

The target must name a presentation inside the cache: an empty value, `.`, `..` or an absolute path is rejected, so a typo can never wipe the whole cache. Cancelling a confirmation prompt (Ctrl+C) exits with code `130`.

### When to use

- After changing the global `theme` or `addons` option
- To force a rebuild of all presentations
- When the cache manifest is out of sync with the output directories (`slidesaurus doctor` will tell you)

---

## Multi-instance usage

When the plugin is registered twice (e.g. once for `./slidev` and once for `./demos`), pass `--id` to target the correct instance:

```bash
slidesaurus new my-demo --id demos
slidesaurus list --id demos
slidesaurus cache clear --id demos
```

---

## Config auto-discovery

The CLI reads `docusaurus.config.ts` (or `.js` / `.mjs`) from the current working directory and evaluates it with [jiti](https://github.com/unjs/jiti) (the loader Docusaurus itself uses) in a child process with a 15 s timeout. TypeScript configs work out of the box — no `ts-node` needed — and configs exporting an (async) function are supported.
Run all commands from your project root (the directory containing the config file).

:::caution
Loading the config **executes** your `docusaurus.config` file, like Docusaurus does. Only run the CLI in projects you trust.
:::

If the config cannot be loaded, the CLI prints a warning with the reason and falls back to default plugin options (`path: "./slidev"`, `routeBasePath: "/slidev"`).
