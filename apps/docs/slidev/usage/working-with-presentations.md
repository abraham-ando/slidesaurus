---
title: Working with Presentations
description: Creating presentations, using frontmatter, categories, and embedding
theme: seriph
author: Training Team
tags: [presentations, frontmatter, categories]
date: 2026-04-20
position: 2
level: intermediate
owner: Documentation Team
duration: 25
lastReviewed: 2026-05-07
playlist: Deep Dive Track
---

# Working with Presentations

Create, organize, and embed Slidev decks in your docs.

---

# Anatomy of a Presentation File

```md
---
title: My Talk           ← Frontmatter (YAML)
description: A great talk
theme: seriph
author: Jane Doe
tags: [demo]
date: 2026-01-15
position: 1
---

# First Slide            ← Content starts here

Welcome!

---                       ← Slide separator

# Second Slide

More content.
```

---

# Frontmatter Fields

| Field | Type | Required | Purpose |
|---|---|---|---|
| `title` | string | **Yes** | Display name |
| `description` | string | No | Card description |
| `theme` | string | No | Theme override |
| `addons` | string[] | No | Addon override |
| `author` | string | No | Author name |
| `tags` | string[] | No | Tag labels |
| `date` | string | No | YYYY-MM-DD |
| `position` | number | No | Sort order |

---

# Slide Separators

Slides are separated by `---` on its own line:

```md
# Slide 1

Content for slide one.

---

# Slide 2

Content for slide two.

---

# Slide 3

Content for slide three.
```

Each `---` creates a new slide. The first `---` pair is the frontmatter delimiter.

---

# Organizing with Categories

Create subdirectories with `_category_.yml`:

```
slidev/
  tutorials/
    _category_.yml
    basics.md
    intermediate.md
  workshops/
    _category_.yml
    react.md
```

```yaml
# _category_.yml
label: Tutorials
position: 1
description: Step-by-step guides
```

Categories appear as grouped sections on the overview page.

---

# Sorting

**Categories** sort by: `position` → `label` (alphabetical)

**Presentations within a category** sort by: `position` → `title` (alphabetical)

```md
---
title: Alpha Talk
position: 2          ← Appears second
---
```

```md
---
title: Beta Talk
position: 1          ← Appears first
---
```

---

# Embedding with SlidevLink

Show a presentation preview inside any MDX doc page:

```tsx
import SlidevLink from "@theme/SlidevLink";

<SlidevLink link="/presentations/tutorials/basics" />
```

The `link` prop must match the URL of the presentation as it appears in your browser. Renders a clickable card with a scaled iframe preview.

---

# Embedding Multiple Previews

```tsx
import SlidevLink from "@theme/SlidevLink";

<div style={{
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "1rem"
}}>
  <SlidevLink link="/presentations/tutorials/basics" />
  <SlidevLink link="/presentations/tutorials/intermediate" />
</div>
```

Creates a 2-column grid of presentation previews.

---

# Slidev Markdown Features

Inside your slides, you can use all Slidev features:

- **Code blocks** with syntax highlighting
- **LaTeX math** with KaTeX
- **Mermaid diagrams**
- **Speaker notes** (`<!-- notes -->`)
- **Slide transitions** via frontmatter
- **Vue components** if needed

```md
# Code Example

\`\`\`ts {2-3}
function greet(name: string) {
  // highlighted lines
  return `Hello, ${name}!`;
}
\`\`\`
```

---

# Best Practices

1. **Keep slides focused** — one idea per slide
2. **Use frontmatter consistently** — always include title and description
3. **Organize early** — set up categories before you have too many files
4. **Test locally** — run `slidev dev <file>` for quick previews
5. **Use tags** — they help users filter presentations

Next: **Theming and Customization** →
