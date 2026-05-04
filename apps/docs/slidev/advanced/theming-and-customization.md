---
title: Theming and Customization
description: Customize the look and feel of your presentations and plugin components
theme: seriph
author: Training Team
tags: [theming, customization, css]
date: 2026-02-01
position: 1
level: advanced
owner: Documentation Team
duration: 35
lastReviewed: 2026-04-01
playlist: Deep Dive Track
---

# Theming and Customization

Make your presentations and overview page look exactly the way you want.

---

# Slidev Themes

Themes control how your **slides** look:

- Fonts, colors, layouts
- Code block styling
- Component templates

**Official themes** → `@slidev/theme-*`
**Community themes** → `slidev-theme-*`

Set globally or per-presentation:

```ts
// Global
{ theme: "seriph" }
```

```yaml
# Per-presentation frontmatter
theme: apple-basic
```

---

# Popular Themes

| Theme | Style |
|---|---|
| `default` | Clean, minimal |
| `seriph` | Serif typography, professional |
| `apple-basic` | Apple keynote inspired |
| `dracula` | Dark, developer-friendly |
| `bricks` | Colorful card layouts |

Browse the gallery: **sli.dev/themes/gallery**

---

# Docusaurus Component Styling

The plugin ships theme components for the **Docusaurus site** (overview page, cards, etc.). These use **CSS Modules** and **CSS custom properties**.

Override variables in your `custom.css`:

```css
:root {
  --slidev-card-border-radius: 12px;
  --slidev-card-shadow: 0 4px 12px rgba(0,0,0,0.1);
  --slidev-overview-gap: 2rem;
}
```

---

# Swizzling Components

Replace or wrap any plugin component:

```bash
# Wrap (recommended — preserves original)
npx docusaurus swizzle \
  slidesaurus SlidevCard --wrap

# Eject (full copy to modify)
npx docusaurus swizzle \
  slidesaurus SlidevCard --eject
```

Available components:
- `SlidevOverview`
- `SlidevCard`
- `SlidevListItem`
- `SlidevCategoryCard`
- `SlidevPresentation`
- `SlidevLink`

---

# Dark Mode Support

All plugin components respect Docusaurus dark mode automatically.

When customizing CSS, provide dark-mode variants:

```css
:root {
  --slidev-card-bg: #ffffff;
}

[data-theme="dark"] {
  --slidev-card-bg: #1e1e2e;
}
```

---

# Custom Fonts

You can load custom fonts in your Docusaurus site and they will apply to the overview page:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter&display=swap');

:root {
  --ifm-font-family-base: 'Inter', sans-serif;
}
```

For slide content, fonts are controlled by the Slidev theme.

---

# Custom Overview Layout

Wrap `SlidevOverview` to add a custom header:

```tsx
// src/theme/SlidevOverview/index.tsx
import React from "react";
import SlidevOverview from "@theme-original/SlidevOverview";

export default function SlidevOverviewWrapper(props) {
  return (
    <div>
      <div className="custom-banner">
        <h2>Welcome to our presentations</h2>
      </div>
      <SlidevOverview {...props} />
    </div>
  );
}
```

---

# Recap

| What | How |
|---|---|
| Slide appearance | Slidev `theme` option |
| Overview page look | CSS custom properties |
| Full component control | Docusaurus swizzling |
| Dark mode | Automatic, customizable |
| Fonts | CSS `@import` or theme config |

Next: **Best Practices** →
