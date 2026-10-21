import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { LoadContext } from "@docusaurus/types";
import type {
  BuildResult,
  PresentationMetadata,
  ScanResult,
} from "../../domain/types";

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

vi.mock("../../application/scanner", () => ({ scanPresentations: vi.fn() }));

vi.mock("../../application/builder", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../application/builder")>();
  return {
    ...actual,
    buildAllPresentations: vi.fn(),
    checkSlidevInstalled: vi.fn(() => true),
  };
});

import { scanPresentations } from "../../application/scanner";
import {
  buildAllPresentations,
  getBackgroundBuildQueue,
  PresentationBuildError,
} from "../../application/builder";
import { getSlidevCacheDir } from "../../infrastructure/fs/fileSystem";
import { getBuildStatusDir } from "../../infrastructure/fs/buildStatus";
import pluginSlidev, { validateOptions } from "../plugin";

let tmpDir: string;
const originalEnv = process.env.NODE_ENV;

function presentation(id: string): PresentationMetadata {
  return {
    id,
    title: id,
    sourcePath: `${id}.md`,
    sourceAbsolutePath: path.join(tmpDir, "slidev", `${id}.md`),
    url: `/slidev/${id}/`,
    outputPath: path.join(getSlidevCacheDir(tmpDir, "default"), "output", id),
    previewUrl: `/slidev/${id}/`,
    category: "",
  };
}

function createPlugin() {
  const context = { siteDir: tmpDir, baseUrl: "/" } as LoadContext;
  return pluginSlidev(
    context,
    validateOptions({ options: {}, validate: () => ({}) }),
  );
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-"));
  const scan: ScanResult = {
    presentations: [presentation("a")],
    categories: [],
    playlists: [],
  };
  vi.mocked(scanPresentations).mockResolvedValue(scan);
  vi.mocked(buildAllPresentations).mockReset();
});

afterEach(async () => {
  process.env.NODE_ENV = originalEnv;
  await getBackgroundBuildQueue(
    getSlidevCacheDir(tmpDir, "default"),
  ).whenIdle();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadContent — docusaurus start", () => {
  it("returns before the Slidev builds finish and publishes the build status URL", async () => {
    process.env.NODE_ENV = "development";
    let finish!: (results: BuildResult[]) => void;
    vi.mocked(buildAllPresentations).mockImplementation(
      () => new Promise<BuildResult[]>((resolve) => (finish = resolve)),
    );

    const content = await createPlugin().loadContent!();

    expect(content.buildStatusUrl).toBe(
      "/slidev/__slidesaurus__/build-status.json",
    );
    expect(content).not.toHaveProperty("isDev");
    expect(buildAllPresentations).toHaveBeenCalledTimes(1);
    // The status listener is handed to the builder.
    expect(vi.mocked(buildAllPresentations).mock.calls[0][5]).toBeDefined();
    const status = JSON.parse(
      fs.readFileSync(
        path.join(getBuildStatusDir(tmpDir, "default"), "build-status.json"),
        "utf-8",
      ),
    );
    expect(status.presentations.a).toEqual({
      state: "pending",
      hasOutput: false,
    });

    finish([{ id: "a", success: false, error: "boom" }]); // a dev failure is never thrown
  });

  it("never runs two builds of the same cache at once", async () => {
    process.env.NODE_ENV = "development";
    let finish!: (results: BuildResult[]) => void;
    vi.mocked(buildAllPresentations).mockImplementation(
      () => new Promise<BuildResult[]>((resolve) => (finish = resolve)),
    );
    const plugin = createPlugin();
    await plugin.loadContent!();
    await plugin.loadContent!(); // file saved while building
    expect(buildAllPresentations).toHaveBeenCalledTimes(1);

    finish([{ id: "a", success: true }]);
    await vi.waitFor(() =>
      expect(buildAllPresentations).toHaveBeenCalledTimes(2),
    );
    finish([{ id: "a", success: true }]);
  });
});

describe("loadContent — docusaurus build", () => {
  it("waits for the builds and fails on a broken presentation", async () => {
    process.env.NODE_ENV = "production";
    vi.mocked(buildAllPresentations).mockResolvedValue([
      { id: "a", success: false, error: "boom" },
    ]);
    await expect(createPlugin().loadContent!()).rejects.toBeInstanceOf(
      PresentationBuildError,
    );
  });

  it("publishes no build status URL", async () => {
    process.env.NODE_ENV = "production";
    vi.mocked(buildAllPresentations).mockResolvedValue([
      { id: "a", success: true },
    ]);
    const content = await createPlugin().loadContent!();
    expect(content.buildStatusUrl).toBeUndefined();
    expect(fs.existsSync(getBuildStatusDir(tmpDir, "default"))).toBe(false);
  });
});
