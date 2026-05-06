import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginOptions } from "../types";

vi.mock("../logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    code: (s: string) => s,
    path: (s: string) => s,
  },
}));

// File-level mock so it's hoisted before any imports and doesn't bleed into
// other test files. Each test gets a fresh mock via beforeEach resets.
const mockStopAll = vi.fn();
const mockPreAssignPorts = vi.fn().mockReturnValue(new Map([["talk", 8600]]));
const mockGetOrStart = vi.fn();

vi.mock("../devServerManager", () => ({
  DevServerManager: vi.fn().mockImplementation(() => ({
    preAssignPorts: mockPreAssignPorts,
    getOrStart: mockGetOrStart,
    stopAll: mockStopAll,
  })),
}));

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
    devServerBasePort: 8600,
    devServerTimeout: 60000,
    ...overrides,
  };
}

describe("devServer — module-level singleton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resetManagerForTesting clears the singleton — getOrStartDevServer returns undefined", async () => {
    const { assignDevPorts, getOrStartDevServer, resetManagerForTesting } = await import("../devServer");

    // Populate the singleton
    assignDevPorts([], makeOptions(), "/fake/site");

    // After reset the singleton is null
    resetManagerForTesting();

    // currentManager is null → optional-chain returns undefined without calling getOrStart
    const result = await getOrStartDevServer("talk", []);
    expect(result).toBeUndefined();
    expect(mockGetOrStart).not.toHaveBeenCalled();
  });

  it("assignDevPorts calls stopAll on the previous manager before creating a new one", async () => {
    const { assignDevPorts, resetManagerForTesting } = await import("../devServer");

    // Ensure clean slate
    resetManagerForTesting();

    assignDevPorts([], makeOptions(), "/fake/site");
    // First call — no previous manager, stopAll not called
    expect(mockStopAll).not.toHaveBeenCalled();

    assignDevPorts([], makeOptions(), "/fake/site");
    // Second call — previous manager exists, stopAll must be called once
    expect(mockStopAll).toHaveBeenCalledTimes(1);
  });

  it("stopAllDevServers clears the singleton", async () => {
    const { assignDevPorts, getOrStartDevServer, stopAllDevServers } = await import("../devServer");

    assignDevPorts([], makeOptions(), "/fake/site");
    stopAllDevServers();

    const result = await getOrStartDevServer("talk", []);
    expect(result).toBeUndefined();
    expect(mockStopAll).toHaveBeenCalledTimes(2); // assignDevPorts (stopAll on prev=null skips) + stopAllDevServers
  });
});
