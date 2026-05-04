import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { log } from "./logger";
import { validatePackageName, walkUpTree } from "./utils";
import { TREE_WALK_MAX_DEPTH } from "./constants";
import { filterEnvAllowlist } from "./env";

const execFileAsync = promisify(execFile);

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
export function resolveThemePackageName(theme: string, siteDir: string): string {
  if (theme.startsWith(".") || theme.startsWith("/") || theme.startsWith("\\")) {
    return theme;
  }
  if (theme.startsWith("@") || theme.startsWith(COMMUNITY_THEME_PREFIX) || theme.startsWith(OFFICIAL_THEME_PREFIX)) {
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
  if (addon.startsWith(".") || addon.startsWith("/") || addon.startsWith("\\")) {
    return addon;
  }
  if (addon.startsWith("@") || addon.startsWith(COMMUNITY_ADDON_PREFIX)) {
    return addon;
  }
  return `${COMMUNITY_ADDON_PREFIX}${addon}`;
}

/**
 * Check if a package is installed in node_modules.
 * Walks up the directory tree to support monorepo hoisted packages.
 */
export function isPackageInstalled(packageName: string, siteDir: string): boolean {
  try {
    const segments = packageName.split("/");
    const found = walkUpTree(siteDir, TREE_WALK_MAX_DEPTH, (dir) => {
      const p = path.join(dir, "node_modules", ...segments);
      return fs.existsSync(p) ? true : undefined;
    });
    return found === true;
  } catch (err) {
    log.warn(`Failed to check if package ${packageName} is installed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Check if a required package (theme or addon) is available.
 */
export function checkPackageAvailable(
  packageName: string,
  siteDir: string,
): { installed: boolean; resolvedName: string; error?: string } {
  if (packageName.startsWith(".") || packageName.startsWith("/") || packageName.startsWith("\\")) {
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
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
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

/**
 * Detect the package manager used in the project by looking for lock files.
 */
export function detectPackageManager(siteDir: string): "pnpm" | "yarn" | "npm" {
  const pm = walkUpTree(siteDir, TREE_WALK_MAX_DEPTH, (dir) => {
    if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm" as const;
    if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn" as const;
    if (fs.existsSync(path.join(dir, "package-lock.json"))) return "npm" as const;
    return undefined;
  });
  return pm ?? "npm";
}

/**
 * Resolve the absolute path of a package manager binary.
 * Walks PATH entries to find the actual executable, avoiding
 * relying on shell resolution which can be hijacked on Windows.
 */
function resolvePmBin(name: string): string {
  const exeName = process.platform === "win32" ? `${name}.cmd` : name;
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(path.delimiter)) {
    const candidate = path.join(dir, exeName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return exeName; // fallback: let OS resolve (same as before)
}

/**
 * Auto-install a missing npm package using the detected package manager.
 */
export async function installPackage(packageName: string, siteDir: string): Promise<boolean> {
  try {
    validatePackageName(packageName);
    log.info(`Auto-installing ${log.code(packageName)}...`);
    const pm = detectPackageManager(siteDir);
    const pmName = pm === "pnpm" ? "pnpm" : pm === "yarn" ? "yarn" : "npm";
    const pmCmd = resolvePmBin(pmName);
    const pmArgs = pm === "npm" ? ["install", packageName] : ["add", packageName];
    // Filter env to prevent leaking secrets (NPM_TOKEN, custom registries, etc.)
    await execFileAsync(pmCmd, pmArgs, {
      cwd: siteDir,
      env: filterEnvAllowlist(process.env),
    });
    log.success(`Installed ${log.code(packageName)}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Failed to install ${log.code(packageName)}: ${msg}`);
    return false;
  }
}

// Shared resolve→validate→check→install→throw sequence for a single package.
async function resolveAndEnsure(
  resolvedName: string,
  siteDir: string,
  autoInstall: boolean,
  notFoundMsg: string,
): Promise<string> {
  validatePackageName(resolvedName);
  const check = checkPackageAvailable(resolvedName, siteDir);
  if (check.installed) return resolvedName;
  if (autoInstall && await installPackage(resolvedName, siteDir)) return resolvedName;
  throw new Error(check.error ?? notFoundMsg);
}

// Memoize per (siteDir, packageName) — avoids redundant FS walks and npm install
// races when many presentations share the same theme/addons.
const ensureCache = new Map<string, Promise<string>>();

function ensureKey(kind: "theme" | "addon", siteDir: string, name: string): string {
  return `${kind}::${siteDir}::${name}`;
}

/**
 * Ensure a theme package is available (resolve shorthand + check/install).
 */
export async function ensureThemeAvailable(theme: string, siteDir: string, autoInstall: boolean): Promise<string> {
  const key = ensureKey("theme", siteDir, theme);
  const cached = ensureCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const resolvedName = resolveThemePackageName(theme, siteDir);
    return resolveAndEnsure(resolvedName, siteDir, autoInstall,
      `Theme '${theme}' (${resolvedName}) not found. Install with: npm install ${resolvedName}`);
  })();
  ensureCache.set(key, promise);
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
    const cached = ensureCache.get(key);
    if (cached) return cached;
    const promise = (async () => {
      const resolvedName = resolveAddonPackageName(addon);
      return resolveAndEnsure(resolvedName, siteDir, autoInstall,
        `Addon '${addon}' (${resolvedName}) not found. Install with: npm install ${resolvedName}`);
    })();
    ensureCache.set(key, promise);
    promise.catch(() => ensureCache.delete(key));
    return promise;
  }));
}
