import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { log } from "../../shared/logger";
import { isLocalPath, validateSlidevPackageName, walkUpTree } from "../../shared/utils";
import { TREE_WALK_MAX_DEPTH } from "../../domain/constants";
import { filterEnvAllowlist } from "./env";

const execFileAsync = promisify(execFile);

/**
 * Memoize packages confirmed NOT installed to avoid redundant tree walks.
 * Entries expire after a short TTL so a package installed while
 * `docusaurus start` is running is picked up on the next reload.
 */
const NOT_INSTALLED_TTL_MS = 30 * 1000;
const notInstalledCache = new Map<string, number>();

/** Maximum duration of an auto-install before the package manager is killed. */
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;

/** In-flight install promises — deduplicate concurrent pnpm/yarn/npm add calls for the same package. */
const installInFlight = new Map<string, Promise<boolean>>();

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
  if (isLocalPath(theme)) {
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
  if (isLocalPath(addon)) {
    return addon;
  }
  if (addon.startsWith("@") || addon.startsWith(COMMUNITY_ADDON_PREFIX)) {
    return addon;
  }
  return `${COMMUNITY_ADDON_PREFIX}${addon}`;
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
  const cacheKey = `${siteDir}::${packageName}`;
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

export type PackageManager = "pnpm" | "yarn" | "npm";

/**
 * Detect the package manager used in the project by looking for lock files.
 */
export function detectPackageManager(siteDir: string): PackageManager {
  const pm = walkUpTree(siteDir, TREE_WALK_MAX_DEPTH, (dir) => {
    if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm" as const;
    if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn" as const;
    if (fs.existsSync(path.join(dir, "package-lock.json"))) return "npm" as const;
    return undefined;
  });
  return pm ?? "npm";
}

/** True when the project uses Yarn Berry (v2+), which has no `--ignore-scripts` flag. */
function isYarnBerry(siteDir: string): boolean {
  return walkUpTree(siteDir, TREE_WALK_MAX_DEPTH, (dir) =>
    fs.existsSync(path.join(dir, ".yarnrc.yml")) ? true : undefined,
  ) === true;
}

/** JS entry points of each package manager, relative to its global install dir. */
const PM_JS_ENTRIES: Record<PackageManager, string[]> = {
  npm: [path.join("node_modules", "npm", "bin", "npm-cli.js")],
  pnpm: [path.join("node_modules", "pnpm", "bin", "pnpm.cjs"), path.join("node_modules", "pnpm", "bin", "pnpm.js")],
  yarn: [path.join("node_modules", "yarn", "bin", "yarn.js")],
};

/** Basenames that `npm_execpath` may point to for each package manager. */
const PM_EXECPATH_NAMES: Record<PackageManager, RegExp> = {
  npm: /^npm-cli\.c?js$/,
  pnpm: /^pnpm\.c?js$/,
  yarn: /^yarn\.c?js$/,
};

/** A command that can be run with `execFile` — never through a shell. */
export interface PmCommand {
  file: string;
  args: string[];
}

/**
 * Resolve how to invoke a package manager WITHOUT a shell.
 *
 * Since CVE-2024-27980, Node refuses to `execFile` a `.cmd`/`.bat` without
 * `shell: true` (EINVAL) — and enabling the shell would re-open command
 * injection. Strategy:
 *  1. `npm_execpath` (set when Docusaurus is launched through a pm script)
 *     pointing to the pm's JS entry → `node <entry>`.
 *  2. Walk PATH: a native executable (`pnpm.exe`, or the POSIX binary) is run
 *     directly; next to a Windows `.cmd` shim, the pm's JS entry is run with node.
 * Returns `undefined` when no shell-free invocation is possible.
 */
export function resolvePmCommand(pm: PackageManager, env: NodeJS.ProcessEnv = process.env): PmCommand | undefined {
  const execPath = env.npm_execpath;
  if (execPath && PM_EXECPATH_NAMES[pm].test(path.basename(execPath)) && fs.existsSync(execPath)) {
    return { file: process.execPath, args: [execPath] };
  }
  const isWin = process.platform === "win32";
  for (const dir of (env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean)) {
    if (!isWin) {
      const candidate = path.join(dir, pm);
      if (fs.existsSync(candidate)) return { file: candidate, args: [] };
      continue;
    }
    const exe = path.join(dir, `${pm}.exe`);
    if (fs.existsSync(exe)) return { file: exe, args: [] };
    if (fs.existsSync(path.join(dir, `${pm}.cmd`))) {
      for (const rel of PM_JS_ENTRIES[pm]) {
        const entry = path.join(dir, rel);
        if (fs.existsSync(entry)) return { file: process.execPath, args: [entry] };
      }
    }
  }
  return undefined;
}

/**
 * Build the install arguments. Lifecycle scripts are always disabled: a theme
 * or addon never needs a postinstall, and auto-install must not execute code.
 */
export function buildInstallArgs(pm: PackageManager, packageName: string, berry: boolean): string[] {
  if (pm === "npm") return ["install", packageName, "--ignore-scripts"];
  if (pm === "yarn" && berry) return ["add", packageName]; // scripts disabled via YARN_ENABLE_SCRIPTS
  return ["add", packageName, "--ignore-scripts"];
}

/**
 * Auto-install a missing npm package using the detected package manager.
 * Concurrent calls for the same package are deduplicated — only one install
 * process is spawned regardless of how many callers request the same package.
 */
export async function installPackage(
  packageName: string,
  siteDir: string,
  kind: "theme" | "addon" = "theme",
): Promise<boolean> {
  const key = `${siteDir}::${packageName}`;
  const inflight = installInFlight.get(key);
  if (inflight) return inflight;
  const promise = _doInstallPackage(packageName, siteDir, kind);
  installInFlight.set(key, promise);
  void promise.finally(() => installInFlight.delete(key));
  return promise;
}

async function _doInstallPackage(packageName: string, siteDir: string, kind: "theme" | "addon"): Promise<boolean> {
  try {
    validateSlidevPackageName(packageName, kind);
    if (isLocalPath(packageName)) throw new Error("local paths cannot be installed");
    const pm = detectPackageManager(siteDir);
    const cmd = resolvePmCommand(pm);
    if (!cmd) throw new Error(`could not locate the "${pm}" executable without a shell`);
    const berry = pm === "yarn" && isYarnBerry(siteDir);
    log.info(`Auto-installing ${log.code(packageName)} with ${pm}...`);
    // Filter env to prevent leaking secrets (NPM_TOKEN, custom registries, etc.)
    const env: Record<string, string> = {
      ...filterEnvAllowlist(process.env),
      npm_config_ignore_scripts: "true",
      ...(berry ? { YARN_ENABLE_SCRIPTS: "false" } : {}),
    };
    await execFileAsync(cmd.file, [...cmd.args, ...buildInstallArgs(pm, packageName, berry)], {
      cwd: siteDir,
      env,
      shell: false,
      windowsHide: true,
      timeout: INSTALL_TIMEOUT_MS,
      killSignal: "SIGKILL",
      maxBuffer: 10 * 1024 * 1024,
    });
    notInstalledCache.delete(`${siteDir}::${packageName}`);
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
  kind: "theme" | "addon",
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

function ensureKey(kind: "theme" | "addon", siteDir: string, name: string): string {
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
  notInstalledCache.clear();
  ensureCache.clear();
  installInFlight.clear();
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
