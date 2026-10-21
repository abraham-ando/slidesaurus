import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { log } from "../../shared/logger";
import { isLocalPath, validateSlidevPackageName, walkUpTree } from "../../shared/utils";
import { TREE_WALK_MAX_DEPTH } from "../../domain/constants";
import { filterEnvAllowlist } from "./env";
import { forgetNotInstalled } from "./packageAvailability";

const execFileAsync = promisify(execFile);

/** Maximum duration of an auto-install before the package manager is killed. */
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;

/** In-flight install promises — deduplicate concurrent pnpm/yarn/npm add calls for the same package. */
const installInFlight = new Map<string, Promise<boolean>>();

/** Reset the in-flight installs — for tests only. */
export function _resetInstallerCaches(): void {
  installInFlight.clear();
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
  const promise = runInstall(packageName, siteDir, kind);
  installInFlight.set(key, promise);
  void promise.finally(() => installInFlight.delete(key));
  return promise;
}

async function runInstall(packageName: string, siteDir: string, kind: "theme" | "addon"): Promise<boolean> {
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
    forgetNotInstalled(packageName, siteDir);
    log.success(`Installed ${log.code(packageName)}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Failed to install ${log.code(packageName)}: ${msg}`);
    return false;
  }
}
