---
sidebar_position: 6
---

# Frontmatter Reference

Every Slidev Markdown file can include a YAML frontmatter block at the top. The plugin reads these fields to populate metadata on the overview page and configure individual builds.

## Fields

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | `string` | Yes | — | Display title of the presentation. |
| `description` | `string` | No | `""` | Short description shown on the overview card. |
| `theme` | `string` | No | Plugin default | Slidev theme for this presentation. Overrides the global `theme` option. |
| `colorSchema` | `"dark" \| "light" \| "auto"` | No | — | Color scheme passed to Slidev during build. Exposed to theme components for iframe styling. |
| `withoutNotes` | `boolean` | No | Plugin default | When `true`, excludes presenter notes from the build for this presentation only. Overrides the global `withoutNotes` option. |
| `addons` | `string[]` | No | Plugin default | Slidev addons for this presentation. Merged with global `addons`. |
| `author` | `string` | No | `""` | Author name displayed on the card. |
| `tags` | `string[]` | No | `[]` | Tags for categorization and filtering. Values are trimmed, lowercased, and deduplicated automatically. |
| `date` | `string` | No | — | Publication or last-updated date in `YYYY-MM-DD` format. |
| `position` | `number` | No | `0` | Sort order within a category. Lower values appear first. Presentations with the same `position` value are sorted alphabetically by `title` as a tiebreaker. |
| `owner` | `string` | No | `""` | Team or person responsible for the presentation. Shown in search and filter interfaces. |
| `level` | `string` | No | — | Difficulty level of the presentation. Must be one of `beginner`, `intermediate`, or `advanced`. Renders a color-coded badge on cards. Invalid values are ignored with a warning. |
| `duration` | `number` | No | — | Estimated duration in minutes. Must be greater than `0`. Invalid values are ignored. |
| `lastReviewed` | `string` | No | — | ISO date (`YYYY-MM-DD`) of the last content review. |
| `deprecated` | `boolean` | No | `false` | Marks the presentation as deprecated. Shows a red "Deprecated" badge. Deprecated presentations can be hidden via the overview filter. |
| `playlist` | `string \| string[]` | No | — | One or more playlist names this presentation belongs to. Used for sequential navigation between presentations in the same playlist. |

## Complete Example

```md title="slidev/my-presentation.md"
---
title: Advanced TypeScript Patterns
description: Deep dive into conditional types, template literals, and mapped types
theme: apple-basic
addons: [excalidraw]
author: Jane Smith
tags: [typescript, advanced, patterns]
date: 2026-03-10
position: 2
owner: Platform Team
level: advanced
duration: 45
lastReviewed: 2026-04-01
deprecated: false
playlist: TypeScript Series
---

# Advanced TypeScript Patterns

Welcome!

---

# Conditional Types

```ts
type IsString<T> = T extends string ? true : false;
```

---

# Template Literal Types

```ts
type EventName = `on${Capitalize<string>}`;
```
```

## Validation

The plugin validates certain frontmatter fields and normalizes others at scan time:

- **`tags`** — Values are automatically trimmed of surrounding whitespace, lowercased, and deduplicated. `[" TypeScript ", "typescript"]` becomes `["typescript"]`.
- **`level`** — Must be one of `beginner`, `intermediate`, or `advanced` (case-sensitive after normalization). Any other value is ignored and a warning is printed to the console.
- **`duration`** — Must be a number greater than `0`. Zero, negative values, and non-numeric values are ignored.
- **`lastReviewed`** and **`date`** — Must be a valid ISO date string in `YYYY-MM-DD` format. Malformed values are ignored.
- **`deprecated`** — Must be a boolean `true` or `false`. Using `deprecated: yes` or other non-boolean truthy strings is invalid; use `deprecated: true`.
- **`position`** — Must be a number. Non-numeric values (e.g. `position: "first"`) are ignored and the default `0` is used instead. Two presentations with the same `position` are sorted alphabetically by `title`.

## Notes

- The first `---` must be on line 1 of the file.
- The closing `---` separates frontmatter from the first slide.
- Subsequent `---` lines (on their own line) separate slides from each other.
- Fields not recognized by the plugin are passed through to Slidev and can be used in slide layouts.

## Frontmatter vs Plugin Options

| Concern | Plugin Option | Frontmatter |
| --- | --- | --- |
| Theme | Sets the default for all presentations | Overrides the default for one presentation |
| Addons | Sets defaults for all presentations | Adds to (does not replace) the defaults |
| Timeout | Global build timeout | Not configurable per-presentation |
| Download | Global download button toggle | Not configurable per-presentation |
| Dry Run | Global toggle for CI validation mode | Not configurable per-presentation |
