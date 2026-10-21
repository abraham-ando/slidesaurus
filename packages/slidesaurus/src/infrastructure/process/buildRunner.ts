import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { filterEnvAllowlist } from "../packages/env";
import {
  STDERR_MAX_BYTES,
  SIGKILL_DELAY_MS,
  TREE_WALK_MAX_DEPTH,
} from "../../domain/constants";
import { walkUpTree } from "../../shared/utils";
import { log } from "../../shared/logger";

/** Location and version of the installed `@slidev/cli` package. */
export interface SlidevCliInfo {
  /** Absolute path of the CLI's JavaScript entry point (the package `bin`). */
  entry: string;
  /** `version` field of `@slidev/cli/package.json`. */
  version: string;
}

const slidevCliCache = new Map<string, SlidevCliInfo | undefined>();

/**
 * Locate `@slidev/cli` (walking up for monorepo hoisting) and return the
 * absolute path of its JS entry point, read from the package's `bin` field.
 * Memoized per siteDir. Returns `undefined` when the CLI is not installed.
 */
export function resolveSlidevCli(siteDir: string): SlidevCliInfo | undefined {
  if (slidevCliCache.has(siteDir)) return slidevCliCache.get(siteDir);
  const pkgJsonPath = walkUpTree(siteDir, TREE_WALK_MAX_DEPTH, (dir) => {
    const p = path.join(dir, "node_modules", "@slidev", "cli", "package.json");
    return fs.existsSync(p) ? p : undefined;
  });
  let info: SlidevCliInfo | undefined;
  if (pkgJsonPath) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as {
        version?: string;
        bin?: string | Record<string, string>;
      };
      const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.slidev;
      if (bin) {
        const entry = path.resolve(path.dirname(pkgJsonPath), bin);
        if (fs.existsSync(entry))
          info = { entry, version: pkg.version ?? "unknown" };
      }
    } catch (err) {
      log.warn(
        `Failed to read ${log.path(pkgJsonPath)}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  slidevCliCache.set(siteDir, info);
  return info;
}

/** Reset memoized lookups — for tests only. */
export function _resetSlidevCliCache(): void {
  slidevCliCache.clear();
}

/**
 * Why a Slidev invocation failed:
 *  - `spawn`   — the process could not be started (CLI missing, EACCES…)
 *  - `timeout` — killed after `timeoutMs`
 *  - `exit`    — the CLI ran and exited with a non-zero code / signal
 */
export type RunFailureKind = "spawn" | "timeout" | "exit";

/** Result of a Slidev CLI execution. */
export interface RunResult {
  success: boolean;
  error?: string;
  failureKind?: RunFailureKind;
}

/**
 * Keys allowed in extraEnv — must remain a small, known set of plugin-internal
 * variables. Never forward user secrets through this mechanism.
 */
const ALLOWED_EXTRA_ENV_KEYS = new Set([
  "SLIDEV_SITE_DIR",
  "FORCE_COLOR",
  "NO_COLOR",
]);

/** Children still running — killed if the parent process exits first. */
const activeChildren = new Set<ChildProcess>();
let exitHookInstalled = false;

function installExitHook(): void {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  // POSIX children run in their own process group (detached) so they do not
  // receive the terminal's SIGINT: make sure they never outlive the plugin.
  process.once("exit", () => {
    for (const child of activeChildren) killProcessTree(child, "SIGKILL");
  });
}

/** True once the child has exited (by itself or because of a signal). */
function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

/**
 * Kill a child and all of its descendants.
 *  - Windows: `taskkill /T /F` (signals are not propagated to grandchildren).
 *  - POSIX:   signal the whole process group (child spawned with `detached`).
 * Falls back to `child.kill()` when the tree kill is not possible.
 */
export function killProcessTree(
  child: ChildProcess,
  signal: NodeJS.Signals,
): void {
  const pid = child.pid;
  if (pid === undefined || hasExited(child)) return;
  try {
    if (process.platform === "win32") {
      const taskkill = path.join(
        process.env.SystemRoot ?? "C:\\Windows",
        "System32",
        "taskkill.exe",
      );
      const killer = spawn(taskkill, ["/pid", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.on("error", () => child.kill(signal));
    } else {
      process.kill(-pid, signal);
    }
  } catch {
    child.kill(signal);
  }
}

/**
 * Spawn the Slidev CLI with the given arguments and wait for completion.
 * Never rejects: every failure is reported through `RunResult`.
 *
 * The CLI is executed as `node <@slidev/cli bin>` (no shell, no `cmd.exe`) so
 * file names containing shell metacharacters (`& | % ^`) are passed verbatim.
 * On timeout the whole process tree is terminated.
 */
export function runSlidevBuild(options: {
  siteDir: string;
  args: string[];
  timeoutMs: number;
  verbose: boolean;
  extraEnv?: Record<string, string>;
  /** Working directory of the child — defaults to `siteDir`. */
  cwd?: string;
}): Promise<RunResult> {
  const { siteDir, args, timeoutMs, verbose, extraEnv, cwd } = options;

  return new Promise<RunResult>((resolve) => {
    // Validate extraEnv keys to prevent accidental secret injection
    for (const key of Object.keys(extraEnv ?? {})) {
      if (!ALLOWED_EXTRA_ENV_KEYS.has(key)) {
        const msg = `[Security] Unexpected extraEnv key: "${key}"`;
        log.warn(msg);
        resolve({ success: false, error: msg, failureKind: "spawn" });
        return;
      }
    }

    const cli = resolveSlidevCli(siteDir);
    if (!cli) {
      resolve({
        success: false,
        error:
          "Slidev CLI not found (@slidev/cli is not installed). Install with: pnpm add -D @slidev/cli",
        failureKind: "spawn",
      });
      return;
    }

    const env = { ...filterEnvAllowlist(process.env), ...extraEnv };

    let child: ChildProcess;
    try {
      child = spawn(process.execPath, [cli.entry, ...args], {
        cwd: cwd ?? siteDir,
        stdio: verbose ? "inherit" : "pipe",
        env,
        shell: false,
        windowsHide: true,
        // Own process group on POSIX so the whole tree can be killed at once.
        detached: process.platform !== "win32",
      });
    } catch (err) {
      resolve({
        success: false,
        error: `Failed to spawn slidev: ${err instanceof Error ? err.message : String(err)}`,
        failureKind: "spawn",
      });
      return;
    }

    installExitHook();
    activeChildren.add(child);

    const stderrChunks: Buffer[] = [];
    let stderrBytes = 0;
    let timedOut = false;
    let settled = false;
    let killTimer: NodeJS.Timeout | undefined;

    if (!verbose && child.stderr) {
      child.stderr.on("data", (data: Buffer) => {
        if (stderrBytes < STDERR_MAX_BYTES) {
          const remaining = STDERR_MAX_BYTES - stderrBytes;
          stderrChunks.push(
            data.length <= remaining ? data : data.subarray(0, remaining),
          );
          stderrBytes += data.length;
        }
      });
    }
    // Drain stdout so a chatty CLI never blocks on a full pipe.
    if (!verbose && child.stdout) child.stdout.resume();

    const finish = (result: RunResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      activeChildren.delete(child);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      killProcessTree(child, "SIGTERM");
      // `child.killed` only means "a signal was sent" — check the real exit state.
      killTimer = setTimeout(() => {
        if (!hasExited(child)) killProcessTree(child, "SIGKILL");
      }, SIGKILL_DELAY_MS);
    }, timeoutMs);

    child.on("error", (err: Error) => {
      finish({
        success: false,
        error: `Failed to spawn slidev: ${err.message}`,
        failureKind: "spawn",
      });
    });

    child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      if (timedOut) {
        finish({
          success: false,
          error: `Build timed out after ${timeoutMs / 1000}s`,
          failureKind: "timeout",
        });
      } else if (code === 0) {
        finish({ success: true });
      } else {
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        const status =
          code === null ? `signal ${signal ?? "unknown"}` : `code ${code}`;
        finish({
          success: false,
          error: `Slidev exited with ${status}\n${stderr}`,
          failureKind: "exit",
        });
      }
    });
  });
}
