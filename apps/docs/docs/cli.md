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

| Option | Description | Default |
|--------|-------------|---------|
| `--id <pluginId>` | Plugin instance ID (multi-instance support) | `"default"` |
| `-v, --version` | Print the installed version | |
| `-h, --help` | Show help for a command | |

---

## `slidesaurus new [name]`

Scaffold a new Slidev presentation with pre-filled frontmatter.

```bash
slidesaurus new intro/getting-started
slidesaurus new my-talk --template talk --theme seriph --category engineering
```

If `name` is omitted, the CLI prompts interactively.

### Arguments

| Argument | Description |
|----------|-------------|
| `name` | Presentation name, optionally prefixed with `category/` (e.g. `intro/overview`) |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --category <category>` | Category sub-folder | |
| `-t, --theme <theme>` | Slidev theme | Plugin default |
| `--template <template>` | Template: `basic`, `tutorial`, or `talk` | `basic` |
| `--force` | Overwrite if the file already exists | |

### Templates

| Template | Use case | Extra frontmatter |
|----------|----------|-------------------|
| `basic` | General-purpose slide deck | — |
| `tutorial` | Step-by-step guide | `level: beginner`, `duration: 30` |
| `talk` | Conference talk | `level: intermediate`, `duration: 45` |

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

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON (machine-readable, suitable for CI scripts) |

### Example output (default)

```
  Presentations — slidev (3)

  ID                           TITLE                    CATEGORY   THEME   LEVEL
  ────────────────────────────────────────────────────────────────────────────────
  intro/getting-started        Getting Started          intro      seriph  —
  advanced/deep-dive           Deep Dive                advanced   seriph  advanced
  architecture                 Architecture Overview    —          seriph  —

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

| # | Check | Pass condition |
|---|-------|----------------|
| 1 | **Config file found** | `docusaurus.config.ts/js` exists in cwd |
| 2 | **Plugin registered** | `slidesaurus` plugin found with the correct `id` |
| 3 | **Slidev directory exists** | The configured `path` directory exists and is readable |
| 4 | **`@slidev/cli` installed** | Slidev CLI available in the monorepo tree |
| 5 | **Themes & addons installed** | Global theme + per-slide themes + all addons resolvable |
| 6 | **Dev server ports free** | `devServerBasePort` through `basePort + N` are available |
| 7 | **Cache coherent** | Hash manifest entries have matching output directories |

### Example output

```
  slidesaurus doctor

  ✓ docusaurus.config found — docusaurus.config.ts
  ✓ slidesaurus plugin found (id="default")
  ✓ Slidev directory exists — slidev
  ✓ @slidev/cli installed
  ✓ Global theme "seriph" installed
  ✓ Dev server ports free (8600–8602)
  ✓ Cache manifest coherent (3 entries)

  ✔ All 7 checks passed.
```

---

## `slidesaurus cache clear`

Clear the incremental build cache — either all presentations or a single one.

```bash
slidesaurus cache clear               # clears everything (with confirmation)
slidesaurus cache clear --yes         # no confirmation prompt
slidesaurus cache clear --id intro/getting-started   # single presentation
```

### Options

| Option | Description |
|--------|-------------|
| `--id <presentationId>` | Clear cache for a specific presentation only |
| `-y, --yes` | Skip the confirmation prompt |

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

The CLI reads `docusaurus.config.ts` (or `.js`/`.mjs`) from the current working directory.  
Run all commands from your project root (the directory containing `docusaurus.config.ts`).

If the config cannot be loaded (e.g. missing TypeScript support), the CLI falls back to sensible defaults and prints a warning. Install `ts-node` in your project to enable TypeScript config loading.
