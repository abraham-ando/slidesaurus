---
sidebar_position: 12
---

# Playlists

Playlists are ordered sequences of presentations that users can navigate one after another. They are defined entirely in frontmatter — no separate configuration file is needed.

## What are playlists?

A playlist groups related presentations into a named sequence. Once a presentation belongs to a playlist, the UI surfaces navigation controls so readers can move through the sequence without returning to the overview page. Multiple playlists can exist side by side, and a single presentation can belong to more than one playlist.

## Defining a playlist in frontmatter

Add the `playlist` field to a presentation's frontmatter to enroll it in a playlist. Use the `position` field to control its order within that playlist.

### Single playlist

```yaml
---
title: Intro to TypeScript
playlist: TypeScript Fundamentals
position: 1
---
```

### Multiple playlists

```yaml
---
title: Advanced Types
playlist:
  - TypeScript Fundamentals
  - Advanced Track
position: 2
---
```

When a presentation belongs to multiple playlists, the same `position` value is used for all of them. If you need different positions in different playlists, keep the presentations in separate files.

## How ordering works

Presentations within a playlist are sorted by two criteria, applied in order:

1. **`position`** — ascending numeric order.
2. **Presentation ID** — alphabetical order, used as a tiebreaker when two presentations share the same `position`.

This means you can leave gaps between positions (`1, 3, 5`) without affecting the rendered order, which makes it easy to insert new presentations later without renumbering everything.

## Navigation UI

### Presentation page

When a presentation is part of a playlist, a dark navigation bar appears directly below the iframe. It shows:

- The playlist name.
- The current position within the playlist, e.g. **2 / 5**.
- A **← Previous** link to the preceding presentation.
- A **Next →** link to the following presentation.

The bar is absent for presentations that do not belong to any playlist, and also absent for the first or last item where the corresponding link would have no target.

### Overview page

Two playlist-related elements appear on the overview page:

- **Filter chips** — a row of playlist chip buttons alongside the tag and level filters. Clicking a chip filters the grid or list to that playlist's presentations, displayed in playlist order.
- **Sidebar section** — a "Playlists" section lists every playlist by name. Clicking a playlist name applies the same filter as the chip.

### Cards and list items

Each card and list row shows a small playlist badge below the title. The badge displays the first playlist the presentation belongs to. When the presentation belongs to more than one playlist, a `+N` suffix indicates how many additional playlists were omitted, e.g. **TypeScript Fundamentals +1**.

## Playlist IDs

Playlist names are converted to URL-safe slugs automatically:

- Lowercased.
- Spaces replaced with hyphens.
- Special characters removed.

**Example:** `"TypeScript Fundamentals"` becomes `typescript-fundamentals`.

The slug appears in the `?playlist=` query parameter when a playlist filter is active on the overview page, making filtered views bookmarkable and shareable.

## Validation

The scanner validates playlist values during content loading. Entries that are not strings — for example a bare number (`- 42`) — are ignored and a warning is printed to the console. All valid string entries are accepted regardless of whether any other presentation references the same playlist name.

## Complete example

The following directory contains four presentations that all belong to the `Onboarding Track` playlist.

```
slidev/
  01-welcome.md
  02-setup.md
  03-core-concepts.md
  04-next-steps.md
```

`slidev/01-welcome.md`:

```yaml
---
title: Welcome
description: Introduction to the onboarding program.
author: Alice
playlist: Onboarding Track
position: 1
---
```

`slidev/02-setup.md`:

```yaml
---
title: Setup Your Environment
description: Installing and configuring the required tools.
author: Alice
playlist: Onboarding Track
position: 2
---
```

`slidev/03-core-concepts.md`:

```yaml
---
title: Core Concepts
description: Key ideas you will use every day.
author: Bob
playlist: Onboarding Track
position: 3
---
```

`slidev/04-next-steps.md`:

```yaml
---
title: Next Steps
description: Where to go after onboarding.
author: Bob
playlist: Onboarding Track
position: 4
---
```

With this setup:

- The overview page shows an **Onboarding Track** filter chip in the filter bar and a matching entry in the sidebar Playlists section.
- Each presentation page shows the playlist navigation bar with position indicators and previous/next links.
- Clicking the chip on the overview page shows only the four presentations, sorted by their `position` values.

## Modifying a Playlist

There is no central playlist configuration file. All playlist membership is declared in each presentation's frontmatter. To modify a playlist:

- **Change the order** — update the `position` value in the relevant presentation's frontmatter.
- **Remove a presentation** — delete the `playlist` field (or remove the playlist name from the array) in that presentation's frontmatter.
- **Rename a playlist** — update the `playlist` string in every presentation that references it. The old name disappears automatically once no presentation references it.
- **Delete a playlist** — remove the `playlist` field from all presentations that belong to it.
