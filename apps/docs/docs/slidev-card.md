---
sidebar_position: 10
---

# SlidevCard Component

`SlidevCard` renders a presentation as a visual card: thumbnail or iframe preview, title, description, author, duration, level badge, playlist badge, and download/presenter overlay actions. It is used by the overview page in both grid and list views.

## Swizzle

`SlidevCard` is **not importable directly**. Customize it by swizzling:

```bash
npx docusaurus swizzle slidesaurus SlidevCard --wrap
```

This copies the component into your site's `src/theme/SlidevCard/` directory where you can modify it.

## Props

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `presentation` | `Presentation` | Yes | — | Full presentation object from `usePluginData()`. See [`Presentation` type](./types.md#theme-facing-types). |
| `isDev` | `boolean` | Yes | — | When `true`, renders a placeholder icon instead of an iframe or thumbnail, and disables overlay actions. |
| `horizontal` | `boolean` | No | `false` | When `true`, renders the image on the left and metadata on the right (list view layout). |
| `uiTheme` | `UITheme` | No | `"default"` | Visual layout variant. Set automatically from the plugin's `uiTheme` option by `SlidevOverview`. Built-in values: `"default"` (full card), `"compact"` (smaller preview, no description), `"minimal"` (text-only row). Custom strings are applied as `data-slidev-ui-theme` for CSS targeting. |

## Behavior

- **Production mode** (`isDev: false`): displays a thumbnail PNG (`presentation.thumbnailUrl`) when available. If the thumbnail fails to load, falls back to a scaled iframe preview of `presentation.url`.
- **Dev mode** (`isDev: true`): displays a placeholder icon with a "Build Required" badge. No iframe or thumbnail is rendered.
- **Presenter overlay**: a "Present" button linking to `{presentation.url}presenter/` appears on hover (production only).
- **Download overlay**: if `presentation.exportUrls` is set, download buttons appear for each format (PDF, PPTX).
- **Favorites**: a star button in the top corner toggles the card in localStorage-backed favorites.
- **Level badge**: color-coded (`beginner` → green, `intermediate` → orange, `advanced` → red).
- **Playlist badge**: shows the first playlist name and a count if the presentation belongs to multiple.
- **Deprecated badge**: shown when `presentation.deprecated === true`.

## Styling

The component uses CSS Modules ([styles.module.css](https://github.com/abraham-ando/slidesaurus/tree/main/packages/slidesaurus/theme/SlidevCard/styles.module.css)). Override styles by targeting the generated CSS classes or by swizzling the component.

## SlidevCard vs SlidevLink

| Component | Use Case |
| --- | --- |
| `SlidevCard` | Grid/list card on the overview page — rich metadata, thumbnail preview |
| `SlidevLink` | Inline embed inside a documentation page — compact card with iframe preview |

Use `SlidevCard` on overview-style pages. Use `SlidevLink` when cross-referencing a presentation from a doc page.
