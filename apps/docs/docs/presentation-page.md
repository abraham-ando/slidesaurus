---
sidebar_position: 8
---

# Presentation Page

Each discovered presentation gets its own page, accessible from the overview or via a direct URL.

## URL Structure

Presentations are served under the configured `routeBasePath`. The URL slug is derived from the file path relative to the `path` directory:

| File | URL |
|---|---|
| `slidev/intro.md` | `/presentations/intro` |
| `slidev/tutorials/getting-started.md` | `/presentations/tutorials/getting-started` |
| `slidev/advanced/deep-dive.md` | `/presentations/advanced/deep-dive` |

---

## How It Works

The presentation page renders the compiled Slidev output inside an **iframe**. The plugin invokes `slidev build` for each presentation, producing a static HTML/JS bundle. In production that bundle is copied into the Docusaurus build output; in dev mode it is served from the plugin cache. Either way it is loaded in the iframe at runtime.

All plugin iframes use one sandbox policy, `SLIDEV_IFRAME_SANDBOX` (defined in the `SlidevIframe` component): `allow-scripts allow-same-origin allow-popups allow-forms allow-presentation`. Slidev needs `allow-same-origin` to work, and combining it with `allow-scripts` means the sandbox does **not** isolate the content from your site — this is safe only because presentations are built from your own sources and served from the same site. Never point these iframes at third-party URLs.

---

## Page Layout

The presentation page includes:

1. **Action bar** — contains the download links (when `download` is enabled) and the Presenter View link. Hidden with the `minimal` `uiTheme`.
2. **Resume bar** — appears when the user has a saved viewing position for this presentation.
3. **Playlist navigation bar** — appears when the presentation is part of a playlist (hidden with the `minimal` `uiTheme`).
4. **Iframe** — the Slidev presentation, filling the available viewport (it can be shown fullscreen with the browser's fullscreen control).

---

## Presenter View

The action bar contains a **Presenter View** link that opens the Slidev presenter mode (`{presentation url}presenter/`) in a new browser tab. The presenter view displays speaker notes alongside the current slide and is useful when presenting with two screens.

The link works the same way in dev mode and in production, since both serve the statically built output. Notes are only available if you did not strip them with `withoutNotes`.

---

## PDF / PPTX Download

When the `download` plugin option is set to `true`, one download button per entry of `exportFormats` (`pdf` by default, optionally `pptx`) appears in the action bar alongside the Presenter View link.

```ts title="docusaurus.config.ts"
[
  "slidesaurus",
  {
    download: true,
  },
]
```

The files are generated at build time, without starting a Vite dev server for the PDF. The **PDF** is the one `slidev build --download` prints from the built presentation (also behind the deck's own "Download" button); with `exportWithClicks`, the plugin prints the built output again, one page per click step, with the headless Chromium already used for thumbnails — same `/print` page and `page.pdf()` settings as `slidev export`. The **PPTX** — and a PDF whose headmatter sets `export.withToc` or `export.perSlide` when it must be re-printed — uses `slidev export` on the isolated copy. This requires [Playwright](https://playwright.dev/) to be installed in the project:

```bash
npm install -D playwright-chromium
npx playwright install chromium
```

If Playwright is missing, the export is skipped with a warning (`BuildResult.warnings`) and the build still succeeds — the download button then points to a file that does not exist, so install Playwright before enabling `download`.

Clicking a button downloads the pre-generated file directly — no server-side processing occurs at runtime.

:::tip
Export generation adds time to your build. `download` is a global plugin option; it cannot be toggled per presentation.
:::

---

## Resume Bar

If a user previously visited this presentation and left mid-way through, a bar appears at the **bottom of the page** on their next visit. The bar offers two actions:

- **Resume from slide N** — jumps the iframe directly to the slide where the user stopped.
- **Start from beginning** — dismisses the bar and starts at slide 1.

The last-viewed slide number is stored in `localStorage` using the key `slidev-resume-{id}`, where `{id}` is the presentation's unique identifier derived from its file path. The value is updated continuously as the user navigates between slides. Both Slidev router modes are supported: `history` (the default, slides at `<url>/N`) and `hash` (`#/N`).

Dismissing the bar (by starting from the beginning or completing the presentation) clears the stored position so the bar does not reappear on subsequent visits.

---

## Playlist Navigation Bar

When a presentation is part of a playlist (defined via the `playlist` frontmatter field — see [Frontmatter Reference](./frontmatter.md)), a navigation bar appears at the **bottom of the page**. It shows:

- The **playlist name**.
- The **current position** within the playlist (e.g. `2 / 5`).
- A **← previous** link to the preceding presentation in the playlist.
- A **next →** link to the following presentation in the playlist.

Previous and next links are disabled (and visually dimmed) when the user is at the start or end of the playlist.

The playlist bar and the resume bar can appear simultaneously if both conditions are met — they stack vertically.

---

## SEO Metadata

The presentation page automatically injects structured metadata into the document `<head>`:

### Open Graph Tags

| Tag | Value |
|---|---|
| `og:title` | The presentation's `title` frontmatter field |
| `og:description` | The presentation's `description` frontmatter field |
| `og:url` | The absolute URL of the presentation page (built from the site `url` in `docusaurus.config.ts`) |
| `og:image` | The absolute URL of the presentation's thumbnail, when available |

Set the site `url` (and `baseUrl`) correctly in `docusaurus.config.ts` so these absolute URLs are right.

### Twitter Card

When a thumbnail is present, the page sets `twitter:card` to `summary_large_image` for a rich preview in Twitter/X link unfurls. Without a thumbnail, it falls back to `summary`.

### JSON-LD Structured Data

A [`LearningResource`](https://schema.org/LearningResource) JSON-LD block is injected to improve discoverability in search engines:

```json
{
  "@context": "https://schema.org",
  "@type": "LearningResource",
  "name": "Advanced TypeScript Patterns",
  "description": "Deep dive into conditional types...",
  "author": { "@type": "Person", "name": "Jane Smith" },
  "educationalLevel": "advanced",
  "timeRequired": "PT45M",
  "dateModified": "2026-04-01",
  "keywords": "typescript, advanced, patterns"
}
```

Only `@context`, `@type` and `name` are always present. `description`, `author`, `educationalLevel` (from `level`), `timeRequired` (from `duration`), `dateModified` (from `lastReviewed`) and `keywords` (from `tags`) are omitted when the corresponding frontmatter values are not set.

---

## Keyboard Navigation

Inside the iframe, standard Slidev keyboard shortcuts work:

| Key | Action |
|---|---|
| `→` / `Space` | Next slide |
| `←` | Previous slide |
| `f` | Toggle fullscreen |
| `o` | Toggle slide overview |
| `d` | Toggle dark mode |

---

## Dev Mode vs Production

### Production (`docusaurus build`)

Full Slidev builds run for every discovered presentation (incrementally, see [Parallel Builds](./parallel-builds.md)). The iframe loads the compiled static output copied into the Docusaurus build directory. If any presentation fails to build, the whole `docusaurus build` fails.

### Dev Mode (`docusaurus start`)

In dev mode the plugin uses the **same build pipeline as production**, but **in the background**: the site opens at once and `buildAllPresentations()` (incremental SHA-256 cache applies) runs behind it. The built static files are served by webpack's devServer from the plugin cache directory. There are no external Slidev processes or port proxying involved.

Until a presentation has been built, its page shows **"Building this presentation…"**, then opens the deck by itself when the output is ready. A failed build shows its error instead (details in the terminal). When an already-built deck is rebuilt after a save, the previous build stays visible and the iframe reloads on the current slide once the new one is ready. See [Dev Server](./dev-server.md#what-the-presentation-page-shows).

If `@slidev/cli` is **not installed**, nothing is built, a warning is logged and the page reports the failure. There is no Slidev hot module replacement in this mode.

:::tip Fast slide editing loop
The Docusaurus watch cycle (file change → `loadContent()` → background rebuild → the presentation page reloads its iframe) is sufficient for reviewing content changes. For **Vite HMR** on a single deck while authoring, run Slidev's own dev server in a separate terminal:

```bash
# Terminal 1 — full docs site
pnpm dev:docs

# Terminal 2 — live Slidev HMR for the deck you are editing
cd slidev && slidev my-talk.md
```

Open the Slidev window for instant feedback; the Docusaurus tab shows the integrated result once the incremental rebuild completes.
:::
