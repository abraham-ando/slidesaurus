import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { filterEnvAllowlist } from "../packages/env";
import { STDERR_MAX_BYTES, SIGKILL_DELAY_MS, TREE_WALK_MAX_DEPTH } from "../../domain/constants";
import { walkUpTree } from "../../shared/utils";
import { log } from "../../shared/logger";

const slidevBinCache = new Map<string, string>();

/**
 * Resolve the absolute path to the Slidev CLI binary.
 * Walks up the directory tree to find node_modules/.bin/slidev,
 * supporting monorepo hoisted packages. Memoized per siteDir.
 */
export function resolveSlidevBin(siteDir: string): string {
  const cached = slidevBinCache.get(siteDir);
  if (cached !== undefined) return cached;
  const binName = process.platform === "win32" ? "slidev.cmd" : "slidev";
  const found = walkUpTree(siteDir, TREE_WALK_MAX_DEPTH, (dir) => {
    const p = path.join(dir, "node_modules", ".bin", binName);
    return fs.existsSync(p) ? p : undefined;
  });
  const resolved = found ?? binName;
  slidevBinCache.set(siteDir, resolved);
  return resolved;
}

/** Result of a Slidev CLI execution. */
export interface RunResult {
  success: boolean;
  error?: string;
}

/**
 * Spawn the Slidev CLI with the given arguments and wait for completion.
 * Handles timeout, environment filtering, and error capture.
 */
/**
 * Keys allowed in extraEnv — must remain a small, known set of plugin-internal
 * variables. Never forward user secrets through this mechanism.
 */
const ALLOWED_EXTRA_ENV_KEYS = new Set(["SLIDEV_SITE_DIR", "FORCE_COLOR", "NO_COLOR"]);

export function runSlidevBuild(options: {
  siteDir: string;
  args: string[];
  timeoutMs: number;
  verbose: boolean;
  extraEnv?: Record<string, string>;
}): Promise<RunResult> {
  const { siteDir, args, timeoutMs, verbose, extraEnv } = options;

  return new Promise<RunResult>((resolve) => {
    // Validate extraEnv keys to prevent accidental secret injection
    for (const key of Object.keys(extraEnv ?? {})) {
      if (!ALLOWED_EXTRA_ENV_KEYS.has(key)) {
        const msg = `[Security] Unexpected extraEnv key: "${key}"`;
        log.warn(msg);
        resolve({ success: false, error: msg });
        return;
      }
    }
    const safeEnv = filterEnvAllowlist(process.env);
    const env = { ...safeEnv, ...extraEnv };

    const slidevBin = resolveSlidevBin(siteDir);
    // On Windows, .cmd files cannot be passed directly to spawn().
    // Using cmd.exe /c explicitly avoids both the EINVAL error AND the DEP0190
    // warning that shell:true triggers (args are not shell-escaped with shell:true).
    const [spawnCmd, spawnArgs] =
      process.platform === "win32"
        ? (["cmd.exe", ["/c", slidevBin, ...args]] as const)
        : ([slidevBin, args] as const);
    const child = spawn(spawnCmd, spawnArgs, {
      cwd: siteDir,
      stdio: verbose ? "inherit" : "pipe",
      env,
    });

    const stderrChunks: Buffer[] = [];
    let stderrBytes = 0;
    let timedOut = false;

    if (!verbose && child.stderr) {
      child.stderr.on("data", (data: Buffer) => {
        if (stderrBytes < STDERR_MAX_BYTES) {
          const remaining = STDERR_MAX_BYTES - stderrBytes;
          stderrChunks.push(data.length <= remaining ? data : data.subarray(0, remaining));
          stderrBytes += data.length;
        }
      });
    }

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, SIGKILL_DELAY_MS);
    }, timeoutMs);

    child.on("error", (err: Error) => {
      clearTimeout(timeout);
      resolve({ success: false, error: `Failed to spawn slidev: ${err.message}` });
    });

    child.on("close", (code: number | null) => {
      clearTimeout(timeout);
      if (timedOut) {
        resolve({ success: false, error: `Build timed out after ${timeoutMs / 1000}s` });
      } else if (code === 0) {
        resolve({ success: true });
      } else {
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        resolve({ success: false, error: `Slidev exited with code ${code}\n${stderr}` });
      }
    });
  });
}
