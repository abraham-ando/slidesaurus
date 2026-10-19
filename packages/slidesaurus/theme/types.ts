/**
 * Theme component types — re-exported from the plugin's canonical type definitions.
 * This avoids duplication and ensures theme types stay in sync with the plugin.
 */
export type {
  Presentation,
  Category,
  PlaylistData,
  PluginConfig,
  PluginData,
  PresentationLevel,
  UITheme,
} from "../src/domain/types";

// Type-only import: erased at compile time so the published theme never loads
// `src/` at runtime. The annotation below makes `tsc` fail if the two drift.
import type { PLUGIN_NAME as CANONICAL_PLUGIN_NAME } from "../src/domain/constants";

export const PLUGIN_NAME: typeof CANONICAL_PLUGIN_NAME = "slidesaurus";

export const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
