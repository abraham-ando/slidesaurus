import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

import { getSlidevCacheDir } from "../../fs/fileSystem";
import { getSlidevBuildOutputDir } from "../../fs/outputManager";
import { createIsolatedBuildDir, cleanupIsolatedBuildDir } from "../../fs/isolatedBuild";

describe("getSlidevCacheDir", () => {
  it("returns path within .docusaurus directory", () => {
    const result = getSlidevCacheDir("/project", "default");
    expect(result).toBe(
      path.join("/project", ".docusaurus", "slidesaurus", "default"),
    );
  });

  it("includes plugin id in path", () => {
    const result = getSlidevCacheDir("/project", "custom-id");
    expect(result).toContain("custom-id");
  });
});

describe("getSlidevBuildOutputDir", () => {
  it("returns output subdirectory of cache dir", () => {
    const result = getSlidevBuildOutputDir("/project", "default");
    expect(result).toBe(
      path.join(
        "/project",
        ".docusaurus",
        "slidesaurus",
        "default",
        "output",
      ),
    );
  });
});

describe("createIsolatedBuildDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("copies .md file to isolated directory", () => {
    const sourceDir = path.join(tmpDir, "source");
    fs.mkdirSync(sourceDir, { recursive: true });
    const mdFile = path.join(sourceDir, "slides.md");
    fs.writeFileSync(mdFile, "---\ntitle: Test\n---\n# Slide");

    const cacheDir = path.join(tmpDir, "cache");
    const result = createIsolatedBuildDir(mdFile, "my-slides", cacheDir);

    expect(fs.existsSync(result)).toBe(true);
    expect(fs.readFileSync(result, "utf-8")).toContain("title: Test");
  });

  it("copies co-located assets but not other .md files", () => {
    const sourceDir = path.join(tmpDir, "source");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "slides.md"), "# Main");
    fs.writeFileSync(path.join(sourceDir, "other.md"), "# Other");
    fs.writeFileSync(path.join(sourceDir, "image.png"), "fake-png");

    const cacheDir = path.join(tmpDir, "cache");
    createIsolatedBuildDir(
      path.join(sourceDir, "slides.md"),
      "test",
      cacheDir,
    );

    const isolatedDir = path.join(cacheDir, "builds", "test");
    // File is renamed to {safeId}.md to avoid filename collisions in batch builds
    expect(fs.existsSync(path.join(isolatedDir, "test.md"))).toBe(true);
    expect(fs.existsSync(path.join(isolatedDir, "image.png"))).toBe(true);
    expect(fs.existsSync(path.join(isolatedDir, "other.md"))).toBe(false);
  });

  it("creates a dummy index.html", () => {
    const sourceDir = path.join(tmpDir, "source");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "slides.md"), "# Slides");

    const cacheDir = path.join(tmpDir, "cache");
    createIsolatedBuildDir(
      path.join(sourceDir, "slides.md"),
      "test",
      cacheDir,
    );

    const indexPath = path.join(cacheDir, "builds", "test", "index.html");
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it("sanitizes presentation id with slashes", () => {
    const sourceDir = path.join(tmpDir, "source");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "slides.md"), "# Slides");

    const cacheDir = path.join(tmpDir, "cache");
    createIsolatedBuildDir(
      path.join(sourceDir, "slides.md"),
      "cat/sub-slide",
      cacheDir,
    );

    const isolatedDir = path.join(cacheDir, "builds", "cat__sub-slide");
    expect(fs.existsSync(isolatedDir)).toBe(true);
  });
});

describe("cleanupIsolatedBuildDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cleanup-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("removes known artifacts from isolated dir", () => {
    const isolatedDir = path.join(tmpDir, "build");
    fs.mkdirSync(isolatedDir, { recursive: true });
    fs.writeFileSync(path.join(isolatedDir, "index.html"), "<html>");
    fs.mkdirSync(path.join(isolatedDir, "dist"), { recursive: true });
    fs.mkdirSync(path.join(isolatedDir, ".slidev"), { recursive: true });
    fs.writeFileSync(path.join(isolatedDir, "slides.md"), "# Keep");

    cleanupIsolatedBuildDir(isolatedDir);

    expect(fs.existsSync(path.join(isolatedDir, "index.html"))).toBe(false);
    expect(fs.existsSync(path.join(isolatedDir, "dist"))).toBe(false);
    expect(fs.existsSync(path.join(isolatedDir, ".slidev"))).toBe(false);
    expect(fs.existsSync(path.join(isolatedDir, "slides.md"))).toBe(true);
  });

  it("handles non-existent directory gracefully", () => {
    expect(() =>
      cleanupIsolatedBuildDir(path.join(tmpDir, "nope")),
    ).not.toThrow();
  });
});
