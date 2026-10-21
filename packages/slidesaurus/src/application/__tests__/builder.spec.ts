import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PresentationMetadata, PluginOptions, BuildContext, BuildResult } from "../../domain/types";
import type { IAssetPostProcessor } from "../../domain/interfaces";

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

/** Fake `slidev build`: writes `{--out}/index.html` like the real CLI. */
async function fakeBuild(opts: { args: string[] }): Promise<{ success: boolean; error?: string }> {
  const out = opts.args[opts.args.indexOf("--out") + 1];
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "index.html"), "<html>built</html>");
  return { success: true };
}

vi.mock("../../infrastructure/process/buildRunner", () => ({
  runSlidevBuild: vi.fn(),
  resolveSlidevCli: vi.fn(() => ({ entry: "/fake/slidev.mjs", version: "52.0.0" })),
}));

vi.mock("../../infrastructure/packages/packageResolver", () => ({
  ensureThemeAvailable: vi.fn().mockResolvedValue("@slidev/theme-seriph"),
  ensureAddonsAvailable: vi.fn().mockResolvedValue([]),
  resolveThemePackageName: (t: string) => t,
  resolveAddonPackageName: (a: string) => a,
  getInstalledPackageVersion: () => "1.0.0",
}));

import { runSlidevBuild } from "../../infrastructure/process/buildRunner";
import { ensureThemeAvailable } from "../../infrastructure/packages/packageResolver";
import { getSlidevCacheDir } from "../../infrastructure/fs/fileSystem";
import { loadHashManifest } from "../../infrastructure/fs/hashManifest";
import {
  assertBuildSucceeded,
  BackgroundBuildQueue,
  buildAllPresentations,
  getBackgroundBuildQueue,
  checkSlidevInstalled,
  collectBuildFailures,
  PresentationBuildError,
} from "../builder";

let tmpDir: string;

function cacheDir(): string {
  return getSlidevCacheDir(tmpDir, "default");
}

function makePresentation(id: string, overrides: Partial<PresentationMetadata> = {}): PresentationMetadata {
  const mdFile = path.join(tmpDir, "slidev", `${id}.md`);
  fs.mkdirSync(path.dirname(mdFile), { recursive: true });
  if (!fs.existsSync(mdFile)) fs.writeFileSync(mdFile, `---\ntitle: ${id}\n---\n\n# ${id}`);
  return {
    id,
    title: id,
    sourcePath: `${id}.md`,
    sourceAbsolutePath: mdFile,
    url: `/slidev/${id}/`,
    outputPath: path.join(cacheDir(), "output", id),
    previewUrl: `/slidev/${id}/`,
    category: "",
    ...overrides,
  };
}

function makeOptions(overrides: Partial<PluginOptions> = {}): PluginOptions {
  return {
    path: "./slidev",
    download: false,
    exportFormats: ["pdf"],
    routeBasePath: "/slidev",
    pageTitle: "Presentations",
    pageTagline: "Overview",
    id: "default",
    theme: "seriph",
    addons: [],
    buildTimeout: 120,
    verbose: false,
    maxParallelBuilds: 2,
    autoInstall: false,
    dryRun: false,
    withoutNotes: false,
    exportWithClicks: false,
    devServerBasePort: 8600,
    devServerTimeout: 60000,
    uiTheme: "default",
    ...overrides,
  };
}

function makeContext(): BuildContext {
  return { siteDir: tmpDir, baseUrl: "/" };
}

const NO_ASSETS: IAssetPostProcessor[] = [];

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "builder-all-"));
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.mocked(runSlidevBuild).mockReset();
  vi.mocked(runSlidevBuild).mockImplementation(fakeBuild);
  vi.mocked(ensureThemeAvailable).mockReset();
  vi.mocked(ensureThemeAvailable).mockResolvedValue("@slidev/theme-seriph");
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("checkSlidevInstalled", () => {
  it("returns true when @slidev/cli exists in node_modules", () => {
    fs.mkdirSync(path.join(tmpDir, "node_modules", "@slidev", "cli"), { recursive: true });
    expect(checkSlidevInstalled(tmpDir)).toBe(true);
  });

  it("returns false when @slidev/cli is not installed", () => {
    expect(checkSlidevInstalled(tmpDir)).toBe(false);
  });

  it("finds @slidev/cli in parent directory (monorepo)", () => {
    fs.mkdirSync(path.join(tmpDir, "node_modules", "@slidev", "cli"), { recursive: true });
    const childDir = path.join(tmpDir, "apps", "docs");
    fs.mkdirSync(childDir, { recursive: true });
    expect(checkSlidevInstalled(childDir)).toBe(true);
  });
});

describe("buildAllPresentations", () => {
  it("returns no result when there is nothing to build", async () => {
    const results = await buildAllPresentations([], makeOptions(), makeContext(), undefined, NO_ASSETS);
    expect(results).toHaveLength(0);
  });

  it("builds into the output path and skips unchanged presentations next time", async () => {
    const p = makePresentation("intro");
    const first = await buildAllPresentations([p], makeOptions(), makeContext(), undefined, NO_ASSETS);
    expect(first[0]).toMatchObject({ id: "intro", success: true });
    expect(fs.readFileSync(path.join(p.outputPath, "index.html"), "utf-8")).toContain("built");

    vi.mocked(runSlidevBuild).mockClear();
    const second = await buildAllPresentations([p], makeOptions(), makeContext(), undefined, NO_ASSETS);
    expect(second[0]).toMatchObject({ success: true, cacheHit: true });
    expect(runSlidevBuild).not.toHaveBeenCalled();
  });

  it("rebuilds when options change", async () => {
    const p = makePresentation("talk");
    await buildAllPresentations([p], makeOptions({ theme: "seriph" }), makeContext(), undefined, NO_ASSETS);
    vi.mocked(runSlidevBuild).mockClear();
    await buildAllPresentations([p], makeOptions({ theme: "apple-basic" }), makeContext(), undefined, NO_ASSETS);
    expect(runSlidevBuild).toHaveBeenCalled();
  });

  it("rebuilds when an imported section changes (not only the entry .md)", async () => {
    const p = makePresentation("main");
    fs.writeFileSync(p.sourceAbsolutePath, "---\ntitle: main\n---\n\n---\nsrc: ./pages/part.md\n---\n");
    const part = path.join(tmpDir, "slidev", "pages", "part.md");
    fs.mkdirSync(path.dirname(part), { recursive: true });
    fs.writeFileSync(part, "# v1");
    await buildAllPresentations([p], makeOptions(), makeContext(), undefined, NO_ASSETS);

    vi.mocked(runSlidevBuild).mockClear();
    fs.writeFileSync(part, "# v2");
    await buildAllPresentations([p], makeOptions(), makeContext(), undefined, NO_ASSETS);
    expect(runSlidevBuild).toHaveBeenCalledTimes(1);
  });

  it("passes the isolated source, a temporary --out and the URL as --base", async () => {
    const p = makePresentation("intro", { url: "/docs/slidev/intro/" });
    await buildAllPresentations([p], makeOptions(), makeContext(), undefined, NO_ASSETS);
    const { args, extraEnv } = vi.mocked(runSlidevBuild).mock.calls[0][0];
    expect(args[0]).toBe("build");
    expect(args[1].startsWith(path.join(cacheDir(), "builds"))).toBe(true);
    expect(args[args.indexOf("--out") + 1]).not.toBe(p.outputPath);
    expect(args[args.indexOf("--base") + 1]).toBe("/docs/slidev/intro/");
    expect(extraEnv).toEqual({ SLIDEV_SITE_DIR: tmpDir });
  });


  it("isolates a failing preparation: other presentations still build and dirs are cleaned", async () => {
    vi.mocked(ensureThemeAvailable).mockImplementation(async (theme: string) => {
      if (theme === "missing-theme") throw new Error("Theme 'missing-theme' not found");
      return "@slidev/theme-seriph";
    });
    const bad = makePresentation("bad", { theme: "missing-theme" });
    const good = makePresentation("good");

    const results = await buildAllPresentations([bad, good], makeOptions(), makeContext(), undefined, NO_ASSETS);

    expect(results.find((r) => r.id === "bad")).toMatchObject({ success: false, error: expect.stringContaining("missing-theme") });
    expect(results.find((r) => r.id === "good")).toMatchObject({ success: true });
    const builds = path.join(cacheDir(), "builds");
    expect(fs.existsSync(builds) ? fs.readdirSync(builds) : []).toEqual([]);
    // A failed presentation is retried next time
    expect(loadHashManifest(cacheDir())).not.toHaveProperty("bad");
  });

  it("keeps the previous output when a rebuild fails", async () => {
    const p = makePresentation("talk");
    await buildAllPresentations([p], makeOptions(), makeContext(), undefined, NO_ASSETS);

    fs.appendFileSync(p.sourceAbsolutePath, "\n# changed");
    vi.mocked(runSlidevBuild).mockResolvedValue({ success: false, error: "Slidev exited with code 1" });
    const results = await buildAllPresentations([p], makeOptions(), makeContext(), undefined, NO_ASSETS);

    expect(results[0].success).toBe(false);
    expect(fs.readFileSync(path.join(p.outputPath, "index.html"), "utf-8")).toContain("built");
  });

  it("treats a 'successful' build without index.html as a failure", async () => {
    vi.mocked(runSlidevBuild).mockResolvedValue({ success: true });
    const results = await buildAllPresentations([makePresentation("x")], makeOptions(), makeContext(), undefined, NO_ASSETS);
    expect(results[0]).toMatchObject({ success: false, error: expect.stringContaining("index.html") });
  });

  it("asset failures are warnings: the build succeeds and stays cached", async () => {
    const failing: IAssetPostProcessor = { name: "Export", process: vi.fn().mockResolvedValue(false) };
    const throwing: IAssetPostProcessor = { name: "Thumb", process: vi.fn().mockRejectedValue(new Error("no playwright")) };
    const p = makePresentation("talk");

    const results = await buildAllPresentations([p], makeOptions(), makeContext(), undefined, [failing, throwing]);
    expect(results[0].success).toBe(true);
    expect(results[0].warnings).toHaveLength(2);
    expect(loadHashManifest(cacheDir())).toHaveProperty("talk");

    vi.mocked(runSlidevBuild).mockClear();
    await buildAllPresentations([p], makeOptions(), makeContext(), undefined, [failing]);
    expect(runSlidevBuild).not.toHaveBeenCalled();
  });

  it("gives asset processors the isolated source, not the user's file", async () => {
    const processor: IAssetPostProcessor = { name: "Spy", process: vi.fn().mockResolvedValue(true) };
    const p = makePresentation("talk");
    await buildAllPresentations([p], makeOptions(), makeContext(), undefined, [processor]);
    const assets = vi.mocked(processor.process).mock.calls[0][3];
    expect(assets?.sourcePath).not.toBe(p.sourceAbsolutePath);
    expect(assets?.sourcePath.startsWith(path.join(cacheDir(), "builds"))).toBe(true);
  });

  it("prepares processors once before the builds and disposes them after (even when a hook throws)", async () => {
    const order: string[] = [];
    const processor: IAssetPostProcessor = {
      name: "Shared",
      prepare: vi.fn(async () => {
        order.push("prepare");
      }),
      process: vi.fn(async (p: PresentationMetadata) => {
        order.push(`process:${p.id}`);
        return true;
      }),
      dispose: vi.fn(async () => {
        order.push("dispose");
        throw new Error("close failed");
      }),
    };
    const results = await buildAllPresentations(
      [makePresentation("a"), makePresentation("b")],
      makeOptions({ maxParallelBuilds: 2 }),
      makeContext(),
      undefined,
      [processor],
    );
    expect(results.every((r) => r.success)).toBe(true);
    expect(order[0]).toBe("prepare");
    expect(order.at(-1)).toBe("dispose");
    expect(processor.prepare).toHaveBeenCalledTimes(1);
    expect(processor.dispose).toHaveBeenCalledTimes(1);
  });

  it("does not prepare processors when every presentation is cached", async () => {
    const p = makePresentation("talk");
    await buildAllPresentations([p], makeOptions(), makeContext(), undefined, NO_ASSETS);
    const prepare = vi.fn(async () => undefined);
    await buildAllPresentations([p], makeOptions(), makeContext(), undefined, [{ name: "P", prepare, process: vi.fn() }]);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("refuses an outputPath outside the plugin cache", async () => {
    const outside = path.join(tmpDir, "precious");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "keep.txt"), "x");
    const p = makePresentation("talk", { outputPath: outside });

    const results = await buildAllPresentations([p], makeOptions(), makeContext(), undefined, NO_ASSETS);
    expect(results[0]).toMatchObject({ success: false, error: expect.stringContaining("[Security]") });
    expect(fs.existsSync(path.join(outside, "keep.txt"))).toBe(true);
  });

  it("purges outputs of deleted presentations", async () => {
    const a = makePresentation("a");
    const b = makePresentation("b");
    await buildAllPresentations([a, b], makeOptions(), makeContext(), undefined, NO_ASSETS);
    expect(fs.existsSync(b.outputPath)).toBe(true);

    await buildAllPresentations([a], makeOptions(), makeContext(), undefined, NO_ASSETS);
    expect(fs.existsSync(b.outputPath)).toBe(false);
    expect(fs.existsSync(a.outputPath)).toBe(true);
  });

  it("uses a per-locale cache directory", async () => {
    const frCache = getSlidevCacheDir(tmpDir, "default", "fr");
    const p = makePresentation("talk", { outputPath: path.join(frCache, "output", "talk") });
    const results = await buildAllPresentations(
      [p], makeOptions(), { siteDir: tmpDir, baseUrl: "/fr/", locale: "fr" }, undefined, NO_ASSETS,
    );
    expect(results[0].success).toBe(true);
    expect(fs.existsSync(path.join(frCache, "build-hashes.json"))).toBe(true);
    expect(fs.existsSync(path.join(cacheDir(), "build-hashes.json"))).toBe(false);
  });

  it("calls onBuildComplete with all results, swallowing its errors", async () => {
    const onBuildComplete = vi.fn().mockRejectedValue(new Error("hook"));
    const results = await buildAllPresentations(
      [makePresentation("a")], makeOptions({ onBuildComplete }), makeContext(), undefined, NO_ASSETS,
    );
    expect(onBuildComplete).toHaveBeenCalledWith(results);
  });
});

describe("buildAllPresentations — progress listener", () => {
  it("reports start, output ready and result for built presentations, result only for cache hits", async () => {
    const events: string[] = [];
    const listener = {
      onBuildStart: (id: string) => events.push(`start:${id}`),
      onOutputReady: (id: string) => {
        // The new output is already in place when the listener is told.
        expect(fs.existsSync(path.join(cacheDir(), "output", id, "index.html"))).toBe(true);
        events.push(`ready:${id}`);
      },
      onResult: (r: BuildResult) => events.push(`result:${r.id}:${r.success}${r.cacheHit ? ":cached" : ""}`),
    };
    const a = makePresentation("a");
    await buildAllPresentations([a], makeOptions({ maxParallelBuilds: 1 }), makeContext(), undefined, NO_ASSETS, listener);
    expect(events).toEqual(["start:a", "ready:a", "result:a:true"]);

    events.length = 0;
    await buildAllPresentations([a], makeOptions({ maxParallelBuilds: 1 }), makeContext(), undefined, NO_ASSETS, listener);
    expect(events).toEqual(["result:a:true:cached"]);
  });

  it("reports failures and survives a throwing listener", async () => {
    vi.mocked(runSlidevBuild).mockResolvedValue({ success: false, error: "boom", failureKind: "exit" });
    const results: BuildResult[] = [];
    const listener = {
      onBuildStart: () => {
        throw new Error("listener bug");
      },
      onResult: (r: BuildResult) => results.push(r),
    };
    const out = await buildAllPresentations([makePresentation("x")], makeOptions(), makeContext(), undefined, NO_ASSETS, listener);
    expect(out[0].success).toBe(false);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: "x", success: false });
  });
});

describe("BackgroundBuildQueue", () => {
  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    return { promise, resolve };
  }

  it("never overlaps runs and only keeps the latest queued request", async () => {
    const queue = new BackgroundBuildQueue();
    const calls: string[] = [];
    const first = deferred();
    queue.schedule(async () => {
      calls.push("1");
      await first.promise;
    });
    queue.schedule(async () => calls.push("2 (superseded)"));
    queue.schedule(async () => calls.push("3"));
    await Promise.resolve();
    expect(calls).toEqual(["1"]);
    first.resolve();
    await queue.whenIdle();
    expect(calls).toEqual(["1", "3"]);
  });

  it("logs a throwing run and keeps draining", async () => {
    const queue = new BackgroundBuildQueue();
    const ran = vi.fn();
    queue.schedule(async () => {
      throw new Error("boom");
    });
    queue.schedule(async () => ran());
    await queue.whenIdle();
    expect(ran).toHaveBeenCalledTimes(1);
    queue.schedule(async () => ran());
    await queue.whenIdle();
    expect(ran).toHaveBeenCalledTimes(2);
  });

  it("is shared per cache directory", () => {
    expect(getBackgroundBuildQueue(path.join(tmpDir, "c"))).toBe(getBackgroundBuildQueue(path.join(tmpDir, "c", ".")));
    expect(getBackgroundBuildQueue(path.join(tmpDir, "c"))).not.toBe(getBackgroundBuildQueue(path.join(tmpDir, "d")));
  });
});

describe("assertBuildSucceeded", () => {
  const ok: BuildResult = { id: "ok", success: true, warnings: ["Thumb: asset not generated"] };
  const ko: BuildResult = { id: "ko", success: false, error: "Slidev exited with code 1\nstack" };

  it("does nothing when every presentation built (warnings are not failures)", () => {
    expect(() => assertBuildSucceeded([ok])).not.toThrow();
    expect(collectBuildFailures([ok])).toEqual([]);
  });

  it("throws an aggregated PresentationBuildError listing every failure", () => {
    let error: unknown;
    try {
      assertBuildSucceeded([ok, ko, { id: "ko2", success: false }]);
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(PresentationBuildError);
    const e = error as PresentationBuildError;
    expect(e.failures.map((f) => f.id)).toEqual(["ko", "ko2"]);
    expect(e.message).toContain("2 Slidev presentation(s) failed");
    expect(e.message).toContain("ko: Slidev exited with code 1");
  });
});

