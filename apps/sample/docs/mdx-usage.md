---
id: mdx-usage
sidebar_position: 3
---

# Usage in MDX

You can embed presentation preview cards anywhere in your MDX documentation using the `SlidevLink` component.

## Basic Usage

```mdx
import SlidevLink from "@theme/SlidevLink";

## See the Presentation

<SlidevLink link="/presentations/intro/getting-started" />
```

This renders a card with:
- A live iframe preview of the first slide
- The presentation title and description
- A click to open the full presentation in a new tab

## Custom Width

```mdx
<SlidevLink link="/presentations/advanced/deep-dive" width="700px" />
```

The `width` prop accepts any valid CSS length value.

## Live Example

import SlidevLink from "@theme/SlidevLink";

<SlidevLink link="/presentations/intro/getting-started" />

:::note Build required
The preview iframe only renders after `npm run build`. In dev mode, a placeholder card is displayed instead.
:::

## Presentation Frontmatter

Control what the card displays by setting frontmatter in your `.md` file:

```md
---
title: My Presentation Title       # shown in the card header
description: A one-line summary    # shown below the title
author: Jane Doe                   # shown with an author icon
tags:
  - intro
  - tutorial
position: 1                        # controls sort order in the overview
---
```

## Tips

- The `link` prop must exactly match the presentation's URL (e.g. `/presentations/intro/getting-started`)
- Categories are derived from sub-folder names inside the `path` directory
- To customise a category label or description, add a `_category_.yml` file in the folder
