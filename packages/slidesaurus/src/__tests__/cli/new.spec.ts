import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// Mock prompts so interactive questions are skipped
vi.mock("prompts", () => ({ default: vi.fn().mockResolvedValue({}) }));

// vi.hoisted ensures these are available when vi.mock factory runs (hoisting order)
const { mockLoadPluginOptions, mockResolveOptions } = vi.hoisted(() => ({
  mockLoadPluginOptions: vi.fn(),
  mockResolveOptions: vi.fn(),
}));

vi.mock("../../cli/config", () => ({
  loadPluginOptions: mockLoadPluginOptions,
  resolveOptions: mockResolveOptions,
}));

import { runNew } from "../../cli/commands/new";

describe("runNew", () => {
  let tmpDir: string;
  let slidevDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-new-"));
    slidevDir = path.join(tmpDir, "slidev");
    fs.mkdirSync(slidevDir, { recursive: true });

    mockLoadPluginOptions.mockReturnValue({ options: {}, configFile: null, pluginFound: false });
    mockResolveOptions.mockImplementation((_opts: object, id: string) => ({
      path: slidevDir,
      routeBasePath: "/slidev",
      id,
      theme: "seriph",
    }));

    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a basic .md file at the correct path", async () => {
    await runNew("my-talk", { template: "basic", theme: "seriph", pluginId: "default" });

    const target = path.join(slidevDir, "my-talk.md");
    expect(fs.existsSync(target)).toBe(true);
    const content = fs.readFileSync(target, "utf-8");
    expect(content).toContain("title: My Talk");
    expect(content).toContain("theme: seriph");
  });

  it("creates nested category/name structure from slash-separated name", async () => {
    await runNew("intro/getting-started", { template: "basic", theme: "seriph", pluginId: "default" });

    const target = path.join(slidevDir, "intro", "getting-started.md");
    expect(fs.existsSync(target)).toBe(true);
  });

  it("uses --category flag to prefix the file path", async () => {
    await runNew("deep-dive", { category: "advanced", template: "talk", theme: "seriph", pluginId: "default" });

    const target = path.join(slidevDir, "advanced", "deep-dive.md");
    expect(fs.existsSync(target)).toBe(true);
    const content = fs.readFileSync(target, "utf-8");
    expect(content).toContain("title: Deep Dive");
  });

  it("exits with code 1 when file already exists and --force not set", async () => {
    fs.writeFileSync(path.join(slidevDir, "existing.md"), "# Old");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    await expect(
      runNew("existing", { template: "basic", pluginId: "default" }),
    ).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("overwrites existing file when --force is set", async () => {
    const target = path.join(slidevDir, "existing.md");
    fs.writeFileSync(target, "# Old content");

    await runNew("existing", { template: "tutorial", theme: "seriph", force: true, pluginId: "default" });

    const content = fs.readFileSync(target, "utf-8");
    expect(content).toContain("Prerequisites");
    expect(content).not.toBe("# Old content");
  });

  it("uses tutorial template with level and duration frontmatter", async () => {
    await runNew("my-tutorial", { template: "tutorial", theme: "seriph", pluginId: "default" });

    const target = path.join(slidevDir, "my-tutorial.md");
    const content = fs.readFileSync(target, "utf-8");
    expect(content).toContain("level: beginner");
    expect(content).toContain("duration: 30");
  });
});
