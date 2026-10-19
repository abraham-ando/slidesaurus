import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

vi.mock("prompts", () => ({ default: vi.fn().mockResolvedValue({ confirmed: true }) }));

const { mockLoadPluginOptions, mockResolveOptions } = vi.hoisted(() => ({
  mockLoadPluginOptions: vi.fn(),
  mockResolveOptions: vi.fn(),
}));

vi.mock("../../cli/config", () => ({
  loadPluginOptions: mockLoadPluginOptions,
  resolveOptions: mockResolveOptions,
}));

import { runCacheClear } from "../commands/cache";

describe("runCacheClear", () => {
  let tmpDir: string;
  let cacheDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-cache-"));
    // Simulate .docusaurus/slidesaurus/default inside tmpDir
    cacheDir = path.join(tmpDir, ".docusaurus", "slidesaurus", "default");
    fs.mkdirSync(cacheDir, { recursive: true });

    mockLoadPluginOptions.mockReturnValue({ options: {}, configFile: null, pluginFound: false });
    mockResolveOptions.mockReturnValue({
      path: "./slidev",
      routeBasePath: "/slidev",
      id: "default",
    });

    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("removes the entire cache directory on full clear", async () => {
    expect(fs.existsSync(cacheDir)).toBe(true);
    await runCacheClear({ yes: true, pluginId: "default" });
    expect(fs.existsSync(cacheDir)).toBe(false);
  });

  it("removes only the targeted output dir and updates the manifest", async () => {
    // Create the output directory matching getSlidevBuildOutputDir + presentationId path
    // presentationId "intro/getting-started" → output/intro/getting-started/ (nested)
    const outputDir = path.join(cacheDir, "output", "intro", "getting-started");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "index.html"), "");

    // Write a manifest with two entries (versioned format)
    const manifest = {
      version: 2,
      hashes: {
        "intro/getting-started": "hash-a",
        "advanced/deep-dive": "hash-b",
      },
    };
    fs.writeFileSync(path.join(cacheDir, "build-hashes.json"), JSON.stringify(manifest));

    await runCacheClear({ presentation: "intro/getting-started", yes: true, pluginId: "default" });

    // Output dir should be gone
    expect(fs.existsSync(outputDir)).toBe(false);

    // Manifest should still have the other entry
    const saved = JSON.parse(fs.readFileSync(path.join(cacheDir, "build-hashes.json"), "utf-8"));
    expect(saved.hashes?.["intro/getting-started"]).toBeUndefined();
    expect(saved.hashes?.["advanced/deep-dive"]).toBe("hash-b");
  });

  it("warns when the targeted presentation has no cached output", async () => {
    const logSpy = vi.spyOn(console, "log");
    await runCacheClear({ presentation: "nonexistent", yes: true, pluginId: "default" });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No cached output"));
    logSpy.mockRestore();
  });

  it("prints info when the cache directory does not exist", async () => {
    fs.rmSync(cacheDir, { recursive: true });
    const logSpy = vi.spyOn(console, "log");
    await runCacheClear({ yes: true, pluginId: "default" });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("already empty"));
    logSpy.mockRestore();
  });

  describe("targeted clear guard", () => {
    let outputRoot: string;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      outputRoot = path.join(cacheDir, "output");
      fs.mkdirSync(path.join(outputRoot, "keep-me"), { recursive: true });
      fs.writeFileSync(path.join(outputRoot, "keep-me", "index.html"), "");
      exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called");
      }) as never);
    });

    afterEach(() => {
      exitSpy.mockRestore();
    });

    it.each([".", "", "   ", "./", "a/..", "..", "../escape", "intro/../.."])(
      "refuses presentation %j and keeps the output root intact",
      async (bad) => {
        await expect(
          runCacheClear({ presentation: bad, yes: true, pluginId: "default" }),
        ).rejects.toThrow("process.exit called");
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(fs.existsSync(path.join(outputRoot, "keep-me", "index.html"))).toBe(true);
      },
    );
  });
});
