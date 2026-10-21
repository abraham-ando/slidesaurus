import path from "node:path";
import fs from "node:fs";
import { log } from "../../shared/logger";
import { isLocalPath, walkUpTree } from "../../shared/utils";
import { TREE_WALK_MAX_DEPTH } from "../../domain/constants";

/**
 * Memoize packages confirmed NOT installed to avoid redundant tree walks.
 * Entries expire after a short TTL so a package installed while
 * `docusaurus start` is running is picked up on the next reload.
 */
const NOT_INSTALLED_TTL_MS = 30 * 1000;
const notInstalledCache = new Map<string, number>();

const notInstalledKey = (packageName: string, siteDir: string): string => `${siteDir}::${packageName}`;

/** Forget a memoized "not installed" result (after a successful install). */
export function forgetNotInstalled(packageName: string, siteDir: string): void {
  notInstalledCache.delete(notInstalledKey(packageName, siteDir));
}

/** Reset the memoized lookups — for tests only. */
export function _resetAvailabilityCache(): void {
  notInstalledCache.clear();
}

/** Locate `node_modules/<packageName>` walking up from siteDir (monorepo hoisting). */
function findPackageDir(packageName: string, siteDir: string): string | undefined {
  const segments = packageName.split("/");
  return walkUpTree(siteDir, TREE_WALK_MAX_DEPTH, (dir) => {
    const p = path.join(dir, "node_modules", ...segments);
    return fs.existsSync(p) ? p : undefined;
  });
}

/**
 * Check if a package is installed in node_modules.
 * Walks up the directory tree to support monorepo hoisted packages.
 * Negative results are memoized for `NOT_INSTALLED_TTL_MS`.
 */
export function isPackageInstalled(packageName: string, siteDir: string): boolean {
  const cacheKey = notInstalledKey(packageName, siteDir);
  const cachedAt = notInstalledCache.get(cacheKey);
  if (cachedAt !== undefined) {
    if (Date.now() - cachedAt < NOT_INSTALLED_TTL_MS) return false;
    notInstalledCache.delete(cacheKey);
  }
  try {
    if (findPackageDir(packageName, siteDir) === undefined) {
      notInstalledCache.set(cacheKey, Date.now());
      return false;
    }
    return true;
  } catch (err) {
    log.warn(`Failed to check if package ${packageName} is installed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Read the installed version of a package (`version` of its package.json).
 * Returns `undefined` when the package is not installed or unreadable.
 * Used to fingerprint the toolchain in the incremental build cache.
 */
export function getInstalledPackageVersion(packageName: string, siteDir: string): string | undefined {
  if (isLocalPath(packageName)) return undefined;
  const dir = findPackageDir(packageName, siteDir);
  if (!dir) return undefined;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8")) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : undefined;
  } catch {
    return undefined;
  }
}

/** Dependency maps of a project's package.json (only what availability checks need). */
interface ManifestDependencies {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Check if a required package (theme or addon) is available.
 */
export function checkPackageAvailable(
  packageName: string,
  siteDir: string,
): { installed: boolean; resolvedName: string; error?: string } {
  if (isLocalPath(packageName)) {
    const fullPath = path.resolve(siteDir, packageName);
    // Guard: local paths must stay within the project directory
    const rel = path.relative(siteDir, fullPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return {
        installed: false,
        resolvedName: packageName,
        error: `[Security] Local package path "${packageName}" escapes the project directory.`,
      };
    }
    if (fs.existsSync(fullPath)) {
      return { installed: true, resolvedName: packageName };
    }
    return { installed: false, resolvedName: packageName, error: `Local path not found: ${fullPath}` };
  }
  if (isPackageInstalled(packageName, siteDir)) {
    return { installed: true, resolvedName: packageName };
  }
  try {
    const pkgPath = path.join(siteDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as ManifestDependencies;
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (packageName in allDeps) {
        return { installed: true, resolvedName: packageName };
      }
    }
  } catch (err) {
    log.warn(`Failed to read package.json in ${siteDir}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { installed: false, resolvedName: packageName, error: `Package '${packageName}' not found. Install with: npm install ${packageName}` };
}
