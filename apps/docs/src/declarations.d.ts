/**
 * Type declarations for Docusaurus swizzle wrappers.
 *
 * Docusaurus resolves `@theme/*` and `@theme-original/*` via webpack aliases at
 * build time. TypeScript needs these module declarations for editor support and
 * `tsc --noEmit` checks.
 *
 * The prop shapes below mirror `packages/slidesaurus/theme/SlidevCard/index.tsx`
 * and `packages/slidesaurus/theme/SlidevOverview/index.tsx`. Update them if the
 * plugin components ever change their public API.
 */

// ── Presentation shape exposed to theme components ───────────────────────────
// Matches `Presentation` from packages/slidesaurus/src/domain/types.ts
// (= PresentationMetadata without internal path fields).
export interface SlidevPresentation {
  id: string;
  title: string;
  url: string;
  sourcePath: string;
  description?: string;
  author?: string;
  duration?: number;
  tags?: string[];
  date?: string;
  level?: "beginner" | "intermediate" | "advanced";
  deprecated?: boolean;
  thumbnailUrl?: string;
  exportUrls?: string[];
  playlist?: string[];
  position?: number;
  category?: string;
}

// ── @theme-original/SlidevCard ───────────────────────────────────────────────
declare module "@theme-original/SlidevCard" {
  import type { FC } from "react";
  import type { SlidevPresentation } from "./declarations";

  const SlidevCard: FC<{
    presentation: SlidevPresentation;
    isDev: boolean;
    horizontal?: boolean;
    /** Built-in: "default" | "compact" | "minimal". Custom values are passed through. */
    uiTheme?: string;
  }>;
  export default SlidevCard;
}

// ── @theme-original/SlidevOverview ───────────────────────────────────────────
declare module "@theme-original/SlidevOverview" {
  import type { FC } from "react";

  const SlidevOverview: FC<{ pluginId?: string }>;
  export default SlidevOverview;
}
