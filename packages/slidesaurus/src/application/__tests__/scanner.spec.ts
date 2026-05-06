import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PluginOptions, BuildContext } from "../../domain/types";

vi.mock("../../shared/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    path: (p: string) => p,
    code: (c: string) => c,
  },
}));

const defaultOptions: PluginOptions = {
  path: "slidev",
  download: false,
  exportFormats: ["pdf"],
  routeBasePath: "/slidev",
  pageTitle: "Presentations",
  pageTagline: "Overview",
  id: "default",
  theme: "unicorn",
  addons: [],
  buildTimeout: 120,
  verbose: false,
  maxParallelBuilds: 4,
  autoInstall: true,
  dryRun: false,
};

function makeFrontmatter(data: Record<string, unknown>): string {
  const lines = Object.entries(data).map(([k, v]) => {
    if (Array.isArray(v)) {
      return `${k}:\n${v.map((i) => `  - ${i}`).join("\n")}`;
    }
    return `${k}: ${v}`;
  });
  return `---\n${lines.join("\n")}\n---\n\n# Slide 1\nContent`;
}

describe("scanPresentations", () => {
  let tmpDir: string;
  let slidevDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-test-"));
    slidevDir = path.join(tmpDir, "slidev");
    fs.mkdirSync(slidevDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function context(): BuildContext {
    return { siteDir: tmpDir, baseUrl: "/" };
  }

  async function scan(overrides: Partial<PluginOptions> = {}) {
    const { scanPresentations } = await import("../scanner");
    return scanPresentations({ ...defaultOptions, ...overrides }, context());
  }

  it("discovers .md files in flat directory", async () => {
    fs.writeFileSync(
      path.join(slidevDir, "intro.md"),
      makeFrontmatter({ title: "Introduction" }),
    );
    fs.writeFileSync(
      path.join(slidevDir, "advanced.md"),
      makeFrontmatter({ title: "Advanced" }),
    );

    const result = await scan();
    expect(result.presentations).toHaveLength(2);
    const titles = result.presentations.map((p) => p.title).sort();
    expect(titles).toEqual(["Advanced", "Introduction"]);
  });

  it("extracts frontmatter metadata", async () => {
    fs.writeFileSync(
      path.join(slidevDir, "talk.md"),
      makeFrontmatter({
        title: "My Talk",
        description: "A great talk",
        theme: "seriph",
        tags: ["intro", "demo"],
        author: "Dev",
      }),
    );

    const result = await scan();
    const p = result.presentations[0];
    expect(p.title).toBe("My Talk");
    expect(p.description).toBe("A great talk");
    expect(p.theme).toBe("seriph");
    expect(p.tags).toEqual(["intro", "demo"]);
    expect(p.author).toBe("Dev");
  });

  it("builds category metadata from subdirectories", async () => {
    const basics = path.join(slidevDir, "basics");
    fs.mkdirSync(basics, { recursive: true });
    fs.writeFileSync(
      path.join(basics, "start.md"),
      makeFrontmatter({ title: "Start" }),
    );

    const result = await scan();
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].path).toBe("basics");
    expect(result.categories[0].count).toBe(1);
  });

  it("reads _category_.yml for label and position", async () => {
    const basics = path.join(slidevDir, "basics");
    fs.mkdirSync(basics, { recursive: true });
    fs.writeFileSync(
      path.join(basics, "start.md"),
      makeFrontmatter({ title: "Start" }),
    );
    fs.writeFileSync(
      path.join(basics, "_category_.yml"),
      "label: Getting Started\nposition: 1\n",
    );

    const result = await scan();
    expect(result.categories[0].label).toBe("Getting Started");
    expect(result.categories[0].position).toBe(1);
  });

  it("ignores dotfiles, node_modules, and files starting with _", async () => {
    fs.writeFileSync(
      path.join(slidevDir, "visible.md"),
      makeFrontmatter({ title: "Visible" }),
    );
    fs.writeFileSync(
      path.join(slidevDir, ".hidden.md"),
      makeFrontmatter({ title: "Hidden" }),
    );
    fs.writeFileSync(
      path.join(slidevDir, "_draft.md"),
      makeFrontmatter({ title: "Draft" }),
    );
    const nm = path.join(slidevDir, "node_modules");
    fs.mkdirSync(nm, { recursive: true });
    fs.writeFileSync(
      path.join(nm, "dep.md"),
      makeFrontmatter({ title: "Dep" }),
    );

    const result = await scan();
    expect(result.presentations).toHaveLength(1);
    expect(result.presentations[0].title).toBe("Visible");
  });

  it("returns empty when no files found", async () => {
    const result = await scan();
    expect(result.presentations).toHaveLength(0);
    expect(result.categories).toHaveLength(0);
  });

  it("uses file basename as title when frontmatter title is missing", async () => {
    fs.writeFileSync(
      path.join(slidevDir, "no-title.md"),
      "---\ndescription: just desc\n---\n\n# Slide 1",
    );

    const result = await scan();
    expect(result.presentations[0].title).toBe("no-title");
  });

  it("generates correct url paths", async () => {
    fs.writeFileSync(
      path.join(slidevDir, "demo.md"),
      makeFrontmatter({ title: "Demo" }),
    );

    const result = await scan();
    expect(result.presentations[0].url).toContain("/slidev/demo/");
    expect(result.presentations[0].id).toBe("demo");
  });

  it("uses routeBasePath (not filesystem path) for presentation URLs", async () => {
    fs.writeFileSync(
      path.join(slidevDir, "intro.md"),
      makeFrontmatter({ title: "Intro" }),
    );

    const result = await scan({ path: "slidev", routeBasePath: "/training" });
    expect(result.presentations[0].url).toContain("/training/intro/");
    expect(result.presentations[0].url).not.toContain("/slidev/intro/");
  });

  it("sets exportUrls when download is true", async () => {
    fs.writeFileSync(
      path.join(slidevDir, "demo.md"),
      makeFrontmatter({ title: "Demo" }),
    );
    const result = await scan({ download: true, exportFormats: ["pdf"] });
    expect(result.presentations[0].exportUrls).toHaveLength(1);
    expect(result.presentations[0].exportUrls![0]).toContain("/slidev/demo/");
    expect(result.presentations[0].exportUrls![0]).toMatch(/export\.pdf$/);
  });

  it("generates one exportUrl per format", async () => {
    fs.writeFileSync(
      path.join(slidevDir, "demo.md"),
      makeFrontmatter({ title: "Demo" }),
    );
    const result = await scan({ download: true, exportFormats: ["pdf", "pptx"] });
    expect(result.presentations[0].exportUrls).toHaveLength(2);
    expect(result.presentations[0].exportUrls![0]).toMatch(/export\.pdf$/);
    expect(result.presentations[0].exportUrls![1]).toMatch(/export\.pptx$/);
  });

  it("leaves exportUrls undefined when download is false", async () => {
    fs.writeFileSync(
      path.join(slidevDir, "demo.md"),
      makeFrontmatter({ title: "Demo" }),
    );
    const result = await scan({ download: false });
    expect(result.presentations[0].exportUrls).toBeUndefined();
  });

  it("leaves exportUrl undefined when download is false", async () => {
    fs.writeFileSync(
      path.join(slidevDir, "demo.md"),
      makeFrontmatter({ title: "Demo" }),
    );
    const result = await scan({ download: false });
    expect(result.presentations[0].exportUrls).toBeUndefined();
  });

  describe("enriched frontmatter fields", () => {
    it("extracts valid owner, level, duration, lastReviewed, deprecated", async () => {
      fs.writeFileSync(
        path.join(slidevDir, "enriched.md"),
        makeFrontmatter({
          title: "Enriched",
          owner: "platform-team",
          level: "intermediate",
          duration: 45,
          lastReviewed: "2025-03-01",
          deprecated: false,
        }),
      );

      const result = await scan();
      const p = result.presentations[0];
      expect(p.owner).toBe("platform-team");
      expect(p.level).toBe("intermediate");
      expect(p.duration).toBe(45);
      expect(p.lastReviewed).toBe("2025-03-01");
      expect(p.deprecated).toBe(false);
    });

    it("accepts all valid level values", async () => {
      for (const level of ["beginner", "intermediate", "advanced"]) {
        fs.writeFileSync(
          path.join(slidevDir, `${level}.md`),
          makeFrontmatter({ title: level, level }),
        );
      }
      const result = await scan();
      const levels = result.presentations.map((p) => p.level).sort();
      expect(levels).toEqual(["advanced", "beginner", "intermediate"]);
    });

    it("ignores invalid level and emits a warning", async () => {
      const { log } = await import("../../shared/logger");
      fs.writeFileSync(
        path.join(slidevDir, "bad-level.md"),
        makeFrontmatter({ title: "Bad", level: "expert" }),
      );
      const result = await scan();
      expect(result.presentations[0].level).toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('"level"'));
    });

    it("ignores duration <= 0 and emits a warning", async () => {
      const { log } = await import("../../shared/logger");
      fs.writeFileSync(
        path.join(slidevDir, "bad-duration.md"),
        makeFrontmatter({ title: "Bad", duration: -5 }),
      );
      const result = await scan();
      expect(result.presentations[0].duration).toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('"duration"'));
    });

    it("ignores malformed lastReviewed and emits a warning", async () => {
      const { log } = await import("../../shared/logger");
      fs.writeFileSync(
        path.join(slidevDir, "bad-date.md"),
        makeFrontmatter({ title: "Bad", lastReviewed: "01/03/2025" }),
      );
      const result = await scan();
      expect(result.presentations[0].lastReviewed).toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('"lastReviewed"'));
    });

    it("ignores non-boolean deprecated and emits a warning", async () => {
      const { log } = await import("../../shared/logger");
      fs.writeFileSync(
        path.join(slidevDir, "bad-deprecated.md"),
        "---\ntitle: Bad\ndeprecated: yes\n---\n\n# Slide",
      );
      const result = await scan();
      expect(result.presentations[0].deprecated).toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('"deprecated"'));
    });

    it("leaves enriched fields undefined when absent", async () => {
      fs.writeFileSync(
        path.join(slidevDir, "minimal.md"),
        makeFrontmatter({ title: "Minimal" }),
      );
      const result = await scan();
      const p = result.presentations[0];
      expect(p.owner).toBeUndefined();
      expect(p.level).toBeUndefined();
      expect(p.duration).toBeUndefined();
      expect(p.lastReviewed).toBeUndefined();
      expect(p.deprecated).toBeUndefined();
    });

    it("normalizes tags: trims whitespace, lowercases, and deduplicates", async () => {
      fs.writeFileSync(
        path.join(slidevDir, "tags.md"),
        "---\ntitle: Tags\ntags:\n  - React\n  -  TYPESCRIPT \n  - react\n---\n\n# Slide",
      );
      const result = await scan();
      expect(result.presentations[0].tags).toEqual(["react", "typescript"]);
    });

    it("ignores non-string tag items and emits a warning", async () => {
      const { log } = await import("../../shared/logger");
      // YAML integer in a tags list
      fs.writeFileSync(
        path.join(slidevDir, "bad-tags.md"),
        "---\ntitle: Bad\ntags:\n  - valid\n  - 42\n---\n\n# Slide",
      );
      const result = await scan();
      expect(result.presentations[0].tags).toEqual(["valid"]);
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("tag"));
    });

    it("ignores tags when value is not an array and emits a warning", async () => {
      const { log } = await import("../../shared/logger");
      fs.writeFileSync(
        path.join(slidevDir, "scalar-tags.md"),
        "---\ntitle: Bad\ntags: not-an-array\n---\n\n# Slide",
      );
      const result = await scan();
      expect(result.presentations[0].tags).toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('"tags"'));
    });

    it("extracts valid position", async () => {
      fs.writeFileSync(
        path.join(slidevDir, "pos.md"),
        makeFrontmatter({ title: "Pos", position: 3 }),
      );
      const result = await scan();
      expect(result.presentations[0].position).toBe(3);
    });

    it("ignores invalid position and emits a warning", async () => {
      const { log } = await import("../../shared/logger");
      fs.writeFileSync(
        path.join(slidevDir, "bad-pos.md"),
        makeFrontmatter({ title: "Bad", position: -1 }),
      );
      const result = await scan();
      expect(result.presentations[0].position).toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('"position"'));
    });

    it("extracts valid ISO date", async () => {
      fs.writeFileSync(
        path.join(slidevDir, "dated.md"),
        makeFrontmatter({ title: "Dated", date: "2024-06-15" }),
      );
      const result = await scan();
      expect(result.presentations[0].date).toBe("2024-06-15");
    });

    it("ignores malformed date and emits a warning", async () => {
      const { log } = await import("../../shared/logger");
      fs.writeFileSync(
        path.join(slidevDir, "bad-date2.md"),
        makeFrontmatter({ title: "Bad", date: "15/06/2024" }),
      );
      const result = await scan();
      expect(result.presentations[0].date).toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('"date"'));
    });
  });

  describe("playlist", () => {
    it("returns empty playlists when no presentations have playlist field", async () => {
      fs.writeFileSync(
        path.join(slidevDir, "talk.md"),
        makeFrontmatter({ title: "Talk" }),
      );
      const result = await scan();
      expect(result.playlists).toHaveLength(0);
    });

    it("builds a playlist from a single string value", async () => {
      fs.writeFileSync(
        path.join(slidevDir, "a.md"),
        "---\ntitle: A\nplaylist: Intro Track\nposition: 1\n---\n\n# Slide",
      );
      fs.writeFileSync(
        path.join(slidevDir, "b.md"),
        "---\ntitle: B\nplaylist: Intro Track\nposition: 2\n---\n\n# Slide",
      );
      const result = await scan();
      expect(result.playlists).toHaveLength(1);
      const pl = result.playlists[0];
      expect(pl.title).toBe("Intro Track");
      expect(pl.id).toBe("intro-track");
      expect(pl.items).toHaveLength(2);
      expect(pl.items[0]).toBe("a");
      expect(pl.items[1]).toBe("b");
    });

    it("builds multiple playlists", async () => {
      fs.writeFileSync(
        path.join(slidevDir, "c.md"),
        "---\ntitle: C\nplaylist:\n  - Track A\n  - Track B\n---\n\n# Slide",
      );
      const result = await scan();
      expect(result.playlists).toHaveLength(2);
      const ids = result.playlists.map((p) => p.id).sort();
      expect(ids).toEqual(["track-a", "track-b"]);
    });

    it("orders playlist items by position then id", async () => {
      for (const [name, pos] of [["z.md", 3], ["a.md", 1], ["m.md", 2]] as const) {
        fs.writeFileSync(
          path.join(slidevDir, name),
          `---\ntitle: ${name}\nplaylist: Ordered\nposition: ${pos}\n---\n\n# Slide`,
        );
      }
      const result = await scan();
      const pl = result.playlists[0];
      expect(pl.items).toEqual(["a", "m", "z"]);
    });

    it("stores playlist names on presentation metadata", async () => {
      fs.writeFileSync(
        path.join(slidevDir, "talk.md"),
        "---\ntitle: Talk\nplaylist: My Series\n---\n\n# Slide",
      );
      const result = await scan();
      expect(result.presentations[0].playlist).toEqual(["My Series"]);
    });

    it("ignores non-string playlist entries and emits a warning", async () => {
      const { log } = await import("../../shared/logger");
      fs.writeFileSync(
        path.join(slidevDir, "bad-pl.md"),
        "---\ntitle: Bad\nplaylist:\n  - Valid\n  - 42\n---\n\n# Slide",
      );
      const result = await scan();
      expect(result.presentations[0].playlist).toEqual(["Valid"]);
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("playlist"));
    });
  });
});

// ── onPresentationScanned error isolation ──────────────────────────────────

describe("scanPresentations — onPresentationScanned hook error handling", () => {
  let tmpDir: string;
  let slidevDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-hook-test-"));
    slidevDir = path.join(tmpDir, "slidev");
    fs.mkdirSync(slidevDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function context(): BuildContext {
    return { siteDir: tmpDir, baseUrl: "/" };
  }

  it("logs a warning and continues when hook throws — scan does not crash", async () => {
    const { log } = await import("../../shared/logger");
    const { scanPresentations } = await import("../scanner");

    fs.writeFileSync(path.join(slidevDir, "a.md"), "---\ntitle: A\n---\n\n# A");
    fs.writeFileSync(path.join(slidevDir, "b.md"), "---\ntitle: B\n---\n\n# B");

    const hookError = new Error("hook failed for testing");
    let callCount = 0;
    const result = await scanPresentations(
      {
        ...{
          path: "slidev",
          download: false,
          exportFormats: [],
          routeBasePath: "/slidev",
          pageTitle: "",
          pageTagline: "",
          id: "default",
          theme: undefined,
          addons: [],
          buildTimeout: 120,
          verbose: false,
          maxParallelBuilds: 4,
          autoInstall: false,
          dryRun: false,
          withoutNotes: false,
          exportWithClicks: false,
          devServerBasePort: 8600,
          devServerTimeout: 60000,
        },
        onPresentationScanned: async () => {
          callCount++;
          throw hookError;
        },
      },
      context(),
    );

    // Scan completes — presentations are returned, not lost
    expect(result.presentations).toHaveLength(2);
    // Hook was called for each presentation
    expect(callCount).toBe(2);
    // Warning logged for each failure
    expect(vi.mocked(log.warn)).toHaveBeenCalledWith(
      expect.stringContaining("onPresentationScanned hook threw"),
    );
  });
});

// ── relativePath normalization ─────────────────────────────────────────────

describe("scanPresentations — relativePath uses forward slashes", () => {
  let tmpDir: string;
  let slidevDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-path-test-"));
    slidevDir = path.join(tmpDir, "slidev");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes forward-slash relative path to transformFrontmatter on all platforms", async () => {
    const { scanPresentations } = await import("../scanner");

    const subDir = path.join(slidevDir, "getting-started");
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, "intro.md"), "---\ntitle: Intro\n---\n\n# Intro");

    const capturedPaths: string[] = [];
    await scanPresentations(
      {
        path: "slidev",
        download: false,
        exportFormats: [],
        routeBasePath: "/slidev",
        pageTitle: "",
        pageTagline: "",
        id: "default",
        theme: undefined,
        addons: [],
        buildTimeout: 120,
        verbose: false,
        maxParallelBuilds: 4,
        autoInstall: false,
        dryRun: false,
        withoutNotes: false,
        exportWithClicks: false,
        devServerBasePort: 8600,
        devServerTimeout: 60000,
        transformFrontmatter: (data, filePath) => { capturedPaths.push(filePath); return data; },
      },
      { siteDir: tmpDir, baseUrl: "/" },
    );

    expect(capturedPaths).toHaveLength(1);
    // Must use forward slashes regardless of OS
    expect(capturedPaths[0]).toBe("getting-started/intro.md");
    expect(capturedPaths[0]).not.toContain("\\");
  });

  it("stores sourcePath with forward slashes in presentation metadata", async () => {
    const { scanPresentations } = await import("../scanner");

    const subDir = path.join(slidevDir, "category");
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, "talk.md"), "---\ntitle: Talk\n---\n\n# Talk");

    const result = await scanPresentations(
      {
        path: "slidev",
        download: false,
        exportFormats: [],
        routeBasePath: "/slidev",
        pageTitle: "",
        pageTagline: "",
        id: "default",
        theme: undefined,
        addons: [],
        buildTimeout: 120,
        verbose: false,
        maxParallelBuilds: 4,
        autoInstall: false,
        dryRun: false,
        withoutNotes: false,
        exportWithClicks: false,
        devServerBasePort: 8600,
        devServerTimeout: 60000,
      },
      { siteDir: tmpDir, baseUrl: "/" },
    );

    const p = result.presentations[0];
    expect(p.sourcePath).toBe("category/talk.md");
    expect(p.sourcePath).not.toContain("\\");
    expect(p.id).toBe("category/talk");
    expect(p.id).not.toContain("\\");
  });
});
