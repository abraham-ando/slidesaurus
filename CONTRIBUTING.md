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

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold these standards.

---

## Ways to Contribute

| Type | Description |
|---|---|
| Bug reports | Open a [bug report issue](.github/ISSUE_TEMPLATE/bug_report.yml) with reproduction steps |
| Feature requests | Open a [feature request](.github/ISSUE_TEMPLATE/feature_request.yml) with use-case context |
| Documentation | Fix typos, improve examples, add missing docs in `apps/docs/docs/` |
| Code | Fix bugs or implement features — start by commenting on the issue |
| Themes/addons | Share examples in Discussions |

For significant changes, open an issue first to align on the approach before writing code.

---

## Development Setup

### Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 9 — `npm install -g pnpm`
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

### Watch mode for the plugin

```bash
cd packages/slidesaurus
pnpm dev  # Rollup watch — rebuilds on every save
```

---

## Project Structure

```
├── packages/
│   └── slidesaurus/          # The npm package
│       ├── src/              # TypeScript source
│       │   ├── index.ts      # Plugin entry point (Docusaurus lifecycle)
│       │   ├── scanner.ts    # Slide file discovery
│       │   ├── builder.ts    # Parallel build orchestration
│       │   ├── buildRunner.ts# Slidev CLI wrapper
│       │   ├── devServerManager.ts  # Dev server process manager
│       │   ├── packageResolver.ts   # Theme/addon install
│       │   ├── fileSystem.ts # Incremental cache management
│       │   ├── env.ts        # Environment allowlist
│       │   └── cli/          # slidesaurus CLI commands
│       ├── theme/            # Swizzlable React components
│       ├── src/__tests__/    # Vitest unit tests
│       └── features/         # Cucumber BDD integration tests
├── apps/
│   ├── docs/                 # Documentation site (Docusaurus)
│   └── sample/              # Sample integration (Docusaurus)
└── .github/
    └── workflows/            # CI/CD pipelines
```

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
pnpm test -- --reporter=verbose src/__tests__/builder.spec.ts
```

Tests live in `src/__tests__/*.spec.ts`. Import `describe`, `it`, `expect`, `vi` explicitly (globals are disabled).

### Integration tests (Cucumber BDD)

```bash
cd packages/slidesaurus
pnpm test:integration                             # All features
pnpm test:integration -- features/scanning.feature
```

### Type checking

```bash
cd packages/slidesaurus
pnpm exec tsc --noEmit
```

### Full CI check

```bash
pnpm build && pnpm --filter slidesaurus test && pnpm --filter slidesaurus test:integration
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

fix(devServer): prevent ECONNRESET on first proxy request after Vite init

docs(options): document autoInstall default value change

security(buildRunner): add "--" separator before user-supplied file paths
```

---

## Pull Request Process

1. **Fill in the PR template** — describe the change, link the issue, tick the checklist.
2. **Keep PRs focused** — one logical change per PR. Split unrelated fixes.
3. **Update docs** — if you changed plugin behavior, update `apps/docs/docs/`. The CI will not enforce this but reviewers will.
4. **All CI checks must pass** before merge.
5. **At least one maintainer review** is required.
6. Maintainers merge using **Squash and Merge** to keep history linear.

---

## Release Process

Releases are handled by maintainers via the GitHub Actions **release workflow**:

1. Maintainer runs the `release` workflow with the desired version bump (`patch` / `minor` / `major`)
2. GitVersion computes the version; `package.json` is updated
3. `CHANGELOG.md` is updated from conventional commits
4. A git tag is created
5. The package is published to npm with provenance
6. A GitHub Release is created with the changelog

Contributors do not need to manage versions or changelogs manually.

---

## Questions?

Open a [GitHub Discussion](../../discussions) or reach out in an issue. We're happy to help you get your contribution merged.
