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

import { log } from "../../../shared/logger";
import { loadHashManifest, saveHashManifest } from "../../fs/hashManifest";

const MANIFEST_FILE = "build-hashes.json";
const CURRENT_VERSION = 2;

describe("hashManifest", () => {
  let tmpDir: string;
  let cacheDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hash-manifest-test-"));
    cacheDir = path.join(tmpDir, "cache");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("loadHashManifest", () => {
    it("returns an empty map when the manifest is absent", () => {
      expect(loadHashManifest(cacheDir)).toEqual({});
    });

    it("does not log anything when the manifest is absent", () => {
      loadHashManifest(cacheDir);
      expect(log.warn).not.toHaveBeenCalled();
      expect(log.info).not.toHaveBeenCalled();
    });

    it("returns {} and warns when the JSON is corrupted", () => {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(path.join(cacheDir, MANIFEST_FILE), "{ not valid json");

      expect(loadHashManifest(cacheDir)).toEqual({});
      expect(log.warn).toHaveBeenCalledTimes(1);
    });

    it("returns {} and logs a version mismatch when the version differs", () => {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, MANIFEST_FILE),
        JSON.stringify({ version: CURRENT_VERSION - 1, hashes: { deck: "abc" } }),
      );

      expect(loadHashManifest(cacheDir)).toEqual({});
      expect(log.info).toHaveBeenCalledTimes(1);
      expect(log.warn).not.toHaveBeenCalled();
    });

    it("returns {} when the version field is missing", () => {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, MANIFEST_FILE),
        JSON.stringify({ hashes: { deck: "abc" } }),
      );

      expect(loadHashManifest(cacheDir)).toEqual({});
    });

    it.each([["null"], ["42"], ['"text"']])(
      "returns {} for a non-object JSON payload (%s)",
      (payload) => {
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(path.join(cacheDir, MANIFEST_FILE), payload);

        expect(loadHashManifest(cacheDir)).toEqual({});
      },
    );

    it("returns {} when the current version has no hashes field", () => {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, MANIFEST_FILE),
        JSON.stringify({ version: CURRENT_VERSION }),
      );

      expect(loadHashManifest(cacheDir)).toEqual({});
    });
  });

  describe("saveHashManifest", () => {
    it("creates the cache directory when it does not exist", () => {
      expect(fs.existsSync(cacheDir)).toBe(false);

      saveHashManifest(cacheDir, { deck: "abc" });

      expect(fs.existsSync(path.join(cacheDir, MANIFEST_FILE))).toBe(true);
    });

    it("writes the versioned format with a hashes map", () => {
      saveHashManifest(cacheDir, { deck: "abc" });

      const written = JSON.parse(
        fs.readFileSync(path.join(cacheDir, MANIFEST_FILE), "utf-8"),
      );
      expect(written).toEqual({
        version: CURRENT_VERSION,
        hashes: { deck: "abc" },
      });
    });

    it("round-trips through loadHashManifest", () => {
      const manifest = { "intro": "hash-1", "advanced/deep": "hash-2" };

      saveHashManifest(cacheDir, manifest);

      expect(loadHashManifest(cacheDir)).toEqual(manifest);
    });

    it("round-trips an empty manifest", () => {
      saveHashManifest(cacheDir, {});

      expect(loadHashManifest(cacheDir)).toEqual({});
    });

    it("overwrites the previous manifest on update", () => {
      saveHashManifest(cacheDir, { deck: "old-hash" });

      saveHashManifest(cacheDir, { deck: "new-hash", other: "hash-2" });

      expect(loadHashManifest(cacheDir)).toEqual({
        deck: "new-hash",
        other: "hash-2",
      });
    });

    it("drops entries that are absent from the saved map", () => {
      saveHashManifest(cacheDir, { keep: "h1", removed: "h2" });

      saveHashManifest(cacheDir, { keep: "h1" });

      expect(loadHashManifest(cacheDir)).toEqual({ keep: "h1" });
      expect(loadHashManifest(cacheDir)).not.toHaveProperty("removed");
    });

    it("replaces a corrupted manifest with a valid one", () => {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(path.join(cacheDir, MANIFEST_FILE), "garbage");

      saveHashManifest(cacheDir, { deck: "abc" });

      expect(loadHashManifest(cacheDir)).toEqual({ deck: "abc" });
    });
  });
});
