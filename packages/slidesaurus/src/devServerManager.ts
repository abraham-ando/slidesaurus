import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import type { PresentationMetadata, PluginOptions } from "./types";
import { log } from "./logger";
import { filterEnvAllowlist } from "./env";
import { resolveSlidevBin } from "./buildRunner";
import {
  DEV_STDERR_MAX_BYTES,
  DEV_SERVER_POLL_INTERVAL_MS,
  DEV_SERVER_PORT_PROBE_TIMEOUT_MS,
  MAX_PORT_RETRIES,
  SIGKILL_DELAY_MS,
} from "./constants";

interface DevServerEntry {
  process: ChildProcess;
  port: number;
  presentationId: string;
}

/** Injectable port checker — defaults to an HTTP probe; swap in tests. */
export interface IPortChecker {
  isAvailable(port: number): Promise<boolean>;
}

const httpPortChecker: IPortChecker = {
  isAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get({ host: "127.0.0.1", port, timeout: DEV_SERVER_PORT_PROBE_TIMEOUT_MS }, (res) => {
        // Drain body — Node.js won't release the socket until the response body
        // is consumed or destroyed, causing a socket leak per port-availability probe.
        res.resume();
        resolve(false);
      });
      req.on("error", () => resolve(true));
      req.on("timeout", () => { req.destroy(); resolve(true); });
    });
  },
};

/**
 * Manages Slidev dev server processes for all presentations.
 * Encapsulates process lifecycle, port allocation, and cleanup signal handlers
 * as instance state — safe for multi-instance plugin setups.
 */
export class DevServerManager {
  private readonly activeServers: DevServerEntry[] = [];
  private readonly portAssignments = new Map<string, number>();
  private readonly pendingStarts = new Map<string, Promise<string | undefined>>();
  private readonly failedStarts = new Set<string>();
  private readonly siteDir: string;
  private readonly options: PluginOptions;
  private readonly portChecker: IPortChecker;
  private cleanupRegistered = false;

  constructor(siteDir: string, options: PluginOptions, portChecker: IPortChecker = httpPortChecker) {
    this.siteDir = siteDir;
    this.options = options;
    this.portChecker = portChecker;
  }

  /**
   * Pre-assign ports synchronously (basePort + index, no probing).
   * Returns a map of presentationId → port and a devUrl function.
   * Ports are assigned without availability checks — if a port is occupied
   * when the server actually starts, it will fail gracefully (not retry).
   */
  preAssignPorts(presentations: PresentationMetadata[]): Map<string, number> {
    this.registerCleanup();
    const basePort = 8600;
    let idx = 0;
    const assignments = new Map<string, number>();
    for (const p of presentations) {
      if (!this.isEligible(p.id)) continue;
      const port = basePort + idx;
      idx++;
      this.portAssignments.set(p.id, port);
      assignments.set(p.id, port);
    }
    if (assignments.size > 0) {
      log.info(`Assigned ports for ${assignments.size} dev server(s) (lazy start)…`);
    }
    return assignments;
  }

  /**
   * Return the running dev server URL for a presentation, starting it on first
   * call. Concurrent calls for the same ID share the same in-flight Promise —
   * only one Slidev process is ever spawned per presentation.
   */
  async getOrStart(id: string, presentations: PresentationMetadata[]): Promise<string | undefined> {
    // Already running
    const running = this.activeServers.find((s) => s.presentationId === id);
    if (running) return `http://127.0.0.1:${running.port}`;

    // Don't retry presentations that already crashed — prevents infinite restart loops.
    if (this.failedStarts.has(id)) return undefined;

    // Start in-flight — return the shared Promise
    const pending = this.pendingStarts.get(id);
    if (pending) return pending;

    // Port not pre-assigned (not eligible)
    const port = this.portAssignments.get(id);
    if (port === undefined) return undefined;

    const presentation = presentations.find((p) => p.id === id);
    if (!presentation) return undefined;

    log.info(`Starting dev server for ${log.code(id)} on port ${port}…`);
    const promise = this.startOne(presentation, port)
      .then((url) => {
        if (!url) this.failedStarts.add(id);
        return url;
      })
      .finally(() => {
        this.pendingStarts.delete(id);
      });
    this.pendingStarts.set(id, promise);
    return promise;
  }

  /** Stop all running dev server processes. */
  stopAll(): void {
    this.killAll();
  }

  /** True if this presentation should get a dev server (respects devPresentations). */
  private isEligible(id: string): boolean {
    const patterns: string[] | undefined = undefined; // devPresentations removed from API
    if (!patterns || patterns.length === 0) return true;
    return patterns.some(
      (pat) => pat === id || (pat.endsWith("/*") && id.startsWith(pat.slice(0, -2) + "/")),
    );
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    for (let offset = 0; offset < MAX_PORT_RETRIES; offset++) {
      const port = startPort + offset;
      if (await this.portChecker.isAvailable(port)) return port;
    }
    throw new Error(`No available port found in range ${startPort}–${startPort + MAX_PORT_RETRIES - 1}`);
  }

  private async startOne(presentation: PresentationMetadata, port: number): Promise<string | undefined> {
    const slidevBin = resolveSlidevBin(this.siteDir);

    // Use a semantic sub-path under the presentation route as the Vite base:
    //   {routeBasePath}/_dry-run/{presentationId}/
    // e.g. /training/_dry-run/getting-started/introduction/
    //
    // This keeps dev URLs coherent with the presentation route hierarchy and
    // hides internal port numbers from users. The webpack proxy intercepts
    // only requests containing the /_dry-run/ marker, leaving normal Docusaurus
    // routes untouched. All Vite asset requests (/@fs/, /@vite/, …) are
    // automatically prefixed with this base and caught by the same proxy rule.
    const routeBase = (this.options.routeBasePath ?? "/slidev").replace(/\/$/, "");
    const base = `${routeBase}/_dry-run/${presentation.id}/`;

    const slidevArgs = [
      presentation.sourceAbsolutePath,
      "--port", String(port),
      "--base", base,
      "--remote", "false",
      "--open", "false",
    ];

    if (presentation.theme || this.options.theme) {
      slidevArgs.push("--theme", presentation.theme || this.options.theme!);
    }

    // On Windows, use cmd.exe /c explicitly to avoid ENOENT (.cmd files) and DEP0190.
    const [spawnCmd, spawnArgs] =
      process.platform === "win32"
        ? (["cmd.exe", ["/c", slidevBin, ...slidevArgs]] as const)
        : ([slidevBin, slidevArgs] as const);

    const child = spawn(spawnCmd, spawnArgs, {
      cwd: this.siteDir,
      stdio: "pipe",
      env: filterEnvAllowlist(process.env),
    });

    const entry: DevServerEntry = { process: child, port, presentationId: presentation.id };
    this.activeServers.push(entry);

    // Capture both stdout and stderr — Slidev writes Vite compilation progress
    // to stdout, errors to stderr. Both are needed to diagnose startup failures.
    const outputChunks: Buffer[] = [];
    let outputBytes = 0;
    const captureOutput = (data: Buffer) => {
      if (outputBytes < DEV_STDERR_MAX_BYTES) {
        const remaining = DEV_STDERR_MAX_BYTES - outputBytes;
        outputChunks.push(data.length <= remaining ? data : data.subarray(0, remaining));
        outputBytes += data.length;
      }
    };
    child.stderr?.on("data", captureOutput);
    child.stdout?.on("data", captureOutput);

    // Track whether we killed the process ourselves so the exit handler can
    // suppress misleading "exited with code X" warnings.  On Windows, SIGTERM
    // via cmd.exe /c produces exit code 1 (not 143 as on POSIX), which would
    // otherwise look like an unexpected crash.
    let selfKilled = false;
    let earlyFailed = false;
    const earlyExitPromise = new Promise<boolean>((resolve) => {
      child.on("error", (err) => {
        log.error(`Dev server for ${log.code(presentation.id)} failed: ${err.message}`);
        earlyFailed = true;
        resolve(false);
      });
      child.on("exit", (code) => {
        const idx = this.activeServers.indexOf(entry);
        if (idx !== -1) this.activeServers.splice(idx, 1);
        if (code !== null && code !== 0) {
          // Suppress warning when we sent the kill signal ourselves.
          // Also suppress POSIX graceful-shutdown codes (130 = SIGINT, 143 = SIGTERM).
          if (!selfKilled && code !== 130 && code !== 143) {
            log.warn(`Dev server for ${log.code(presentation.id)} exited with code ${code}`);
          }
          earlyFailed = true;
          resolve(false);  // resolve immediately — don't wait for devServerTimeout
        }
      });
    });

    const timeoutMs = 60000;
    const ready = await Promise.race([this.waitForServer(port, base, timeoutMs), earlyExitPromise]);

    if (!ready) {
      if (!earlyFailed) {
        log.warn(`Dev server for ${log.code(presentation.id)} did not start within ${timeoutMs / 1000}s`);
      }
      const output = Buffer.concat(outputChunks).toString("utf8").trim();
      if (output) log.warn(`Output:\n${output}`);
      selfKilled = true;
      try { child.kill("SIGTERM"); } catch { /* already dead */ }
      setTimeout(() => {
        try { if (!child.killed) child.kill("SIGKILL"); } catch { /* already dead */ }
      }, SIGKILL_DELAY_MS).unref();
      return undefined;
    }

    return `http://127.0.0.1:${port}`;
  }

  private waitForServer(port: number, basePath: string, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        if (Date.now() - start > timeoutMs) {
          resolve(false);
          return;
        }
        // Probe the actual base path (not root) so we only resolve when Vite has
        // finished compiling and is truly ready to serve slides. Probing root (/)
        // resolves too early — Vite may accept the TCP connection and immediately
        // reset it while still initialising, causing ECONNRESET/ECONNREFUSED on
        // the first real proxy request.
        const req = http.get(`http://127.0.0.1:${port}${basePath}`, (res) => {
          res.resume();
          // Any non-5xx status code means Vite is serving (200 OK or 3xx redirect).
          resolve(res.statusCode !== undefined && (res.statusCode < 500));
        });
        req.on("error", () => setTimeout(check, DEV_SERVER_POLL_INTERVAL_MS));
        req.on("timeout", () => { req.destroy(); setTimeout(check, DEV_SERVER_POLL_INTERVAL_MS); });
      };
      check();
    });
  }

  private killAll(): void {
    const toKill = [...this.activeServers];
    this.activeServers.length = 0;
    for (const entry of toKill) {
      try { entry.process.kill("SIGTERM"); } catch { /* already dead */ }
    }
    // SIGKILL escalation: if a process ignores SIGTERM, force-kill it after a delay.
    // .unref() so the timer does not prevent the Node.js process from exiting cleanly.
    setTimeout(() => {
      for (const entry of toKill) {
        try { if (!entry.process.killed) entry.process.kill("SIGKILL"); } catch { /* already dead */ }
      }
    }, SIGKILL_DELAY_MS).unref();
  }

  private registerCleanup(): void {
    if (this.cleanupRegistered) return;
    this.cleanupRegistered = true;
    process.on("exit", () => this.stopAll());
    process.on("SIGINT", () => { this.stopAll(); process.exit(130); });
    process.on("SIGTERM", () => { this.stopAll(); process.exit(143); });
  }
}
