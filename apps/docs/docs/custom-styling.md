---
sidebar_position: 13
---

# Custom Styling

Slidesaurus offers three complementary customisation layers — from the simplest (a plugin option) to the most powerful (full component replacement).

| Layer | Mechanism | Best for |
|---|---|---|
| 1 | `uiTheme` option | Switching between built-in layouts |
| 2 | CSS custom properties | Restyling cards/components without touching code |
| 3 | Component swizzling | Adding extra DOM elements or replacing layout entirely |

---

## 1 · `uiTheme` Option

Set `uiTheme` in `docusaurus.config.ts` to choose the layout variant for all plugin components:

```ts title="docusaurus.config.ts"
plugins: [
  [
    "slidesaurus",
    {
      uiTheme: "compact", // "default" | "compact" | "minimal" | any string
    },
  ],
],
```

### Built-in variants

| Value | Description |
|---|---|
| `"default"` | Full cards — 16:9 preview area, description, metadata, badges. |
| `"compact"` | Narrower preview (80 px height), no description. Same DOM as `default`, pure CSS. |
| `"minimal"` | Text-only rows, no thumbnails, no sidebar. Different DOM structure — grid view is disabled. |

### How it works under the hood

Every component root element receives the attribute `data-slidev-ui-theme="{value}"`. Built-in CSS Modules use attribute selectors to apply the variant:

```css
/* Inside SlidevCard/styles.module.css */
.card[data-slidev-ui-theme="compact"] .preview { height: 80px; }
.card[data-slidev-ui-theme="compact"] .description { display: none; }
```

This means **any string** you pass as `uiTheme` is set on the element — custom values are passed through as-is, giving you a CSS extension point without swizzling.

:::note Card structure
`SlidevCard` and `SlidevListItem` roots are `<div>` elements, not links: the title `<a class="cardLink">` is stretched over the card with `.cardLink::after` (the "card link" pattern), and the favorite button, presenter and download links are siblings placed above it. CSS written for the former `a.card` root must target `[data-slidev-ui-theme]` or the `.card` class instead of an `a` selector. Category cards (`SlidevCategoryCard`, category rows in `SlidevListItem`) are still links.
:::

---

## 2 · CSS Custom Properties (Design Tokens)

Override these CSS custom properties in your site's `src/css/custom.css` to restyle cards globally. They are consumed by the CSS Modules via `var(--token, fallback)`.

### Card tokens

| Token | Default | Controls |
|---|---|---|
| `--slidev-card-bg` | `var(--ifm-card-background-color)` | Card background |
| `--slidev-card-shadow` | Subtle 1 px border + drop shadow | Card shadow at rest |
| `--slidev-card-radius` | `8px` | Card corner radius |
| `--slidev-card-hover-transform` | `translateY(-3px)` | Card lift animation on hover |
| `--slidev-card-hover-shadow` | Elevated shadow | Card shadow on hover |
| `--slidev-card-preview-bg` | Gradient using primary colour | Preview area background |
| `--slidev-card-title-color` | `var(--ifm-heading-color)` | Card title colour |

### Example: brand colour override

```css title="src/css/custom.css"
:root {
  --slidev-card-radius: 12px;
  --slidev-card-bg: #f8f5ff;
  --slidev-card-hover-shadow: 0 8px 32px rgba(124, 58, 237, 0.18);
  --slidev-card-title-color: #3b0764;
}

[data-theme="dark"] {
  --slidev-card-bg: #1a0a3a;
  --slidev-card-title-color: #e9d5ff;
}
```

---

## 3 · Custom `uiTheme` via CSS

Since every component root carries `data-slidev-ui-theme`, you can write a fully custom theme in plain CSS — no swizzling required.

### Step 1 — Set the option

```ts title="docusaurus.config.ts"
plugins: [["slidesaurus", { uiTheme: "glass" }]],
```

### Step 2 — Create a theme CSS file

```css title="src/css/themes/glass.css"
/* Design tokens — light mode
   Use the attribute selector without a tag: card roots are <div> elements
   (SlidevCard, SlidevListItem), while category cards are <a> links. */
[data-slidev-ui-theme="glass"] {
  --slidev-card-bg:              rgba(255, 255, 255, 0.55);
  --slidev-card-shadow:          0 4px 24px rgba(124, 58, 237, 0.08),
                                 inset 0 0 0 1px rgba(255, 255, 255, 0.7);
  --slidev-card-radius:          14px;
  --slidev-card-hover-transform: translateY(-4px) scale(1.01);
  --slidev-card-hover-shadow:    0 12px 40px rgba(124, 58, 237, 0.22),
                                 inset 0 0 0 1.5px rgba(124, 58, 237, 0.5);
  --slidev-card-preview-bg:      linear-gradient(
                                   135deg,
                                   rgba(196, 181, 253, 0.4) 0%,
                                   rgba(167, 139, 250, 0.5) 100%
                                 );
  --slidev-card-title-color:     #3b0764;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

/* Dark mode overrides */
[data-theme="dark"] [data-slidev-ui-theme="glass"] {
  --slidev-card-bg:           rgba(15, 10, 40, 0.55);
  --slidev-card-shadow:       0 4px 24px rgba(0, 0, 0, 0.4),
                              inset 0 0 0 1px rgba(167, 139, 250, 0.15);
  --slidev-card-hover-shadow: 0 12px 40px rgba(124, 58, 237, 0.4),
                              inset 0 0 0 1.5px rgba(167, 139, 250, 0.6);
  --slidev-card-preview-bg:   linear-gradient(
                                135deg,
                                rgba(76, 29, 149, 0.5) 0%,
                                rgba(109, 40, 217, 0.5) 100%
                              );
  --slidev-card-title-color:  #e9d5ff;
}

/* Gradient title on the overview banner */
[data-slidev-ui-theme="glass"] .title {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Step 3 — Import in `custom.css`

```css title="src/css/custom.css"
@import "./themes/glass.css";
```

:::tip
The `glass` theme above is included in the documentation site's source code at [`apps/docs/src/css/themes/glass.css`](https://github.com/abraham-ando/slidesaurus/tree/main/apps/docs/src/css/themes/glass.css) as a ready-to-use reference.
:::

---

## 4 · Component Swizzling

Docusaurus supports [component swizzling](https://docusaurus.io/docs/swizzling) — replacing or wrapping theme components with custom implementations.

### Wrap (recommended)

Creates a thin wrapper around the original component; the original continues to render unchanged:

```bash
npx docusaurus swizzle slidesaurus SlidevCard --wrap
```

This generates `src/theme/SlidevCard/index.tsx`. Import the original via `@theme-original/SlidevCard` and add your behaviour:

```tsx title="src/theme/SlidevCard/index.tsx"
import OriginalSlidevCard from "@theme-original/SlidevCard";

type Props = React.ComponentProps<typeof OriginalSlidevCard>;

export default function SlidevCard(props: Props) {
  const { presentation } = props;

  // Example: add a "New" ribbon for presentations published in the last 30 days
  const isNew = presentation.date
    ? Date.now() - new Date(presentation.date).getTime() < 30 * 86_400_000
    : false;

  return (
    <div style={{ position: "relative" }}>
      {isNew && (
        <span style={{ position: "absolute", top: 10, right: 0, zIndex: 10,
                       background: "var(--ifm-color-primary)", color: "#fff",
                       padding: "2px 8px", borderRadius: "3px 0 0 3px",
                       fontSize: "0.65rem", fontWeight: 700 }}>
          ✨ New
        </span>
      )}
      <OriginalSlidevCard {...props} />
    </div>
  );
}
```

### Eject

Copies the full component source so you can modify its internals:

```bash
npx docusaurus swizzle slidesaurus SlidevCard --eject
```

:::warning
Ejected components are **not updated** when the plugin is upgraded. Prefer wrapping when possible.
:::

### Available components

| Component | Description |
|---|---|
| `SlidevOverview` | Full overview page — search bar, filters, grid/list, sidebar, cards |
| `SlidevCard` | Single presentation card (grid view + horizontal list mode) |
| `SlidevCategoryCard` | Single category card (grid view + horizontal list mode) |
| `SlidevListItem` | Single row in list view (presentations and categories) |
| `SlidevPresentation` | Individual presentation page — iframe, presenter link, resume bar, playlist bar |
| `SlidevLink` | Embeddable inline preview component for MDX pages (importable via `@theme/SlidevLink`; not in the swizzle list) |

`SlidevOverview` is composed of internal sub-components (filter bar, sidebar, grid, list) and hooks that live in its folder; they are an implementation detail and are not swizzlable separately. Wrapping `SlidevOverview` (or `SlidevCard`) keeps working unchanged, and the DOM structure and CSS class names described on this page are stable.

All iframes go through the internal `SlidevIframe` component, which applies the single sandbox policy `SLIDEV_IFRAME_SANDBOX` (`allow-scripts allow-same-origin allow-popups allow-forms allow-presentation`). That combination is only safe for content you build and serve yourself; do not use it to embed third-party pages.

### Wrap example — team banner above the overview

```tsx title="src/theme/SlidevOverview/index.tsx"
import Link from "@docusaurus/Link";
import OriginalSlidevOverview from "@theme-original/SlidevOverview";

type Props = React.ComponentProps<typeof OriginalSlidevOverview>;

export default function SlidevOverview(props: Props) {
  return (
    // `children` are rendered inside the page layout, above the overview
    <OriginalSlidevOverview {...props}>
      {/* Custom banner injected above the original overview */}
      <div style={{ background: "var(--ifm-color-primary-lightest)",
                    borderRadius: 12, padding: "1rem 2rem", margin: "0 0 0.5rem",
                    display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ fontSize: "2rem" }}>🦕</span>
        <div>
          <strong>Engineering Learning Hub</strong>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>
            Curated presentations from the team
          </p>
        </div>
        <Link to="https://github.com/your-org/slidesaurus"
              style={{ marginLeft: "auto" }}>
          Contribute →
        </Link>
      </div>
    </OriginalSlidevOverview>
  );
}
```

:::tip Full examples
Complete swizzle wrapper implementations (with CSS modules, ribbon styles, and TypeScript declarations) are available in the documentation site's source at [`apps/docs/src/theme/`](https://github.com/abraham-ando/slidesaurus/tree/main/apps/docs/src/theme/).
:::

---

## Dark Mode

All built-in components use `[data-theme="dark"]` selectors for dark-mode variants. When overriding CSS custom properties, always provide a dark-mode counterpart:

```css
:root {
  --slidev-card-bg: #f8f5ff;
}

[data-theme="dark"] {
  --slidev-card-bg: #1a0a3a;
}
```
