---
sidebar_position: 11
---

# Categories

Categories let you group presentations into logical sections on the overview page. They are defined by subdirectories inside the `path` directory, optionally described by a `_category_.yml` (or `_category_.yaml` / `_category_.json`) file.

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
| `label` | `string` | No | Display name for the category. Defaults to the title-cased directory name. |
| `position` | `number` | No | Sort order. Lower values appear first. Defaults to `99`. |
| `description` | `string` | No | Short description displayed below the category heading. |

## How Categories Render

On the overview page, categories render as distinct sections, each with:

- A heading showing the `label`.
- An optional `description` below the heading.
- The presentations within that category, sorted by their frontmatter `position`.

Uncategorized presentations (files directly in the `path` root) are sorted among themselves like any other presentations (see [Ordering](#ordering)) and rendered in a default section.

## Nested Categories

Every subdirectory (at any depth) that contains presentations is a category, identified by its path relative to `path` (e.g. `tutorials/basics`). A nested category is listed under its parent and has its own `_category_.yml`; its presentation count only includes the files directly inside it.

```
slidev/
  tutorials/             # Category "tutorials"
    _category_.yml
    basics/              # Category "tutorials/basics"
      intro.md           # URL: /presentations/tutorials/basics/intro
```

Directories whose name starts with `.` or `_`, `node_modules` and `sections/` are never scanned; symlinks are not followed.

## Auto-Labeling

If a subdirectory does not contain a category file (or it is invalid — a warning is logged), the directory name is used as the label with the default position `99`. The name is title-cased automatically:

- `tutorials` → "Tutorials"
- `advanced-topics` → "Advanced Topics"

## Ordering

Within a category, presentations are sorted by:

1. Frontmatter `position` (ascending, lower first; presentations without one come last).
2. Source path (natural order).
3. Frontmatter `title` as a final tiebreaker.

Categories themselves are sorted by their `position` field, then alphabetically by `label`. The sort button on the overview page reverses both orders.

## Empty Categories

A category directory that contains no `.md` presentations (even with a `_category_.yml`) is silently skipped — it does not appear as an empty section on the overview page. The directory and its metadata are still valid; the category becomes visible as soon as at least one presentation is added to it.

## Categories and Playlists

The two systems are orthogonal and can be combined freely. A presentation can belong to a category (via its directory location) **and** to one or more playlists (via the `playlist` frontmatter field) at the same time.

- **Category** controls where the presentation card appears on the overview page (which group heading it falls under).
- **Playlist** controls sequential navigation between presentations (previous/next links on the presentation page) and adds filter chips to the overview page.

There is no conflict: assigning a presentation to a playlist does not move it out of its category, and placing it in a category does not affect playlist order.
