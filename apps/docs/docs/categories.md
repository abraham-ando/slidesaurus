---
sidebar_position: 11
---

# Categories

Categories let you group presentations into logical sections on the overview page. They are defined by subdirectories inside the `path` directory, each containing a `_category_.yml` file.

## Directory Structure

```
slidev/
  intro.md                          # Uncategorized
  tutorials/
    _category_.yml                  # Category: Tutorials
    getting-started.md
    advanced-patterns.md
  workshops/
    _category_.yml                  # Category: Workshops
    react-workshop.md
    node-workshop.md
```

## `_category_.yml` Format

```yaml title="slidev/tutorials/_category_.yml"
label: Tutorials
position: 1
description: Step-by-step tutorial presentations
```

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | `string` | Yes | Display name for the category. |
| `position` | `number` | No | Sort order. Lower values appear first. |
| `description` | `string` | No | Short description displayed below the category heading. |

## How Categories Render

On the overview page, categories render as distinct sections, each with:

- A heading showing the `label`.
- An optional `description` below the heading.
- The presentations within that category, sorted by their frontmatter `position`.

Uncategorized presentations (files directly in the `path` root) appear in a default section at the top or bottom (depending on sort order).

## Nested Categories

Categories are one level deep. Subdirectories inside a category directory are **not** treated as nested categories — only the immediate subdirectories of the `path` directory define categories.

```
slidev/
  tutorials/             # ✅ Category
    _category_.yml
    basics/              # ❌ Not a nested category — treated as part of "tutorials"
      intro.md           # URL: /presentations/tutorials/basics/intro
```

## Auto-Labeling

If a subdirectory does not contain a `_category_.yml` file, the directory name is used as the label with default position `0`. The name is title-cased automatically:

- `tutorials` → "Tutorials"
- `advanced-topics` → "Advanced Topics"

## Ordering

Within a category, presentations are sorted by:

1. Frontmatter `position` (ascending, lower first).
2. Frontmatter `title` (alphabetical) as a tiebreaker.

Categories themselves are sorted by their `position` field, then alphabetically by `label`.
