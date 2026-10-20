# Contributing to Slidesaurus

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Tests](#tests)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

---

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) Code of Conduct. By participating, you agree to uphold these standards.

---

## Ways to Contribute

| Type | Description |
|---|---|
| Bug reports | Open an issue with reproduction steps |
| Feature requests | Open an issue with use-case context |
| Documentation | Fix typos, improve examples, add missing docs in `apps/docs/docs/` |
| Code | Fix bugs or implement features — start by commenting on the issue |
| Themes/addons | Share examples in Discussions |

For significant changes, open an issue first to align on the approach before writing code.

---

## Development Setup

### Prerequisites

- **Node.js** ≥ 22.12 — the repository pins Node 24 LTS in `.nvmrc` (`nvm use`); CI runs Node 22, 24 and 26
- **pnpm** 10 — the exact version is pinned in the root `package.json` (`packageManager`); `corepack enable` picks it up automatically
- **Git**

### 1. Fork and clone

```bash
git clone https://github.com/<your-username>/docusaurus-plugin-slidev.git
cd docusaurus-plugin-slidev
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Build the plugin

```bash
pnpm build:plugin
```

The plugin must be built before running the sample or docs apps (Turbo enforces this dependency).

### 4. Start a dev app

```bash
# Sample integration site (port 3000)
pnpm dev:sample

# Documentation site (port 3001)
pnpm dev:docs
```

The dev apps build presentations and serve them as static files — there is no Slidev dev server or HMR inside `docusaurus start`.

### Watch mode for the plugin

```bash
cd packages/slidesaurus
pnpm dev  # Rollup watch — rebuilds on every save (including the compiled theme)
```

---

## Project Structure

```
├── packages/
│   └── slidesaurus/             # The npm package
│       ├── src/                 # TypeScript source, organised in layers
│       │   ├── index.ts         # Rollup entry — thin re-export of the plugin
│       │   ├── domain/          # Types, interfaces, constants
│       │   ├── application/     # scanner, builder, buildCache, frontmatterValidator
│       │   ├── infrastructure/
│       │   │   ├── fs/          # cache dirs, hashing, isolated builds, output management
│       │   │   ├── process/     # buildRunner (slidev build), assetGenerator (thumbnails/exports)
│       │   │   └── packages/    # packageResolver (theme/addon install), env allowlist
│       │   ├── presentation/    # Docusaurus plugin lifecycle, routes, CLI commands, webpack config
│       │   ├── shared/          # logger, utils, concurrentRunner
│       │   └── cli/             # standalone `slidesaurus` CLI (new, list, doctor, cache)
│       ├── theme/               # Swizzlable React components (TSX sources)
│       ├── scripts/             # build-theme.mjs — compiles theme/ to lib/theme/
│       └── features/            # Cucumber BDD integration tests
├── apps/
│   ├── docs/                    # Documentation site (Docusaurus)
│   └── sample/                  # Sample integration (Docusaurus)
└── .github/
    └── workflows/               # CI (ci.yml)
```

Unit tests live next to each layer in `src/**/__tests__/`. Dependencies point inwards (`presentation`/`cli` → `application` → `infrastructure` → `domain`); `shared` can be used by every layer. See [CLAUDE.md](CLAUDE.md) for the role of each module.

---

## Making Changes

### Branch naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/<short-description>` | `feat/category-icons` |
| Bug fix | `fix/<issue-number>-<description>` | `fix/42-symlink-crash` |
| Docs | `docs/<what>` | `docs/themes-addons` |
| Refactor | `refactor/<what>` | `refactor/scanner-perf` |

### Development workflow

1. Create a branch from `main`
2. Make your changes
3. Add or update tests
4. Update documentation in `apps/docs/docs/` if you changed plugin behavior (see [CLAUDE.md](CLAUDE.md))
5. Run the full test suite
6. Push and open a PR

---

## Tests

### Unit tests (Vitest)

```bash
cd packages/slidesaurus
pnpm test                                         # All unit tests
pnpm test -- scanner                              # Filter by name
pnpm test -- --reporter=verbose src/application/__tests__/builder.spec.ts
```

Tests live in `src/**/__tests__/*.spec.ts`, next to the layer they test. Import `describe`, `it`, `expect`, `vi` explicitly (globals are disabled). Mock the logger with `vi.mock("<relative path>/shared/logger", ...)`.

### Integration tests (Cucumber BDD)

```bash
cd packages/slidesaurus
pnpm test:integration                             # All features
pnpm test:integration -- features/scanning.feature
```

### Lint, format and type checking

From the repo root:

```bash
pnpm lint            # ESLint
pnpm format          # Prettier (write)
pnpm format:check    # Prettier (check only)
pnpm typecheck       # tsc for the plugin sources and the theme
```

The repository uses **TypeScript 7** (`tsc`, native compiler). The build does not type-check (Rollup transpiles with esbuild, Cucumber loads TypeScript with tsx), so run `pnpm typecheck` before pushing. TypeScript 7.0 has no JS compiler API yet: `rollup-plugin-dts`, `scripts/build-theme.mjs` and `typescript-eslint` use the TS 6 API from `@typescript/typescript6` (at the repo root, `typescript` is an alias to that package, for ESLint).

### Full CI check

CI (`.github/workflows/ci.yml`) runs on ubuntu and windows with Node 22, 24 and 26 (only ubuntu + Node 22 builds the docs and sample sites), plus a pack & smoke job that installs the packed tarball in a fresh project. To reproduce it locally:

```bash
pnpm typecheck && pnpm build && pnpm --filter slidesaurus test && pnpm --filter slidesaurus test:integration
```

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change without new feature or bug fix |
| `test` | Adding or updating tests |
| `security` | Security hardening |
| `chore` | Build system, CI, dependencies |
| `perf` | Performance improvement |

**Examples:**

```
feat(scanner): support _index.md as presentation entry point

fix(builder): keep the previous output when a rebuild fails

docs(options): document autoInstall default value change

security(buildRunner): add "--" separator before user-supplied file paths
```

---

## Pull Request Process

1. **Describe the change** — explain what and why, and link the issue.
2. **Keep PRs focused** — one logical change per PR. Split unrelated fixes.
3. **Update docs** — if you changed plugin behavior, update `apps/docs/docs/`. The CI will not enforce this but reviewers will.
4. **All CI checks must pass** before merge.
5. **At least one maintainer review** is required.
6. Maintainers merge using **Squash and Merge** to keep history linear.

---

## Release Process

Releases are currently cut manually by maintainers. An automated release workflow (version bump, changelog from conventional commits, tag, npm publish with provenance and GitHub Release) is **planned but does not exist yet** — the only workflow today is `ci.yml`.

Contributors do not need to manage versions or changelogs.

---

## Questions?

Open a [GitHub Discussion](../../discussions) or reach out in an issue. We're happy to help you get your contribution merged.
