---
sidebar_position: 7
---

# Overview Page

The plugin automatically generates an overview page that lists all discovered presentations. This page is served at the `routeBasePath` you configured (default: `/slidev`).

## Overview

The overview page is powered by the `SlidevOverview` theme component. It reads the list of presentations (with metadata, category info, and playlist assignments) from the plugin's global data, which `contentLoaded` registers. Only public fields are exposed to the browser — absolute file paths are never included.

At a glance, the page provides:

- A **title** and **tagline** (from `pageTitle` and `pageTagline` in your plugin config).
- A **sticky sidebar** for category and playlist navigation (when categories or playlists exist).
- A **search bar** and **filter row** for narrowing down the list.
- **Grid and list view** modes, with the preference persisted in `localStorage`.
- **Shareable URLs** — active filters are reflected in the page's query string so a link always restores the same view.

---

## Search and Filters

### Full-Text Search Bar

A real-time search input filters presentations as you type. The search runs against the following fields simultaneously:

- `title`
- `description`
- `author`
- `owner`
- `tags`

No submit action is required — results update on every keystroke.

### Sort Toggle

A sort button next to the search bar toggles the sort direction. Presentations are ordered by their `position` frontmatter (those without one come last), then by source path, then by title; **Z → A** reverses that order. The selected direction is stored in `localStorage` and restored on the next visit.

### Filter Row

Below the search bar, a row of filter controls allows you to narrow results further. All filters combine with AND logic — a presentation must satisfy every active filter to appear.

| Control | What it does |
|---|---|
| **Level select** | Filter to `Beginner`, `Intermediate`, or `Advanced`. Shows `All levels` when inactive. |
| **Author select** | Filter to a single author. The list is built from all unique `author` values in the discovered presentations. |
| **Tag chips** | Multi-select tag chips. Selecting multiple tags uses AND logic — only presentations that carry **all** selected tags are shown. |
| **Playlist chips** | Selecting a playlist chip filters to presentations in that playlist and displays them in playlist order. |
| **Favorites button** | When active, shows only presentations the user has bookmarked (starred). |
| **Hide deprecated button** | When active, hides presentations marked `deprecated: true` in their frontmatter. |
| **Reset button** | Clears all active filters, the search query, and any selected tags or playlist. Appears only when at least one filter is active. |

#### Tag AND Logic Example

If a user selects the `typescript` and `advanced` chips, only presentations that have **both** tags in their frontmatter are shown:

```yaml
tags: [typescript, advanced, patterns]   # ✅ shown
tags: [typescript, beginner]             # ❌ hidden — missing "advanced"
tags: [javascript, advanced]             # ❌ hidden — missing "typescript"
```

---

## Shareable URL State

Every active filter is reflected in the page URL as a query parameter. This means the current view can be bookmarked or shared and the recipient will land on the exact same filtered state.

| Query parameter | Controlled by |
|---|---|
| `?q=react` | Search bar |
| `?level=intermediate` | Level select |
| `?author=Jane+Smith` | Author select |
| `?tags=typescript,advanced` | Tag chip selection (comma-separated) |
| `?playlist=TypeScript+Series` | Playlist chip selection |
| `?hide_deprecated=1` | Hide deprecated toggle |

All parameters are optional and combinable:

```
/slidev?q=typescript&level=advanced&hide_deprecated=1
```

When the page loads with these parameters in the URL, the corresponding controls are pre-populated and the presentation list is immediately filtered.

---

## Sidebar Navigation

When categories or playlists are defined, a sticky sidebar appears on the left side of the page. It is always visible on desktop (viewports wider than 992px) and collapses into a hidden panel on mobile.

The sidebar contains:

- **All Presentations** — a link that clears any active category or playlist selection and shows all items. The total count is shown alongside the label.
- **Category list** — one entry per category, each showing the category label and the number of presentations it contains. Clicking a category scrolls the main area to that category's section.
- **Playlists section** — one entry per playlist, each showing the playlist name and item count. Clicking a playlist is equivalent to selecting that playlist chip in the filter row.

---

## Favorites

Users can bookmark any presentation by clicking the **star icon** on its card. Bookmarked presentations display a filled star badge. The set of favorites is stored in `localStorage` under a key scoped to the plugin instance, so favorites persist across browser sessions.

To browse only bookmarked presentations, activate the **Favorites** button in the filter row. This filter combines with all other active filters.

---

## Playlists Filter

Presentations can belong to one or more playlists via the `playlist` frontmatter field (see [Frontmatter Reference](./frontmatter.md)). When a playlist chip is selected in the filter row (or via the sidebar):

- Only presentations in that playlist are shown.
- Results are sorted by their position within the playlist rather than by the global sort order.
- Each card shows a **playlist badge** indicating which playlist(s) it belongs to.

Selecting a different playlist chip replaces the previous selection — only one playlist can be active at a time.

---

## Grid vs List View

Users can toggle between two view modes using the toggle in the top-right of the content area:

- **Grid view** — a responsive card grid. Each card is rendered by the `SlidevCard` component and shows the thumbnail, title, description, author, duration, level badge, playlist badges, and favorites star.
- **List view** — a compact list. Each row is rendered by the `SlidevListItem` component. Hovering a list row reveals a **thumbnail preview** of the first slide.

The selected view is persisted in `localStorage` and restored on every subsequent visit.

---

## Card Badges

Each presentation card and list item can display the following badges:

| Badge | Source |
|---|---|
| Level badge (`Beginner` / `Intermediate` / `Advanced`) | `level` frontmatter field |
| Deprecated badge (red) | `deprecated: true` in frontmatter |
| Playlist badge(s) | `playlist` frontmatter field |
| Favorites star | User action — stored in `localStorage` |

---

## Component Hierarchy

```
SlidevOverview
├── Sidebar (categories + playlists)
├── SearchBar + SortToggle
├── FilterRow (level, author, tags, playlist chips, favorites, deprecated, reset)
└── Main area
    ├── CategoryCard (one per category)
    │   └── SlidevCard / SlidevListItem (per presentation)
    └── SlidevCard / SlidevListItem (uncategorized presentations)
```

---

## Customizing the Overview

### Plugin Config

Control the title, tagline, and layout variant through your plugin options:

```ts title="docusaurus.config.ts"
[
  "slidesaurus",
  {
    routeBasePath: "/presentations",
    pageTitle: "All Presentations",
    pageTagline: "Browse slide decks from the team",
    uiTheme: "compact", // "default" | "compact" | "minimal" | any string
  },
]
```

### Layout variants (`uiTheme`)

| `uiTheme` | Effect on the overview page |
|---|---|
| `"default"` | Full cards, sidebar visible when categories exist, grid + list view toggle. |
| `"compact"` | Smaller card previews (80 px), no description text. Grid and list toggle still present. |
| `"minimal"` | Text-only rows, no thumbnails. **Sidebar hidden.** View toggle hidden (list only). |

### CSS Variables

Override the plugin's CSS custom properties to change the visual style without modifying source code (see [Custom Styling](./custom-styling.md)):

```css title="src/css/custom.css"
:root {
  --slidev-card-radius: 12px;
  --slidev-card-hover-shadow: 0 8px 32px rgba(124, 58, 237, 0.2);
}
```

### Swizzling

Use Docusaurus component swizzling to replace or wrap any theme component:

```bash
npx docusaurus swizzle slidesaurus SlidevOverview --wrap
```

`SlidevOverview` accepts optional `children`, rendered inside the page layout (below the navbar, above the overview). A swizzle wrapper can use this to inject a banner without rendering a second `<Layout>`:

```tsx title="src/theme/SlidevOverview/index.tsx"
import OriginalSlidevOverview from "@theme-original/SlidevOverview";

export default function SlidevOverview(props) {
  return (
    <OriginalSlidevOverview {...props}>
      <div>My banner</div>
    </OriginalSlidevOverview>
  );
}
```

Cards are rendered as a `<div>` with the title link stretched over the whole card (the "card link" pattern), so the favorite, presenter and download controls are never nested inside a link. See [Custom Styling](./custom-styling.md) for the full guide including a custom `uiTheme` CSS example and complete swizzle wrapper patterns.
