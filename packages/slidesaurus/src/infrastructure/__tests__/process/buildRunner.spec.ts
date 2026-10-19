import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("../../../shared/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    path: (p: string) => p,
    code: (c: string) => c,
  },
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawn: vi.fn() };
});

import { spawn } from "node:child_process";
import { SIGKILL_DELAY_MS } from "../../../domain/constants";
import {
  resolveSlidevCli,
  runSlidevBuild,
  _resetSlidevCliCache,
} from "../../process/buildRunner";

/** Minimal ChildProcess stand-in driven by the tests. */
class FakeChild extends EventEmitter {
  pid = 4242;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  stderr = new EventEmitter();
  stdout = Object.assign(new EventEmitter(), { resume: vi.fn() });
  kill = vi.fn(() => true);

  exit(code: number | null, signal: NodeJS.Signals | null = null): void {
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("close", code, signal);
  }
}

function installFakeCli(root: string): string {
  const cliDir = path.join(root, "node_modules", "@slidev", "cli");
  fs.mkdirSync(path.join(cliDir, "bin"), { recursive: true });
  fs.writeFileSync(
    path.join(cliDir, "package.json"),
    JSON.stringify({ name: "@slidev/cli", version: "52.1.0", bin: { slidev: "./bin/slidev.mjs" } }),
  );
  const entry = path.join(cliDir, "bin", "slidev.mjs");
  fs.writeFileSync(entry, "");
  return entry;
}

function setPlatform(value: NodeJS.Platform): () => void {
  const original = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { value });
  return () => Object.defineProperty(process, "platform", original);
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "buildrunner-"));
  _resetSlidevCliCache();
  vi.mocked(spawn).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveSlidevCli", () => {
  it("returns the JS entry declared in @slidev/cli package.json bin", () => {
    const entry = installFakeCli(tmpDir);
    expect(resolveSlidevCli(tmpDir)).toEqual({ entry, version: "52.1.0" });
  });

  it("walks up the tree for monorepo hoisting", () => {
    const entry = installFakeCli(tmpDir);
    const child = path.join(tmpDir, "apps", "docs");
    fs.mkdirSync(child, { recursive: true });
    expect(resolveSlidevCli(child)?.entry).toBe(entry);
  });

  it("returns undefined when the CLI is not installed", () => {
    expect(resolveSlidevCli(tmpDir)).toBeUndefined();
  });
});

describe("runSlidevBuild", () => {
  function start(args: string[] = ["build", "x.md"], timeoutMs = 10_000) {
    const child = new FakeChild();
    vi.mocked(spawn).mockReturnValue(child as never);
    const promise = runSlidevBuild({ siteDir: tmpDir, args, timeoutMs, verbose: false });
    return { child, promise };
  }

  it("fails without spawning when @slidev/cli is missing", async () => {
    const result = await runSlidevBuild({ siteDir: tmpDir, args: ["build"], timeoutMs: 1000, verbose: false });
    expect(result).toMatchObject({ success: false, failureKind: "spawn" });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("rejects unexpected extraEnv keys", async () => {
    installFakeCli(tmpDir);
    const result = await runSlidevBuild({
      siteDir: tmpDir, args: [], timeoutMs: 1000, verbose: false, extraEnv: { NPM_TOKEN: "x" },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("[Security]");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("runs `node <cli entry>` without a shell and passes metacharacters verbatim", async () => {
    const entry = installFakeCli(tmpDir);
    const weird = path.join(tmpDir, "a&b|c%PATH%^d.md");
    const { child, promise } = start(["build", weird]);
    child.exit(0);
    await expect(promise).resolves.toEqual({ success: true });

    const [cmd, args, opts] = vi.mocked(spawn).mock.calls[0];
    expect(cmd).toBe(process.execPath);
    expect(args).toEqual([entry, "build", weird]);
    expect(opts).toMatchObject({ shell: false, cwd: tmpDir, windowsHide: true });
  });

  it("filters the environment passed to the child", async () => {
    installFakeCli(tmpDir);
    vi.stubEnv("SUPER_SECRET_TOKEN", "leak");
    const { child, promise } = start();
    child.exit(0);
    await promise;
    const opts = vi.mocked(spawn).mock.calls[0][2] as { env: Record<string, string> };
    expect(opts.env).not.toHaveProperty("SUPER_SECRET_TOKEN");
    vi.unstubAllEnvs();
  });

  it("reports a non-zero exit with stderr", async () => {
    installFakeCli(tmpDir);
    const { child, promise } = start();
    child.stderr.emit("data", Buffer.from("boom"));
    child.exit(1);
    const result = await promise;
    expect(result).toMatchObject({ success: false, failureKind: "exit" });
    expect(result.error).toContain("code 1");
    expect(result.error).toContain("boom");
  });

  it("reports spawn errors", async () => {
    installFakeCli(tmpDir);
    const { child, promise } = start();
    child.emit("error", new Error("EACCES"));
    await expect(promise).resolves.toMatchObject({ success: false, failureKind: "spawn" });
  });

  describe("timeout (POSIX)", () => {
    let restorePlatform: () => void;
    let killSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      installFakeCli(tmpDir);
      restorePlatform = setPlatform("linux");
      killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);
      vi.useFakeTimers();
    });

    afterEach(() => restorePlatform());

    it("spawns the child in its own process group", async () => {
      const { child, promise } = start();
      expect(vi.mocked(spawn).mock.calls[0][2]).toMatchObject({ detached: true });
      child.exit(0);
      await promise;
    });

    it("kills the whole process group, then escalates to SIGKILL if still alive", async () => {
      const { child, promise } = start(["build"], 1000);
      vi.advanceTimersByTime(1000);
      expect(killSpy).toHaveBeenCalledWith(-child.pid, "SIGTERM");

      vi.advanceTimersByTime(SIGKILL_DELAY_MS);
      expect(killSpy).toHaveBeenCalledWith(-child.pid, "SIGKILL");

      child.exit(null, "SIGKILL");
      await expect(promise).resolves.toMatchObject({ success: false, failureKind: "timeout" });
    });

    it("does not send SIGKILL when the child exited after SIGTERM (exit state, not child.killed)", async () => {
      const { child, promise } = start(["build"], 1000);
      vi.advanceTimersByTime(1000);
      // The process died, but its stdio is not closed yet.
      child.signalCode = "SIGTERM";
      vi.advanceTimersByTime(SIGKILL_DELAY_MS);
      expect(killSpy).not.toHaveBeenCalledWith(-child.pid, "SIGKILL");
      child.emit("close", null, "SIGTERM");
      await expect(promise).resolves.toMatchObject({ failureKind: "timeout" });
    });
  });

  describe("timeout (Windows)", () => {
    let restorePlatform: () => void;

    beforeEach(() => {
      installFakeCli(tmpDir);
      restorePlatform = setPlatform("win32");
      vi.useFakeTimers();
    });

    afterEach(() => restorePlatform());

    it("does not use cmd.exe and kills the tree with taskkill /T /F", async () => {
      const { child, promise } = start(["build"], 1000);
      const killer = new FakeChild();
      vi.mocked(spawn).mockReturnValue(killer as never);
      expect(vi.mocked(spawn).mock.calls[0][0]).toBe(process.execPath);
      expect(vi.mocked(spawn).mock.calls[0][2]).toMatchObject({ detached: false, shell: false });

      vi.advanceTimersByTime(1000);
      const [cmd, args] = vi.mocked(spawn).mock.calls[1];
      expect(path.basename(cmd as string).toLowerCase()).toBe("taskkill.exe");
      expect(args).toEqual(["/pid", String(child.pid), "/T", "/F"]);

      child.exit(1);
      await expect(promise).resolves.toMatchObject({ failureKind: "timeout" });
    });
  });
});
