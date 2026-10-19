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
  generateExport,
  generateThumbnail,
  isPlaywrightMissing,
  _resetAssetWarnings,
} from "../../process/assetGenerator";

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

describe("generateThumbnail", () => {
  it("exports the isolated source (never the user's file) with cwd in the isolated dir", async () => {
    vi.mocked(runSlidevBuild).mockImplementation(async ({ args }) => {
      // Slidev v52 writes thumbnail.png/1.png
      const out = args[args.indexOf("--output") + 1];
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, "1.png"), "png");
      return { success: true };
    });

    const ok = await generateThumbnail(presentation(), isolatedSource, options, { siteDir: tmpDir, baseUrl: "/" });

    expect(ok).toBe(true);
    const call = vi.mocked(runSlidevBuild).mock.calls[0][0];
    expect(call.args[1]).toBe(isolatedSource);
    expect(call.cwd).toBe(path.dirname(isolatedSource));
    const thumb = path.join(presentation().outputPath, "thumbnail.png");
    expect(fs.statSync(thumb).isFile()).toBe(true);
  });

  it("skips the export when a thumbnail already exists", async () => {
    const thumb = path.join(presentation().outputPath, "thumbnail.png");
    fs.mkdirSync(path.dirname(thumb), { recursive: true });
    fs.writeFileSync(thumb, "png");
    expect(await generateThumbnail(presentation(), isolatedSource, options, { siteDir: tmpDir, baseUrl: "/" })).toBe(true);
    expect(runSlidevBuild).not.toHaveBeenCalled();
  });

  it("returns false and warns once when Playwright is missing", async () => {
    vi.mocked(runSlidevBuild).mockResolvedValue(PLAYWRIGHT_ERROR);
    const ctx = { siteDir: tmpDir, baseUrl: "/" };

    expect(await generateThumbnail(presentation(), isolatedSource, options, ctx)).toBe(false);
    expect(await generateThumbnail(presentation(), isolatedSource, options, ctx)).toBe(false);

    const warnings = vi.mocked(log.warn).mock.calls.filter(([m]) => String(m).includes("Playwright is not installed"));
    expect(warnings).toHaveLength(1);
    // No empty thumbnail.png/ directory left behind
    expect(fs.existsSync(path.join(presentation().outputPath, "thumbnail.png"))).toBe(false);
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

describe("post-processors", () => {
  it("skip (false) without spawning when no isolated source is provided", async () => {
    const ctx = { siteDir: tmpDir, baseUrl: "/" };
    expect(await new ThumbnailGenerator().process(presentation(), options, ctx)).toBe(false);
    expect(await new ExportGenerator().process(presentation(), options, ctx)).toBe(false);
    expect(runSlidevBuild).not.toHaveBeenCalled();
  });

  it("ExportGenerator exports every configured format from the isolated source", async () => {
    vi.mocked(runSlidevBuild).mockImplementation(async ({ args }) => {
      const out = args[args.indexOf("--output") + 1];
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, "data");
      return { success: true };
    });
    const ok = await new ExportGenerator().process(
      presentation(),
      { ...options, exportFormats: ["pdf", "pptx"] },
      { siteDir: tmpDir, baseUrl: "/" },
      { sourcePath: isolatedSource, isolatedDir: path.dirname(isolatedSource) },
    );
    expect(ok).toBe(true);
    expect(vi.mocked(runSlidevBuild).mock.calls.map((c) => c[0].args[1])).toEqual([isolatedSource, isolatedSource]);
  });
});

describe("isPlaywrightMissing", () => {
  it("only matches failed exports mentioning Playwright", () => {
    expect(isPlaywrightMissing(PLAYWRIGHT_ERROR)).toBe(true);
    expect(isPlaywrightMissing({ success: false, failureKind: "timeout", error: "playwright" })).toBe(false);
    expect(isPlaywrightMissing({ success: true })).toBe(false);
  });
});
