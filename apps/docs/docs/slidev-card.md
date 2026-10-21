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

| Prop           | Type           | Required | Default     | Description                                                                                                                                                                                                                                                                                    |
| -------------- | -------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `presentation` | `Presentation` | Yes      | —           | Full presentation object from `usePluginData()`. See [`Presentation` type](./types.md#theme-facing-types).                                                                                                                                                                                     |
| `horizontal`   | `boolean`      | No       | `false`     | When `true`, renders the image on the left and metadata on the right (list view layout).                                                                                                                                                                                                       |
| `uiTheme`      | `UITheme`      | No       | `"default"` | Visual layout variant. Set automatically from the plugin's `uiTheme` option by `SlidevOverview`. Built-in values: `"default"` (full card), `"compact"` (smaller preview, no description), `"minimal"` (text-only row). Custom strings are applied as `data-slidev-ui-theme` for CSS targeting. |

## Behavior

- **Preview**: displays the thumbnail PNG (`presentation.thumbnailUrl`) when available. If the thumbnail is missing or fails to load (for example when Playwright was not installed at build time), it falls back to a scaled, lazy-loaded iframe preview of `presentation.previewUrl` (see the sandbox note in [Presentation Page](./presentation-page.md)).
- **Presenter overlay**: a "Present" button linking to `{presentation.url}presenter/` appears on hover or keyboard focus.
- **Download overlay**: if `presentation.exportUrls` is set, download buttons appear for each format (PDF, PPTX).
- **Favorites**: a star button in the top corner toggles the card in localStorage-backed favorites.
- **Level badge**: color-coded (`beginner` → green, `intermediate` → orange, `advanced` → red).
- **Playlist badge**: shows the first playlist name and a count if the presentation belongs to multiple.
- **Deprecated badge**: shown when `presentation.deprecated === true`.

## Styling

The component uses CSS Modules ([styles.module.css](https://github.com/abraham-ando/slidesaurus/tree/main/packages/slidesaurus/theme/SlidevCard/styles.module.css)). Override styles with the `--slidev-card-*` design tokens and the `data-slidev-ui-theme` attribute, or by swizzling the component.

The root element is a `<div>` (not a link). The title `<a class="cardLink">` is stretched over the whole card with a `::after` pseudo-element, so the whole card is clickable while the favorite button and the presenter/download links stay independent siblings. If you wrote CSS targeting `a.card` or `a[data-slidev-ui-theme]` for cards, retarget it to `[data-slidev-ui-theme]` (no tag) or `.card`.

## SlidevCard vs SlidevLink

| Component    | Use Case                                                                    |
| ------------ | --------------------------------------------------------------------------- |
| `SlidevCard` | Grid/list card on the overview page — rich metadata, thumbnail preview      |
| `SlidevLink` | Inline embed inside a documentation page — compact card with iframe preview |

Use `SlidevCard` on overview-style pages. Use `SlidevLink` when cross-referencing a presentation from a doc page.
