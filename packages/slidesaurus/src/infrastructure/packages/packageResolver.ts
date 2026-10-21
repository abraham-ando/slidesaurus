/**
 * Entry point for theme/addon package handling. The work is split in:
 *  - `packageNames.ts`: shorthand → full package name
 *  - `packageAvailability.ts`: is a package installed / which version
 *  - `packageInstaller.ts`: package manager detection and auto-install
 * This module adds the memoized "ensure available" flow and re-exports the rest.
 */
import { validateSlidevPackageName, isLocalPath } from "../../shared/utils";
import { checkPackageAvailable, _resetAvailabilityCache } from "./packageAvailability";
import { resolveAddonPackageName, resolveThemePackageName } from "./packageNames";
import { installPackage, _resetInstallerCaches } from "./packageInstaller";

export { resolveThemePackageName, resolveAddonPackageName } from "./packageNames";
export { isPackageInstalled, getInstalledPackageVersion, checkPackageAvailable } from "./packageAvailability";
export {
  detectPackageManager,
  resolvePmCommand,
  buildInstallArgs,
  installPackage,
  type PackageManager,
  type PmCommand,
} from "./packageInstaller";

type PackageKind = "theme" | "addon";

// Shared resolve→validate→check→install→throw sequence for a single package.
async function resolveAndEnsure(
  resolvedName: string,
  kind: PackageKind,
  siteDir: string,
  autoInstall: boolean,
  notFoundMsg: string,
): Promise<string> {
  validateSlidevPackageName(resolvedName, kind);
  const check = checkPackageAvailable(resolvedName, siteDir);
  if (check.installed) return resolvedName;
  if (autoInstall && !isLocalPath(resolvedName) && await installPackage(resolvedName, siteDir, kind)) return resolvedName;
  throw new Error(check.error ?? notFoundMsg);
}

// Memoize per (siteDir, packageName) — avoids redundant FS walks and npm install
// races when many presentations share the same theme/addons.
// TTL of 5 minutes prevents stale entries in long-running dev sessions where
// a package might be installed/uninstalled between reloads.
const ENSURE_CACHE_TTL_MS = 5 * 60 * 1000;
interface EnsureCacheEntry { promise: Promise<string>; createdAt: number }
const ensureCache = new Map<string, EnsureCacheEntry>();

function ensureKey(kind: PackageKind, siteDir: string, name: string): string {
  return `${kind}::${siteDir}::${name}`;
}

function getCachedEntry(key: string): Promise<string> | undefined {
  const entry = ensureCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > ENSURE_CACHE_TTL_MS) {
    ensureCache.delete(key);
    return undefined;
  }
  return entry.promise;
}

/** Reset all memoized lookups — for tests only. */
export function _resetPackageResolverCaches(): void {
  _resetAvailabilityCache();
  _resetInstallerCaches();
  ensureCache.clear();
}

/**
 * Ensure a theme package is available (resolve shorthand + check/install).
 */
export async function ensureThemeAvailable(theme: string, siteDir: string, autoInstall: boolean): Promise<string> {
  const key = ensureKey("theme", siteDir, theme);
  const cached = getCachedEntry(key);
  if (cached) return cached;
  const promise = (async () => {
    const resolvedName = resolveThemePackageName(theme, siteDir);
    return resolveAndEnsure(resolvedName, "theme", siteDir, autoInstall,
      `Theme '${theme}' (${resolvedName}) not found. Install with: npm install ${resolvedName}`);
  })();
  ensureCache.set(key, { promise, createdAt: Date.now() });
  try {
    return await promise;
  } catch (err) {
    ensureCache.delete(key);
    throw err;
  }
}

/**
 * Ensure addon packages are available (resolve shorthands + check/install).
 * Each addon resolution is memoized independently so concurrent calls
 * sharing the same addons reuse the in-flight promise.
 */
export async function ensureAddonsAvailable(addons: string[], siteDir: string, autoInstall: boolean): Promise<string[]> {
  return Promise.all(addons.map((addon) => {
    const key = ensureKey("addon", siteDir, addon);
    const cached = getCachedEntry(key);
    if (cached) return cached;
    const promise = (async () => {
      const resolvedName = resolveAddonPackageName(addon);
      return resolveAndEnsure(resolvedName, "addon", siteDir, autoInstall,
        `Addon '${addon}' (${resolvedName}) not found. Install with: npm install ${resolvedName}`);
    })();
    ensureCache.set(key, { promise, createdAt: Date.now() });
    promise.catch(() => ensureCache.delete(key));
    return promise;
  }));
}
