import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BuildStatusFile, PresentationMetadata } from "../../../domain/types";
import {
  BUILD_STATUS_FILE_NAME,
  BuildStatusTracker,
  getBuildStatusDir,
  getBuildStatusUrl,
} from "../../fs/buildStatus";

let tmpDir: string;
let statusDir: string;

function presentation(id: string): PresentationMetadata {
  return {
    id,
    title: id,
    sourcePath: `${id}.md`,
    sourceAbsolutePath: path.join(tmpDir, "slidev", `${id}.md`),
    url: `/slidev/${id}/`,
    outputPath: path.join(tmpDir, "output", id),
    previewUrl: `/slidev/${id}/`,
    category: "",
  };
}

function writeOutput(id: string): void {
  const dir = presentation(id).outputPath;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), "<html></html>");
}

function readStatus(): BuildStatusFile {
  return JSON.parse(fs.readFileSync(path.join(statusDir, BUILD_STATUS_FILE_NAME), "utf-8")) as BuildStatusFile;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "status-"));
  statusDir = path.join(tmpDir, "status");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("getBuildStatusDir / getBuildStatusUrl", () => {
  it("lives next to output/ in the plugin cache (never published)", () => {
    expect(getBuildStatusDir("/site", "default")).toBe(path.join("/site", ".docusaurus", "slidesaurus", "default", "status"));
    expect(getBuildStatusDir("/site", "default", "fr")).toBe(
      path.join("/site", ".docusaurus", "slidesaurus", "default", "i18n", "fr", "status"),
    );
  });

  it("is served below the presentations route", () => {
    expect(getBuildStatusUrl("/docs/slidev")).toBe("/docs/slidev/__slidesaurus__/build-status.json");
    expect(getBuildStatusUrl("")).toBe("/__slidesaurus__/build-status.json");
  });
});

describe("BuildStatusTracker", () => {
  it("starts every presentation as pending, keeping a previous output servable", () => {
    writeOutput("old");
    const tracker = new BuildStatusTracker(statusDir);
    tracker.reset([presentation("old"), presentation("new")]);

    const { presentations } = readStatus();
    expect(presentations.old).toMatchObject({ state: "pending", hasOutput: true });
    expect(typeof presentations.old.builtAt).toBe("number");
    expect(presentations.new).toEqual({ state: "pending", hasOutput: false });
  });

  it("follows a build: building → ready with a new builtAt", () => {
    const tracker = new BuildStatusTracker(statusDir);
    tracker.reset([presentation("a")]);
    tracker.onBuildStart("a");
    expect(readStatus().presentations.a.state).toBe("building");

    writeOutput("a");
    tracker.onOutputReady("a");
    expect(readStatus().presentations.a).toMatchObject({ state: "ready", hasOutput: true });
    expect(readStatus().presentations.a.builtAt).toBeGreaterThan(0);
  });

  it("records the first line of a failure, and clears it once rebuilt", () => {
    const tracker = new BuildStatusTracker(statusDir);
    tracker.reset([presentation("a")]);
    tracker.onResult({ id: "a", success: false, error: "Slidev exited with code 1\nstack" });
    expect(readStatus().presentations.a).toEqual({ state: "failed", hasOutput: false, error: "Slidev exited with code 1" });

    writeOutput("a");
    tracker.onResult({ id: "a", success: true });
    expect(readStatus().presentations.a.state).toBe("ready");
    expect(readStatus().presentations.a).not.toHaveProperty("error");
  });

  it("marks everything failed when reset with an error", () => {
    const tracker = new BuildStatusTracker(statusDir);
    tracker.reset([presentation("a")], "Slidev CLI not installed");
    expect(readStatus().presentations.a).toEqual({ state: "failed", hasOutput: false, error: "Slidev CLI not installed" });
  });

  it("drops removed presentations and ignores late events for them", () => {
    const tracker = new BuildStatusTracker(statusDir);
    tracker.reset([presentation("a"), presentation("b")]);
    tracker.reset([presentation("b")]);
    tracker.onBuildStart("a");
    expect(Object.keys(readStatus().presentations)).toEqual(["b"]);
    expect(tracker.get("a")).toBeUndefined();
  });

  it("leaves no temporary file behind", () => {
    const tracker = new BuildStatusTracker(statusDir);
    tracker.reset([presentation("a")]);
    tracker.onBuildStart("a");
    expect(fs.readdirSync(statusDir)).toEqual([BUILD_STATUS_FILE_NAME]);
  });
});
