import { isLocalPath } from "../../shared/utils";
import { isPackageInstalled } from "./packageAvailability";

/** Official Slidev theme prefix */
const OFFICIAL_THEME_PREFIX = "@slidev/theme-";
/** Community theme prefix */
const COMMUNITY_THEME_PREFIX = "slidev-theme-";
/** Community addon prefix */
const COMMUNITY_ADDON_PREFIX = "slidev-addon-";

/**
 * Resolve a Slidev theme shorthand name to its full npm package name.
 *
 * Naming conventions (from https://sli.dev/guide/theme-addon):
 * - Local path (starts with . or /): returned as-is
 * - Full package name (contains /): returned as-is
 * - Official shorthand (e.g. "seriph"): resolved to @slidev/theme-seriph
 * - Community shorthand (e.g. "unicorn"): resolved to slidev-theme-unicorn
 */
export function resolveThemePackageName(
  theme: string,
  siteDir: string,
): string {
  if (isLocalPath(theme)) {
    return theme;
  }
  if (
    theme.startsWith("@") ||
    theme.startsWith(COMMUNITY_THEME_PREFIX) ||
    theme.startsWith(OFFICIAL_THEME_PREFIX)
  ) {
    return theme;
  }
  const officialName = `${OFFICIAL_THEME_PREFIX}${theme}`;
  const communityName = `${COMMUNITY_THEME_PREFIX}${theme}`;
  if (isPackageInstalled(officialName, siteDir)) return officialName;
  if (isPackageInstalled(communityName, siteDir)) return communityName;
  return officialName;
}

/**
 * Resolve a Slidev addon shorthand name to its full npm package name.
 */
export function resolveAddonPackageName(addon: string): string {
  if (isLocalPath(addon)) {
    return addon;
  }
  if (addon.startsWith("@") || addon.startsWith(COMMUNITY_ADDON_PREFIX)) {
    return addon;
  }
  return `${COMMUNITY_ADDON_PREFIX}${addon}`;
}
