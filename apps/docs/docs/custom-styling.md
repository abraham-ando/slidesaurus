---
sidebar_position: 13
---

# Custom Styling

The plugin's theme components use CSS Modules and CSS custom properties, making them easy to customize without modifying source code.

## CSS Custom Properties

Override these variables in your site's `custom.css` to change the look of the plugin's components:

```css title="src/css/custom.css"
:root {
  --slidev-card-border-radius: 8px;
  --slidev-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  --slidev-card-hover-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  --slidev-card-padding: 1.5rem;
  --slidev-overview-gap: 1.5rem;
  --slidev-overview-columns: repeat(auto-fill, minmax(300px, 1fr));
}
```

## Swizzling Components

Docusaurus supports [component swizzling](https://docusaurus.io/docs/swizzling) — replacing or wrapping theme components with your own implementations.

### Wrap (Recommended)

Wrapping keeps the original component and lets you add behavior around it:

```bash
npx docusaurus swizzle slidesaurus SlidevOverview --wrap
```

This creates a wrapper component in `src/theme/SlidevOverview/index.tsx` that you can modify.

### Eject

Ejecting gives you a full copy of the component to modify freely:

```bash
npx docusaurus swizzle slidesaurus SlidevCard --eject
```

:::warning
Ejected components are not updated when the plugin is upgraded. Prefer wrapping when possible.
:::

## Available Components for Swizzling

| Component | Description |
|---|---|
| `SlidevOverview` | The full overview page layout |
| `SlidevCard` | Individual card in grid view |
| `SlidevListItem` | Individual row in list view |
| `SlidevCategoryCard` | Category section wrapper |
| `SlidevPresentation` | The individual presentation page with iframe |
| `SlidevLink` | The embeddable preview component |

## CSS Modules

Each component has a co-located `styles.module.css` file. When you swizzle a component, the CSS module is included. You can:

1. Modify the CSS module directly (if ejected).
2. Add global CSS overrides using more specific selectors.

## Dark Mode

All components respect Docusaurus dark mode. The CSS modules use `[data-theme="dark"]` selectors for dark-mode variants. If you override styles, remember to provide dark-mode equivalents.

```css
[data-theme="dark"] .slidev-card {
  background: var(--ifm-color-emphasis-100);
  border-color: var(--ifm-color-emphasis-300);
}
```
