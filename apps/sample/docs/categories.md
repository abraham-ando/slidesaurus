---
id: categories
sidebar_position: 4
---

# Categories

The plugin automatically creates a category for each sub-folder inside your `path` directory.

## File Structure Example

```
slidev/
├── intro/
│   ├── _category_.yml          ← optional metadata
│   ├── getting-started.md
│   └── installation.md
└── advanced/
    ├── _category_.yml
    ├── deep-dive.md
    └── theming.md
```

This generates the following routes:

| Route                                  | Content                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| `/presentations`                       | Root overview (lists both categories)                       |
| `/presentations/intro`                 | Category overview (lists `getting-started`, `installation`) |
| `/presentations/advanced`              | Category overview (lists `deep-dive`, `theming`)            |
| `/presentations/intro/getting-started` | The individual Slidev presentation                          |

## _category_.yml

Place a `_category_.yml` (or `.yaml` / `.json`) file inside any sub-folder to customise it:

```yaml title="slidev/intro/_category_.yml"
label: Introduction # display name (default: auto-formatted folder name)
description: Getting started # shown as subtitle on the category page
position: 1 # sort order among categories
```

## Nested Categories

Folders can be nested arbitrarily deep:

```
slidev/
└── workshops/
    └── 2026/
        └── berlin.md
```

This creates a category `workshops/2026` accessible at `/presentations/workshops/2026`.

## Sorting

Within a category page, presentations are sorted by:

1. `position` frontmatter (ascending by default)
2. Source file path (natural sort)
3. Title (natural sort)

The sort direction can be toggled by the visitor using the sort button on the overview page.
