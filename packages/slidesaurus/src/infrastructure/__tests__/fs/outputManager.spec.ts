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

import {
  isCompleteBuildOutput,
  purgeStaleOutputs,
} from "../../fs/outputManager";

let outputRoot: string;

beforeEach(() => {
  outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "output-test-"));
});

afterEach(() => {
  fs.rmSync(outputRoot, { recursive: true, force: true });
});

function build(id: string, html = "<html/>"): void {
  const dir = path.join(outputRoot, ...id.split("/"));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}

describe("isCompleteBuildOutput", () => {
  it("requires a non-empty index.html", () => {
    build("ok");
    build("empty", "");
    expect(isCompleteBuildOutput(path.join(outputRoot, "ok"))).toBe(true);
    expect(isCompleteBuildOutput(path.join(outputRoot, "empty"))).toBe(false);
    expect(isCompleteBuildOutput(path.join(outputRoot, "missing"))).toBe(false);
  });
});

describe("purgeStaleOutputs", () => {
  it("removes outputs of presentations that no longer exist", () => {
    build("kept");
    build("deleted");
    build("cat/kept");
    build("cat/renamed");
    build("old-category/talk");

    const removed = purgeStaleOutputs(outputRoot, ["kept", "cat/kept"]);

    expect(removed.sort()).toEqual(["cat/renamed", "deleted", "old-category"]);
    expect(fs.existsSync(path.join(outputRoot, "kept", "index.html"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(outputRoot, "cat", "kept", "index.html")),
    ).toBe(true);
  });

  it("removes partial builds (no or empty index.html) of current presentations", () => {
    build("partial", "");
    fs.mkdirSync(path.join(outputRoot, "crashed", "assets"), {
      recursive: true,
    });

    purgeStaleOutputs(outputRoot, ["partial", "crashed"]);
    expect(fs.existsSync(path.join(outputRoot, "partial"))).toBe(false);
    expect(fs.existsSync(path.join(outputRoot, "crashed"))).toBe(false);
  });

  it("keeps the content of a presentation directory (assets, thumbnail…)", () => {
    build("talk");
    fs.mkdirSync(path.join(outputRoot, "talk", "assets"));
    fs.writeFileSync(path.join(outputRoot, "talk", "thumbnail.png"), "png");
    purgeStaleOutputs(outputRoot, ["talk"]);
    expect(fs.existsSync(path.join(outputRoot, "talk", "assets"))).toBe(true);
    expect(fs.existsSync(path.join(outputRoot, "talk", "thumbnail.png"))).toBe(
      true,
    );
  });

  it("removes stray files at category level", () => {
    build("cat/talk");
    fs.writeFileSync(path.join(outputRoot, "cat", "stray.txt"), "x");
    purgeStaleOutputs(outputRoot, ["cat/talk"]);
    expect(fs.existsSync(path.join(outputRoot, "cat", "stray.txt"))).toBe(
      false,
    );
  });

  it("is a no-op when the output root does not exist", () => {
    expect(purgeStaleOutputs(path.join(outputRoot, "nope"), ["a"])).toEqual([]);
  });
});
