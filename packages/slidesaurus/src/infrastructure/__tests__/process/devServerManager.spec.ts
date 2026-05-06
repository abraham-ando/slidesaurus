import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { DevServerManager, type IPortChecker } from "../../process/devServerManager";
import type { PresentationMetadata, PluginOptions } from "../../../domain/types";
import { MAX_PORT_RETRIES } from "../../../domain/constants";

vi.mock("../../../shared/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    code: (s: string) => s,
    path: (s: string) => s,
  },
}));

vi.mock("../../../infrastructure/process/buildRunner", () => ({
  resolveSlidevBin: vi.fn().mockReturnValue("/fake/slidev"),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOptions(overrides: Partial<PluginOptions> = {}): PluginOptions {
  return {
    path: "./slidev",
    download: false,
    exportFormats: [],
    exportWithClicks: false,
    withoutNotes: false,
    routeBasePath: "/slidev",
    pageTitle: "Presentations",
    pageTagline: "",
    id: "default",
    theme: undefined,
    addons: [],
    buildTimeout: 120,
    verbose: false,
    maxParallelBuilds: 4,
    autoInstall: false,
    dryRun: false,
    ...overrides,
  };
}

function makePresentation(id: string): PresentationMetadata {
  return {
    id,
    title: id,
    sourcePath: `slidev/${id}.md`,
    sourceAbsolutePath: `/fake/slidev/${id}.md`,
    url: `/slidev/${id}`,
    outputPath: `/fake/output/${id}`,
    previewUrl: `/slidev/${id}/1`,
    category: "",
  };
}

/** A mock port checker with controllable availability. */
function makeMockPortChecker(availableSet: Set<number>): IPortChecker {
  return {
    isAvailable: vi.fn(async (port: number) => availableSet.has(port)),
  };
}

/** Build a minimal fake ChildProcess that supports kill() and event emission. */
function makeFakeProcess(): ChildProcess & EventEmitter {
  const emitter = new EventEmitter() as ChildProcess & EventEmitter;
  emitter.killed = false;
  emitter.kill = vi.fn((signal?: NodeJS.Signals | number) => {
    if (signal === "SIGKILL" || signal === "SIGTERM") emitter.killed = true;
    return true;
  }) as unknown as ChildProcess["kill"];
  emitter.stderr = new EventEmitter() as NodeJS.ReadableStream;
  emitter.stdio = [null, null, null, null, null];
  emitter.pid = Math.floor(Math.random() * 10000);
  return emitter;
}

// ── findAvailablePort (via startAll with single presentation) ─────────────────

describe("DevServerManager — port allocation", () => {
  it("allocates the first available port", async () => {
    // All ports available immediately
    const portChecker = makeMockPortChecker(new Set([9000, 9001, 9002]));
    const manager = new DevServerManager("/fake", makeOptions(), portChecker);

    // startAll will try to spawn, which we don't need; we just test port finding
    // by observing that it tries port 9000 first
    vi.mock("node:child_process", () => ({
      spawn: vi.fn(() => {
        const p = makeFakeProcess();
        // Immediately exit so startOne resolves quickly
        setTimeout(() => p.emit("exit", 0), 10);
        return p;
      }),
    }));

    // preAssignPorts with no presentations → portChecker never called (no probing)
    manager.preAssignPorts([]);
    expect(vi.mocked(portChecker.isAvailable)).not.toHaveBeenCalled();
  });

  it("skips occupied ports and returns the first free one", async () => {
    // ports 9000 and 9001 are occupied; 9002 is free
    const portChecker = makeMockPortChecker(new Set([9002]));
    const manager = new DevServerManager("/fake", makeOptions(), portChecker);

    // Access private method via casting
    const port = await (manager as unknown as { findAvailablePort(s: number): Promise<number> })
      .findAvailablePort(9000);

    expect(port).toBe(9002);
    expect(vi.mocked(portChecker.isAvailable)).toHaveBeenCalledWith(9000);
    expect(vi.mocked(portChecker.isAvailable)).toHaveBeenCalledWith(9001);
    expect(vi.mocked(portChecker.isAvailable)).toHaveBeenCalledWith(9002);
  });

  it("throws after MAX_PORT_RETRIES failed attempts", async () => {
    // No port available in the range
    const portChecker = makeMockPortChecker(new Set());
    const manager = new DevServerManager("/fake", makeOptions(), portChecker);

    await expect(
      (manager as unknown as { findAvailablePort(s: number): Promise<number> })
        .findAvailablePort(9000),
    ).rejects.toThrow(`No available port found in range 9000–${9000 + MAX_PORT_RETRIES - 1}`);

    expect(vi.mocked(portChecker.isAvailable)).toHaveBeenCalledTimes(MAX_PORT_RETRIES);
  });
});

// ── Orphaned process prevention ───────────────────────────────────────────────

describe("assignDevPorts — orphaned process prevention", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("calls stopAll() on the previous manager before creating a new one", async () => {
    const { assignDevPorts } = await import("../../process/devServer");
    const { DevServerManager: MockManager } = await import("../../process/devServerManager");

    const stopAllSpy = vi.spyOn(MockManager.prototype, "stopAll");
    const assignSpy = vi.spyOn(MockManager.prototype, "preAssignPorts").mockReturnValue(new Map());

    // First call — no previous manager
    assignDevPorts([], makeOptions(), "/fake");
    expect(stopAllSpy).not.toHaveBeenCalled();
    expect(assignSpy).toHaveBeenCalledTimes(1);

    // Second call — should stop the first manager
    assignDevPorts([], makeOptions(), "/fake");
    expect(stopAllSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledTimes(2);
  });
});

// ── Exit code handling ────────────────────────────────────────────────────────

describe("DevServerManager — exit code handling during startup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Simulate startOne via allocatePorts + getOrStart on a single presentation.
   * Returns the URL (or undefined) from getOrStart.
   */
  async function testExitCode(code: number): Promise<string | undefined> {
    const portChecker = makeMockPortChecker(new Set([9000]));
    const manager = new DevServerManager("/fake", makeOptions({ devServerTimeout: 300 }), portChecker);

    const fakeProcess = makeFakeProcess();
    vi.spyOn(await import("node:child_process"), "spawn").mockReturnValue(fakeProcess as unknown as ReturnType<typeof import("node:child_process").spawn>);

    manager.preAssignPorts([makePresentation("talk")]);

    // Emit exit shortly after spawn
    setTimeout(() => fakeProcess.emit("exit", code), 50);

    return manager.getOrStart("talk", [makePresentation("talk")]);
  }

  it("treats exit code 1 as failure — getOrStart returns undefined", async () => {
    const url = await testExitCode(1);
    expect(url).toBeUndefined();
  });

  it("treats exit code 130 (SIGINT) as failure without waiting for timeout", async () => {
    const start = Date.now();
    const url = await testExitCode(130);
    // Should resolve quickly (before devServerTimeout of 300ms)
    expect(Date.now() - start).toBeLessThan(250);
    expect(url).toBeUndefined();
  });

  it("treats exit code 143 (SIGTERM) as failure without waiting for timeout", async () => {
    const start = Date.now();
    const url = await testExitCode(143);
    expect(Date.now() - start).toBeLessThan(250);
    expect(url).toBeUndefined();
  });
});

// ── killAll — SIGTERM + SIGKILL escalation ────────────────────────────────────

describe("DevServerManager.stopAll — SIGKILL escalation", () => {
  it("sends SIGTERM immediately and SIGKILL after a delay if process survives", async () => {
    vi.useFakeTimers();

    const portChecker = makeMockPortChecker(new Set([9000]));
    const manager = new DevServerManager("/fake", makeOptions(), portChecker);

    // Build a process that survives SIGTERM (killed stays false) — only SIGKILL kills it.
    const fakeProcess = makeFakeProcess();
    fakeProcess.killed = false;
    fakeProcess.kill = vi.fn((signal?: NodeJS.Signals | number) => {
      if (signal === "SIGKILL") (fakeProcess as unknown as { killed: boolean }).killed = true;
      // SIGTERM is intentionally ignored (simulates a hung process)
      return true;
    }) as unknown as ChildProcess["kill"];

    (manager as unknown as { activeServers: Array<{ process: ChildProcess; port: number; presentationId: string }> })
      .activeServers.push({ process: fakeProcess, port: 9000, presentationId: "talk" });

    manager.stopAll();

    // SIGTERM sent immediately
    expect(fakeProcess.kill).toHaveBeenCalledWith("SIGTERM");
    expect(fakeProcess.kill).not.toHaveBeenCalledWith("SIGKILL");

    // Advance past SIGKILL_DELAY_MS — process still alive → SIGKILL fires
    await vi.runAllTimersAsync();

    expect(fakeProcess.kill).toHaveBeenCalledWith("SIGKILL");

    vi.useRealTimers();
  });

  it("does not send SIGKILL if process already exited", async () => {
    vi.useFakeTimers();

    const portChecker = makeMockPortChecker(new Set([9000]));
    const manager = new DevServerManager("/fake", makeOptions(), portChecker);

    const fakeProcess = makeFakeProcess();
    fakeProcess.killed = true;  // already dead after SIGTERM
    (manager as unknown as { activeServers: Array<{ process: ChildProcess; port: number; presentationId: string }> })
      .activeServers.push({ process: fakeProcess, port: 9000, presentationId: "talk" });

    manager.stopAll();
    await vi.runAllTimersAsync();

    // kill called with SIGTERM, but not with SIGKILL (because killed = true)
    expect(fakeProcess.kill).toHaveBeenCalledWith("SIGTERM");
    const sigkillCall = vi.mocked(fakeProcess.kill).mock.calls.find((c) => c[0] === "SIGKILL");
    expect(sigkillCall).toBeUndefined();

    vi.useRealTimers();
  });
});

// ── getOrStart ────────────────────────────────────────────────────────────────

describe("DevServerManager.getOrStart", () => {
  it("returns undefined when presentation has no pre-allocated port", async () => {
    const portChecker = makeMockPortChecker(new Set([9000]));
    const manager = new DevServerManager("/fake", makeOptions(), portChecker);
    // allocatePorts not called → portAssignments is empty
    const result = await manager.getOrStart("talk", [makePresentation("talk")]);
    expect(result).toBeUndefined();
  });

  it("all presentations are eligible — preAssignPorts assigns ports to all", async () => {
    const portChecker = makeMockPortChecker(new Set([9000, 9001, 9002]));
    const manager = new DevServerManager("/fake", makeOptions(), portChecker);
    const presentations = [
      makePresentation("getting-started/intro"),
      makePresentation("advanced/deep-dive"),
    ];
    manager.preAssignPorts(presentations);

    // All presentations get ports (no allowlist anymore)
    const pm = (manager as unknown as { portAssignments: Map<string, number> }).portAssignments;
    expect(pm.has("getting-started/intro")).toBe(true);
    expect(pm.has("advanced/deep-dive")).toBe(true);
  });

  it("deduplicates concurrent getOrStart calls — only one spawn in-flight", async () => {
    const portChecker = makeMockPortChecker(new Set([9000]));
    const manager = new DevServerManager("/fake", makeOptions(), portChecker);
    manager.preAssignPorts([makePresentation("talk")]);

    let spawnCount = 0;
    vi.spyOn(await import("node:child_process"), "spawn").mockImplementation(() => {
      spawnCount++;
      const p = makeFakeProcess();
      // Exit quickly so the promises resolve without waiting the hardcoded 60s timeout
      setTimeout(() => p.emit("exit", 1), 50);
      return p as unknown as ReturnType<typeof import("node:child_process").spawn>;
    });

    // Call getOrStart twice simultaneously — regardless of whether the server
    // starts successfully, only ONE spawn must occur.
    await Promise.all([
      manager.getOrStart("talk", [makePresentation("talk")]),
      manager.getOrStart("talk", [makePresentation("talk")]),
    ]);

    expect(spawnCount).toBe(1);
  });

  it("returns the URL immediately if server is already running", async () => {
    const portChecker = makeMockPortChecker(new Set([9000]));
    const manager = new DevServerManager("/fake", makeOptions(), portChecker);

    // Inject a fake active server directly
    const fakeProcess = makeFakeProcess();
    (manager as unknown as { activeServers: Array<{ process: ChildProcess; port: number; presentationId: string }> })
      .activeServers.push({ process: fakeProcess, port: 9000, presentationId: "talk" });

    const result = await manager.getOrStart("talk", [makePresentation("talk")]);
    expect(result).toBe("http://127.0.0.1:9000");
  });
});
