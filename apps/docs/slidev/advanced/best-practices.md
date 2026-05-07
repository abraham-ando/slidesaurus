---
title: Best Practices
description: Recommendations for production use, performance, and CI/CD
theme: seriph
author: Training Team
tags: [best-practices, performance, ci-cd]
date: 2026-02-15
position: 2
level: advanced
owner: Documentation Team
duration: 40
lastReviewed: 2026-05-07
playlist: Deep Dive Track
---

# Best Practices

Recommendations for using slidesaurus in production.

---

# Project Structure

Recommended layout:

```
my-site/
  docs/                    # Documentation
  slidev/                  # Presentations
    getting-started/
      _category_.yml
      intro.md
      setup.md
    advanced/
      _category_.yml
      architecture.md
  docusaurus.config.ts
  package.json
```

**Key principles:**
- Separate docs from presentations
- Use categories from the start
- Keep file names URL-friendly (lowercase, hyphens)

---

# Naming Conventions

| Convention | Example | Reason |
|---|---|---|
| Lowercase filenames | `getting-started.md` | Clean URLs |
| Descriptive titles | `title: Getting Started with React` | Readable cards |
| Consistent tags | `[react, beginner]` | Filterable |
| ISO dates | `date: 2026-02-15` | Sortable |
| Sequential positions | `position: 1, 2, 3` | Predictable order |

---

# Performance Optimization

1. **Tune parallel builds** for your hardware:

```ts
{
  // Default: os.cpus().length - 1. Lower this on memory-constrained CI runners.
  maxParallelBuilds: 2,
  buildTimeout: 180,  // Increase on slow CI
}
```

2. **Pre-install themes** — `autoInstall` is disabled by default:

```bash
npm install @slidev/theme-seriph
```

3. **Keep slide counts reasonable** — split large decks into smaller ones (30 slides max per deck).

---

# CI/CD Integration

```yaml
# GitHub Actions
- name: Build site
  run: npm run build
  env:
    NODE_OPTIONS: "--max-old-space-size=4096"
```

**Tips for CI:**
- Set `maxParallelBuilds: 2` (CI runners typically have 2 vCPUs)
- Increase `buildTimeout` to 300 seconds
- Cache `node_modules` between runs
- Use `NODE_OPTIONS` to increase memory if needed

---

# Monorepo Setup

If your Docusaurus site is in a monorepo:

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
```

```json
// apps/docs/package.json
"slidesaurus": "workspace:*"
```

**Potential issues:**
- Duplicate React — ensure a single copy is hoisted
- Slidev CLI — install at root or in the docs workspace

---

# Content Guidelines

Write presentations that work well embedded:

- **Large fonts** — viewers may see slides in scaled previews
- **High contrast** — ensure readability on both light and dark backgrounds
- **Minimal text** — bullet points, not paragraphs
- **Speaker notes** — detailed content goes in notes, not on slides

```md
<!-- Speaker notes go here -->
This slide explains the architecture.
The key takeaway is that builds are parallel.
```

---

# Version Control

- **Commit** `.md` presentation files alongside docs
- **Do not commit** Slidev build output (it is generated during `docusaurus build`)
- Add to `.gitignore`:

```
.docusaurus/
build/
```

---

# Summary

| Area | Recommendation |
|---|---|
| Structure | Categories from day one |
| Naming | Lowercase, hyphenated filenames |
| Performance | Tune parallel builds, pre-install themes |
| CI/CD | Lower concurrency, higher timeout |
| Content | Large fonts, minimal text, use notes |
| VCS | Commit source, ignore build output |

You're now ready to use slidesaurus in production!
