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

import { cleanupSourceDirectory, getSlidevCacheDir } from "../../fs/fileSystem";
import { getSlidevBuildOutputDir } from "../../fs/outputManager";
import {
  createIsolatedBuild,
  createIsolatedBuildDir,
  cleanupIsolatedBuildDir,
  purgeIsolatedBuilds,
} from "../../fs/isolatedBuild";
import { toSafeId } from "../../../shared/utils";

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

  it("uses a separate cache per locale", () => {
    const fr = getSlidevCacheDir("/project", "default", "fr");
    const en = getSlidevCacheDir("/project", "default", "en");
    expect(fr).toBe(
      path.join(
        "/project",
        ".docusaurus",
        "slidesaurus",
        "default",
        "i18n",
        "fr",
      ),
    );
    expect(fr).not.toBe(en);
  });

  it("rejects a locale that could traverse the filesystem", () => {
    expect(() => getSlidevCacheDir("/project", "default", "../evil")).toThrow(
      "[Security]",
    );
  });
});

describe("getSlidevBuildOutputDir", () => {
  it("returns output subdirectory of cache dir", () => {
    const result = getSlidevBuildOutputDir("/project", "default");
    expect(result).toBe(
      path.join("/project", ".docusaurus", "slidesaurus", "default", "output"),
    );
  });

  it("is locale-aware", () => {
    expect(getSlidevBuildOutputDir("/project", "default", "fr")).toBe(
      path.join(
        "/project",
        ".docusaurus",
        "slidesaurus",
        "default",
        "i18n",
        "fr",
        "output",
      ),
    );
  });
});

describe("cleanupSourceDirectory", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cleanup-src-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("removes the empty index.html sentinel written by older plugin versions", () => {
    fs.writeFileSync(path.join(tmpDir, "index.html"), "");
    cleanupSourceDirectory(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, "index.html"))).toBe(false);
  });

  it("keeps a legitimate (non-empty) index.html, dist/ and .slidev/", () => {
    fs.writeFileSync(
      path.join(tmpDir, "index.html"),
      "<head><script src=x></script></head>",
    );
    fs.mkdirSync(path.join(tmpDir, "dist"));
    fs.mkdirSync(path.join(tmpDir, ".slidev", "drawings"), { recursive: true });
    cleanupSourceDirectory(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "dist"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".slidev", "drawings"))).toBe(true);
  });

  it("handles a missing directory", () => {
    expect(() =>
      cleanupSourceDirectory(path.join(tmpDir, "nope")),
    ).not.toThrow();
  });
});

describe("createIsolatedBuild", () => {
  let tmpDir: string;
  let slides: string;
  let cacheDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-test-"));
    slides = path.join(tmpDir, "slidev");
    cacheDir = path.join(tmpDir, "cache");
    fs.mkdirSync(slides, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function write(rel: string, content = "x"): string {
    const p = path.join(slides, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
    return p;
  }

  it("copies the .md file to the isolated directory under its safeId", () => {
    const md = write("slides.md", "---\ntitle: Test\n---\n# Slide");
    const result = createIsolatedBuildDir(md, "my-slides", cacheDir);
    expect(path.basename(result)).toBe("my-slides.md");
    expect(fs.readFileSync(result, "utf-8")).toContain("title: Test");
  });

  it("copies co-located assets but not other .md files", () => {
    const md = write("slides.md", "# Main");
    write("other.md", "# Other");
    write("image.png", "fake-png");

    const { isolatedSourcePath } = createIsolatedBuild(
      md,
      "test",
      cacheDir,
      slides,
    );
    const dir = path.dirname(isolatedSourcePath);
    expect(fs.existsSync(path.join(dir, "image.png"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "other.md"))).toBe(false);
  });

  it("does not copy sibling category directories, but copies Slidev conventional dirs", () => {
    const md = write("intro.md", "# Intro");
    write("other-category/talk.md", "# Talk");
    write("other-category/big.png", "png");
    write("components/Counter.vue", "<template/>");
    write("styles/index.css", "body{}");
    write("diagrams/flow.svg", "<svg/>");

    const { isolatedSourcePath } = createIsolatedBuild(
      md,
      "intro",
      cacheDir,
      slides,
    );
    const dir = path.dirname(isolatedSourcePath);
    expect(fs.existsSync(path.join(dir, "other-category"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "components", "Counter.vue"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(dir, "styles", "index.css"))).toBe(true);
    // Not a category (no .md inside) → regular asset directory
    expect(fs.existsSync(path.join(dir, "diagrams", "flow.svg"))).toBe(true);
  });

  it("copies ../ relative assets that stay inside the slides root (mirrored layout)", () => {
    write("shared/logo.png", "logo");
    const md = write("cat/talk.md", "# Talk\n\n![logo](../shared/logo.png)\n");

    const { isolatedSourcePath } = createIsolatedBuild(
      md,
      "cat/talk",
      cacheDir,
      slides,
    );
    const resolved = path.resolve(
      path.dirname(isolatedSourcePath),
      "../shared/logo.png",
    );
    expect(fs.readFileSync(resolved, "utf-8")).toBe("logo");
  });

  it("never copies references escaping the slides root", () => {
    fs.writeFileSync(path.join(tmpDir, "secret.txt"), "secret");
    const md = write("talk.md", "![x](../secret.txt)\n");

    const { isolatedDir } = createIsolatedBuild(md, "talk", cacheDir, slides);
    const all = fs.readdirSync(isolatedDir, { recursive: true }) as string[];
    expect(all.some((f) => f.includes("secret"))).toBe(false);
  });

  it("copies Markdown imported with src: (and its own assets)", () => {
    write("pages/part.md", "# Part\n\n![d](./diagram.png)\n");
    write("pages/diagram.png", "d");
    const md = write(
      "talks/main.md",
      "---\ntitle: Main\n---\n\n---\nsrc: ../pages/part.md\n---\n",
    );

    const { isolatedSourcePath } = createIsolatedBuild(
      md,
      "talks/main",
      cacheDir,
      slides,
    );
    const dir = path.dirname(isolatedSourcePath);
    expect(fs.existsSync(path.resolve(dir, "../pages/part.md"))).toBe(true);
    expect(fs.existsSync(path.resolve(dir, "../pages/diagram.png"))).toBe(true);
  });

  it("creates a dummy index.html without touching a user's index.html", () => {
    const md = write("slides.md", "# Slides");
    const { isolatedSourcePath } = createIsolatedBuild(
      md,
      "test",
      cacheDir,
      slides,
    );
    expect(
      fs.existsSync(path.join(path.dirname(isolatedSourcePath), "index.html")),
    ).toBe(true);

    const userIndex = write("index.html", "<head>custom</head>");
    const second = createIsolatedBuild(md, "test", cacheDir, slides);
    const copy = path.join(
      path.dirname(second.isolatedSourcePath),
      "index.html",
    );
    // Simulate Slidev overwriting its root index.html during the build
    fs.writeFileSync(copy, "generated");
    expect(fs.readFileSync(userIndex, "utf-8")).toBe("<head>custom</head>");
  });

  it("uses the injective safeId for ids with slashes", () => {
    const md = write("slides.md", "# Slides");
    const { isolatedDir, safeId } = createIsolatedBuild(
      md,
      "cat/sub-slide",
      cacheDir,
    );
    expect(safeId).toBe(toSafeId("cat/sub-slide"));
    expect(isolatedDir).toBe(path.resolve(cacheDir, "builds", safeId));
    expect(
      createIsolatedBuild(md, "cat__sub-slide", cacheDir).isolatedDir,
    ).not.toBe(isolatedDir);
  });

  it("starts from a clean directory (stale files removed)", () => {
    const md = write("slides.md", "# Slides");
    const { isolatedDir } = createIsolatedBuild(md, "test", cacheDir);
    fs.writeFileSync(path.join(isolatedDir, "stale.txt"), "old");
    createIsolatedBuild(md, "test", cacheDir);
    expect(fs.existsSync(path.join(isolatedDir, "stale.txt"))).toBe(false);
  });
});

describe("cleanupIsolatedBuildDir / purgeIsolatedBuilds", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cleanup-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("removes the whole isolated directory (sources, copied assets, artifacts)", () => {
    const isolatedDir = path.join(tmpDir, "build");
    fs.mkdirSync(path.join(isolatedDir, "dist"), { recursive: true });
    fs.writeFileSync(path.join(isolatedDir, "slides.md"), "# x");
    fs.writeFileSync(path.join(isolatedDir, "logo.png"), "png");

    cleanupIsolatedBuildDir(isolatedDir);
    expect(fs.existsSync(isolatedDir)).toBe(false);
  });

  it("handles non-existent directory gracefully", () => {
    expect(() =>
      cleanupIsolatedBuildDir(path.join(tmpDir, "nope")),
    ).not.toThrow();
  });

  it("purges every leftover under builds/", () => {
    fs.mkdirSync(path.join(tmpDir, "builds", "a"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "output", "a"), { recursive: true });
    purgeIsolatedBuilds(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, "builds"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, "output", "a"))).toBe(true);
  });
});
