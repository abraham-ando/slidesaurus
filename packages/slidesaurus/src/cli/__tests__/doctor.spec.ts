import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const mocks = vi.hoisted(() => ({
  findConfigFile: vi.fn(),
  loadPluginOptions: vi.fn(),
  resolveOptions: vi.fn(),
  scanPresentations: vi.fn(),
  checkSlidevInstalled: vi.fn(),
  resolveThemePackageName: vi.fn(),
  resolveAddonPackageName: vi.fn(),
  checkPackageAvailable: vi.fn(),
}));

vi.mock("../config", () => ({
  findConfigFile: mocks.findConfigFile,
  loadPluginOptions: mocks.loadPluginOptions,
  resolveOptions: mocks.resolveOptions,
}));
vi.mock("../../application/scanner", () => ({ scanPresentations: mocks.scanPresentations }));
vi.mock("../../application/builder", () => ({ checkSlidevInstalled: mocks.checkSlidevInstalled }));
vi.mock("../../infrastructure/packages/packageResolver", () => ({
  resolveThemePackageName: mocks.resolveThemePackageName,
  resolveAddonPackageName: mocks.resolveAddonPackageName,
  checkPackageAvailable: mocks.checkPackageAvailable,
}));

import { runDoctor, isSupportedNodeVersion } from "../commands/doctor";

describe("isSupportedNodeVersion", () => {
  it.each([
    ["20.12.0", true],
    ["20.19.1", true],
    ["22.0.0", true],
    ["20.11.9", false],
    ["18.20.0", false],
    ["nonsense", false],
  ])("%s → %s", (version, expected) => {
    expect(isSupportedNodeVersion(version)).toBe(expected);
  });
});

describe("runDoctor", () => {
  let tmpDir: string;
  let originalCwd: string;
  let output: string[];

  const flush = () => output.join("\n");

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-doctor-"));
    fs.mkdirSync(path.join(tmpDir, "slidev"));
    process.chdir(tmpDir);

    output = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => { output.push(args.join(" ")); });

    mocks.findConfigFile.mockReturnValue(path.join(tmpDir, "docusaurus.config.ts"));
    mocks.loadPluginOptions.mockReturnValue({ options: {}, configFile: "x", pluginFound: true });
    mocks.resolveOptions.mockReturnValue({ path: "./slidev", routeBasePath: "/slidev", id: "default", theme: "seriph" });
    mocks.checkSlidevInstalled.mockReturnValue(true);
    mocks.scanPresentations.mockResolvedValue({
      presentations: [{ id: "a", title: "A", theme: "unicorn", addons: ["excalidraw"] }],
      categories: [],
      playlists: [],
    });
    mocks.resolveThemePackageName.mockImplementation((t: string) => `resolved:${t}`);
    mocks.resolveAddonPackageName.mockImplementation((a: string) => `addon:${a}`);
    mocks.checkPackageAvailable.mockReturnValue({ installed: true, resolvedName: "x" });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    Object.values(mocks).forEach((m) => m.mockReset());
  });

  it("resolves themes and addons through packageResolver (same as the build)", async () => {
    await runDoctor({ pluginId: "default" }).catch(() => undefined);

    expect(mocks.resolveThemePackageName).toHaveBeenCalledWith("seriph", tmpDir);
    expect(mocks.resolveThemePackageName).toHaveBeenCalledWith("unicorn", tmpDir);
    expect(mocks.resolveAddonPackageName).toHaveBeenCalledWith("excalidraw");
    const checked = mocks.checkPackageAvailable.mock.calls.map((c) => c[0]);
    expect(checked).toEqual(expect.arrayContaining(["resolved:seriph", "resolved:unicorn", "addon:excalidraw"]));
  });

  it("does not check dev server ports anymore", async () => {
    await runDoctor({ pluginId: "default" }).catch(() => undefined);
    expect(flush()).not.toMatch(/dev server ports/i);
  });

  it("exits with code 1 when a theme is missing", async () => {
    mocks.checkPackageAvailable.mockImplementation((name: string) =>
      name === "resolved:unicorn"
        ? { installed: false, resolvedName: name, error: "not found" }
        : { installed: true, resolvedName: name },
    );
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    await expect(runDoctor({ pluginId: "default" })).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(flush()).toContain("unicorn");
  });

  it("reports a missing slidev directory", async () => {
    fs.rmSync(path.join(tmpDir, "slidev"), { recursive: true });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    await expect(runDoctor({ pluginId: "default" })).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mocks.scanPresentations).not.toHaveBeenCalled();
  });
});
