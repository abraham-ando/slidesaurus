import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BuildOptions, PresentationMetadata } from "../../../domain/types";

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

vi.mock("../../process/buildRunner", () => ({
  runSlidevBuild: vi.fn(),
}));

import { log } from "../../../shared/logger";
import { runSlidevBuild } from "../../process/buildRunner";
import {
  ExportGenerator,
  ThumbnailGenerator,
  createDefaultPostProcessors,
  generateExport,
  isPlaywrightMissing,
  _resetAssetWarnings,
} from "../../process/assetGenerator";
import type { PlaywrightBrowser, PlaywrightChromium } from "../../process/playwright";

let tmpDir: string;
let isolatedSource: string;

const options: BuildOptions = {
  buildTimeout: 120,
  verbose: false,
  maxParallelBuilds: 1,
  autoInstall: false,
  download: true,
  exportFormats: ["pdf"],
  dryRun: false,
  withoutNotes: false,
  exportWithClicks: false,
};

function presentation(): PresentationMetadata {
  return {
    id: "talk",
    title: "Talk",
    sourcePath: "talk.md",
    sourceAbsolutePath: path.join(tmpDir, "slidev", "talk.md"),
    url: "/slidev/talk/",
    outputPath: path.join(tmpDir, "output", "talk"),
    previewUrl: "/slidev/talk/",
    category: "",
  };
}

const PLAYWRIGHT_ERROR = {
  success: false,
  failureKind: "exit" as const,
  error: "Slidev exited with code 1\nThe exporting for Slidev is powered by Playwright, please install it via `npm i -D playwright-chromium`",
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "assets-"));
  isolatedSource = path.join(tmpDir, "builds", "talk", "talk.md");
  fs.mkdirSync(path.dirname(isolatedSource), { recursive: true });
  fs.writeFileSync(isolatedSource, "# x");
  vi.mocked(runSlidevBuild).mockReset();
  vi.mocked(log.warn).mockClear();
  _resetAssetWarnings();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Fake Playwright: `launch` resolves a browser whose render writes a PNG. */
function fakeChromium(launch?: () => Promise<PlaywrightBrowser>): PlaywrightChromium & { launch: ReturnType<typeof vi.fn> } {
  const browser = { newContext: vi.fn(), close: vi.fn().mockResolvedValue(undefined) } as unknown as PlaywrightBrowser;
  return { launch: vi.fn(launch ?? (async () => browser)) };
}

const writePng = vi.fn(async (_b: PlaywrightBrowser, _p: PresentationMetadata, file: string) => {
  fs.writeFileSync(file, "png");
});

describe("ThumbnailGenerator", () => {
  const ctx = () => ({ siteDir: tmpDir, baseUrl: "/" });
  const thumb = () => path.join(presentation().outputPath, "thumbnail.png");

  beforeEach(() => {
    writePng.mockClear();
    fs.mkdirSync(presentation().outputPath, { recursive: true });
  });

  it("renders the built output with ONE shared browser and never spawns slidev", async () => {
    const chromium = fakeChromium();
    const gen = new ThumbnailGenerator({ loadChromium: () => chromium, render: writePng });
    await gen.prepare(options, ctx());

    expect(await gen.process(presentation(), options, ctx())).toBe(true);
    fs.rmSync(thumb());
    expect(await gen.process(presentation(), options, ctx())).toBe(true);
    await gen.dispose();

    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(writePng).toHaveBeenCalledTimes(2);
    expect(fs.statSync(thumb()).isFile()).toBe(true);
    expect(fs.existsSync(`${thumb()}.tmp.png`)).toBe(false);
    expect(runSlidevBuild).not.toHaveBeenCalled();
  });

  it("skips rendering when a thumbnail already exists (or a v52 thumbnail.png/1.png is promoted)", async () => {
    fs.mkdirSync(thumb(), { recursive: true });
    fs.writeFileSync(path.join(thumb(), "1.png"), "png");
    const gen = new ThumbnailGenerator({ loadChromium: () => fakeChromium(), render: writePng });
    expect(await gen.process(presentation(), options, ctx())).toBe(true);
    expect(fs.statSync(thumb()).isFile()).toBe(true);
    expect(writePng).not.toHaveBeenCalled();
  });

  it("skips every thumbnail with a single warning when playwright-chromium is missing", async () => {
    const gen = new ThumbnailGenerator({ loadChromium: () => undefined, render: writePng });
    await gen.prepare(options, ctx());
    expect(await gen.process(presentation(), options, ctx())).toBe(false);
    expect(await gen.process(presentation(), options, ctx())).toBe(false);

    const warnings = vi.mocked(log.warn).mock.calls.map(([m]) => String(m));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("pnpm add -D playwright-chromium");
    expect(writePng).not.toHaveBeenCalled();
    expect(fs.existsSync(thumb())).toBe(false);
  });

  it("skips every thumbnail with a single warning when Chromium cannot be launched", async () => {
    const chromium = fakeChromium(async () => {
      throw new Error("Executable doesn't exist at /ms-playwright/chromium\nmore");
    });
    const gen = new ThumbnailGenerator({ loadChromium: () => chromium, render: writePng });
    await gen.prepare(options, ctx());
    expect(await gen.process(presentation(), options, ctx())).toBe(false);
    expect(await gen.process(presentation(), options, ctx())).toBe(false);

    expect(chromium.launch).toHaveBeenCalledTimes(1);
    const warnings = vi.mocked(log.warn).mock.calls.map(([m]) => String(m));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("playwright install chromium");
  });

  it("a render failure is a non-blocking warning and leaves no partial file", async () => {
    const render = vi.fn(async (_b: PlaywrightBrowser, _p: PresentationMetadata, file: string) => {
      fs.writeFileSync(file, "partial");
      throw new Error("locator.waitFor: Timeout 30000ms exceeded.");
    });
    const gen = new ThumbnailGenerator({ loadChromium: () => fakeChromium(), render });
    expect(await gen.process(presentation(), options, ctx())).toBe(false);
    expect(vi.mocked(log.warn)).toHaveBeenCalledWith(expect.stringContaining("non-blocking"));
    expect(fs.existsSync(thumb())).toBe(false);
    expect(fs.existsSync(`${thumb()}.tmp.png`)).toBe(false);
  });
});

describe("generateExport", () => {
  it("returns true without spawning when download is disabled", async () => {
    const ok = await generateExport(presentation(), isolatedSource, "pdf", { ...options, download: false }, { siteDir: tmpDir, baseUrl: "/" });
    expect(ok).toBe(true);
    expect(runSlidevBuild).not.toHaveBeenCalled();
  });

  it("warns (non-blocking) and returns false on a regular export failure", async () => {
    vi.mocked(runSlidevBuild).mockResolvedValue({ success: false, failureKind: "exit", error: "Slidev exited with code 1\nboom" });
    const ok = await generateExport(presentation(), isolatedSource, "pdf", options, { siteDir: tmpDir, baseUrl: "/" });
    expect(ok).toBe(false);
    expect(vi.mocked(log.warn)).toHaveBeenCalledWith(expect.stringContaining("non-blocking"));
  });

  it("picks up Slidev's default file name when --output is ignored", async () => {
    vi.mocked(runSlidevBuild).mockImplementation(async () => {
      fs.mkdirSync(presentation().outputPath, { recursive: true });
      fs.writeFileSync(path.join(presentation().outputPath, "slidev-exported.pdf"), "%PDF");
      return { success: true };
    });
    const ok = await generateExport(presentation(), isolatedSource, "pdf", options, { siteDir: tmpDir, baseUrl: "/" });
    expect(ok).toBe(true);
    expect(fs.existsSync(path.join(presentation().outputPath, "export.pdf"))).toBe(true);
  });
});

describe("ExportGenerator", () => {
  const ctx = () => ({ siteDir: tmpDir, baseUrl: "/" });
  const assets = () => ({ sourcePath: isolatedSource, isolatedDir: path.dirname(isolatedSource) });

  it("skips (false) without spawning when no isolated source is provided", async () => {
    expect(await new ExportGenerator(() => "/pw").process(presentation(), options, ctx())).toBe(false);
    expect(runSlidevBuild).not.toHaveBeenCalled();
  });

  it("exports every configured format from the isolated source", async () => {
    vi.mocked(runSlidevBuild).mockImplementation(async ({ args }) => {
      const out = args[args.indexOf("--output") + 1];
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, "data");
      return { success: true };
    });
    const ok = await new ExportGenerator(() => "/pw").process(
      presentation(),
      { ...options, exportFormats: ["pdf", "pptx"] },
      ctx(),
      assets(),
    );
    expect(ok).toBe(true);
    expect(vi.mocked(runSlidevBuild).mock.calls.map((c) => c[0].args[1])).toEqual([isolatedSource, isolatedSource]);
  });

  it("skips every export with a single warning when playwright-chromium is missing", async () => {
    const gen = new ExportGenerator(() => undefined);
    await gen.prepare(options, ctx());
    expect(await gen.process(presentation(), options, ctx(), assets())).toBe(false);
    expect(await gen.process(presentation(), options, ctx(), assets())).toBe(false);
    expect(runSlidevBuild).not.toHaveBeenCalled();
    expect(vi.mocked(log.warn)).toHaveBeenCalledTimes(1);
  });

  it("does not check Playwright when downloads are disabled", async () => {
    const resolve = vi.fn(() => undefined);
    const gen = new ExportGenerator(resolve);
    await gen.prepare({ ...options, download: false }, ctx());
    expect(await gen.process(presentation(), { ...options, download: false }, ctx(), assets())).toBe(true);
    expect(resolve).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });
});

describe("createDefaultPostProcessors", () => {
  it("returns a fresh set per call (the thumbnail browser is not shared between runs)", () => {
    const a = createDefaultPostProcessors();
    const b = createDefaultPostProcessors();
    expect(a.map((p) => p.name)).toEqual(["ThumbnailGenerator", "ExportGenerator"]);
    expect(a[0]).not.toBe(b[0]);
  });
});

describe("isPlaywrightMissing", () => {
  it("only matches failed exports mentioning Playwright", () => {
    expect(isPlaywrightMissing(PLAYWRIGHT_ERROR)).toBe(true);
    expect(isPlaywrightMissing({ success: false, failureKind: "timeout", error: "playwright" })).toBe(false);
    expect(isPlaywrightMissing({ success: true })).toBe(false);
  });
});
