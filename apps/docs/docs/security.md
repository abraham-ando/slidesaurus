---
sidebar_position: 20
---

# Security

This page describes what the plugin does to limit risk, and what you should configure on the hosting side. To report a vulnerability, see [SECURITY.md](https://github.com/abraham-ando/slidesaurus/blob/main/SECURITY.md).

## Security model

Slidesaurus builds presentations that **you** author, on **your** machine or CI, and serves them as static files from the same origin as your Docusaurus site. Deck content is therefore trusted at the same level as the site itself. The plugin hardens everything around that boundary.

### No shell

`slidev build`, `slidev export` and the package manager are started with `execFile` / `spawn` **without a shell**. Arguments are passed as an array, so a theme name, a path or a presentation title can never be interpreted as shell syntax. On timeout (`buildTimeout`), the whole process tree is killed.

### Environment allowlist

Child processes do not inherit your environment. Only an explicit allowlist of variables (`PATH`, home/temp directories, locale, proxy and CA settings, `CI`, …) is forwarded, so secrets such as `NPM_TOKEN` or cloud credentials present in your CI never reach Slidev or its plugins.

### Frontmatter is data, never code

Frontmatter is always parsed with a safe YAML parser. The `---js` engine of gray-matter, which evaluates JavaScript, is **refused**: a deck that uses them fails validation instead of executing code in the build process.

### Themes and addons

- Only `slidev-theme-*`, `@slidev/theme-*`, `@scope/slidev-theme-*` (and the `addon` equivalents) are accepted; anything else (URLs, paths with `..`, option-like names starting with `-`) is rejected.
- `autoInstall` is **opt-in** (default `false`). When enabled, packages are installed without a shell and with `--ignore-scripts`, so a dependency cannot run an install script.
- Local themes (`./…`) must resolve inside the project directory.

### Iframe sandbox

Every presentation iframe (cards, `SlidevLink`, full-page viewer) uses one policy, `SLIDEV_IFRAME_SANDBOX`:

```
allow-scripts allow-same-origin allow-popups allow-forms allow-presentation
```

Slidev cannot run without `allow-same-origin` (opaque origins break `localStorage` and module loading). Combined with `allow-scripts` this means **the sandbox does not isolate the deck from the page**. It is acceptable only because the decks are same-site, site-owner-authored content. Consequently:

- never point `SlidevIframe` / `SlidevLink` at third-party URLs;
- do not let untrusted users contribute decks to your `path` directory;
- the sandbox still blocks top-level navigation, downloads and pointer lock.

### Public data only

The data exposed to the browser through Docusaurus global data contains no absolute paths, hooks or build options.

## Recommended HTTP headers

Set these on your hosting (Netlify `_headers`, nginx, Cloudflare, GitHub Pages is limited to meta tags — prefer a real host for headers).

| Header                    | Value                                           | Why                                                                |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| `Content-Security-Policy` | `frame-ancestors 'self'` (plus your own policy) | Stops other sites from framing your decks and site (clickjacking). |
| `X-Content-Type-Options`  | `nosniff`                                       | Prevents MIME sniffing of scripts and styles.                      |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`               | Limits referrer leakage.                                           |

:::warning `frame-ancestors` must be an HTTP header
Browsers ignore `frame-ancestors` in a `<meta http-equiv="Content-Security-Policy">` tag. It only works as a response header.
:::

Your CSP must also allow framing from your own origin for the presentations to display: use `frame-src 'self'` (or `default-src 'self'`) if you define one, and keep `frame-ancestors 'self'` (not `'none'`) because the decks are embedded in your own pages. Slidev decks use inline styles and scripts, so a strict `script-src` may need adjustments; test your policy on the built site.

Example (Netlify `_headers`):

```
/*
  Content-Security-Policy: frame-ancestors 'self'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

Example (nginx):

```nginx
add_header Content-Security-Policy "frame-ancestors 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

## Supply chain

The repository itself applies the following controls (useful as a checklist for your own site):

- `pnpm install --frozen-lockfile` in CI; `minimumReleaseAge` (24 h) and `strictDepBuilds` in `pnpm-workspace.yaml`, with build scripts restricted to an explicit allowlist.
- `pnpm audit --audit-level=high` and ESLint on every pull request; CodeQL and OpenSSF Scorecard run on a schedule.
- GitHub Actions pinned by commit SHA, with least-privilege `permissions`.
- Releases are published from CI with npm **provenance** (trusted publishing), so each version can be traced back to its source commit and workflow run.
