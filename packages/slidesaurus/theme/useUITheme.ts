import { usePluginData } from "@docusaurus/useGlobalData";
import type { PluginData, UITheme } from "./types";
import { PLUGIN_NAME } from "./types";

/**
 * Returns the active `uiTheme` variant for the given plugin instance.
 * Falls back to `"default"` when the data is not yet available (SSR or
 * when called outside of a plugin-rendered route).
 */
export function useUITheme(pluginId = "default"): UITheme {
  const data = usePluginData(PLUGIN_NAME, pluginId) as PluginData | undefined;
  return data?.config?.uiTheme ?? "default";
}
