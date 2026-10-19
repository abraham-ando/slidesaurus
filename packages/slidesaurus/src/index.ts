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
  SlidesaurusPluginOptions,
} from "./presentation/plugin";
