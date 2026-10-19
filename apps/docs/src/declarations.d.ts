/**
 * Type declarations for Docusaurus swizzle wrappers.
 *
 * Docusaurus resolves `@theme/*` and `@theme-original/*` via webpack aliases at
 * build time. TypeScript needs these module declarations for editor support and
 * `tsc --noEmit` checks.
 *
 * IMPORTANT: this file must stay a global *script* (no top-level `import` /
 * `export`). As soon as it becomes a module, every `declare module "…"` below
 * turns into a module *augmentation* instead of a declaration and stops
 * declaring the alias.
 *
 * Types are taken from the plugin's own sources with `import("…")` type
 * expressions (relative `import` declarations are not allowed inside ambient
 * module declarations), so the shapes never drift from the real components.
 * They are type-only and erased at build time.
 * TODO: import them from "slidesaurus" once the package entry point re-exports
 * the theme types.
 */

// ── @theme-original/SlidevCard ───────────────────────────────────────────────
declare module "@theme-original/SlidevCard" {
  import type { FC } from "react";

  const SlidevCard: FC<{
    /** `Presentation` from packages/slidesaurus/src/domain/types.ts */
    presentation: import("../../../packages/slidesaurus/theme/types").Presentation;
    horizontal?: boolean;
    /** Built-in: "default" | "compact" | "minimal". Custom values are passed through. */
    uiTheme?: import("../../../packages/slidesaurus/theme/types").UITheme;
  }>;
  export default SlidevCard;
}

// ── @theme-original/SlidevOverview ───────────────────────────────────────────
declare module "@theme-original/SlidevOverview" {
  import type { FC, ReactNode } from "react";

  const SlidevOverview: FC<{
    pluginId?: string;
    /** Rendered inside the page layout, above the overview content. */
    children?: ReactNode;
  }>;
  export default SlidevOverview;
}
