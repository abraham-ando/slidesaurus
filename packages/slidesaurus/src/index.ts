/**
 * Slidesaurus plugin — Rollup entry point.
 *
 * This file is the sole entry point compiled by Rollup to `lib/index.cjs` (require)
 * and `lib/index.mjs` (import), with bundled types in `lib/index.d.cts` / `lib/index.d.mts`.
 * The theme components are compiled separately to `lib/theme/` (scripts/build-theme.mjs).
 * It re-exports everything from the presentation layer so external callers
 * (`docusaurus.config.ts`, type consumers) continue to import from "slidesaurus".
 *
 * Business logic lives in `presentation/plugin.ts`; this file must remain a
 * thin re-export with no logic of its own.
 */
export {
  default,
  getSwizzleComponentList,
  validateOptions,
} from "./presentation/plugin";
export type { SlidesaurusPluginOptions } from "./presentation/plugin";
// Default of `maxParallelBuilds` — lets a config share the budget between sites
// built at the same time (monorepo).
export { defaultMaxParallelBuilds } from "./shared/utils";

// Public types — hooks (`transformFrontmatter`, `onPresentationScanned`,
// `onBuildComplete`) and swizzled theme components rely on these shapes.
export type {
  BuildResult,
  BuildStatusFile,
  Category,
  CategoryMetadata,
  CorePresentationMetadata,
  EnrichedPresentationMetadata,
  ExportFormat,
  PlaylistData,
  PluginConfig,
  PluginData,
  PluginOptions,
  Presentation,
  PresentationBuildStatus,
  PresentationLevel,
  PresentationMetadata,
  SlidevFrontmatter,
  UITheme,
} from "./domain/types";
