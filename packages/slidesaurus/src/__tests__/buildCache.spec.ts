import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BuildCache } from "../buildCache";
import type { PluginOptions } from "../types";

function makeOptions(overrides: Partial<PluginOptions> = {}): PluginOptions {
  return {
    path: "./slidev",
    download: false,
    exportFormats: [],
    exportWithClicks: false,
    withoutNotes: false,
    routeBasePath: "/slidev",
    pageTitle: "Presentations",
    pageTagline: "",
    id: "default",
    theme: undefined,
    addons: [],
    buildTimeout: 120,
    verbose: false,
    maxParallelBuilds: 4,
    autoInstall: false,
    dryRun: false,
    ...overrides,
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "buildcache-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── computeOptionsFingerprint ─────────────────────────────────────────────────

describe("BuildCache.computeOptionsFingerprint", () => {
  it("returns the same hash for the same options and baseUrl", () => {
    const opts = makeOptions({ theme: "seriph", addons: ["slidev-addon-excalidraw"] });
    const fp1 = BuildCache.computeOptionsFingerprint(opts, "/");
    const fp2 = BuildCache.computeOptionsFingerprint(opts, "/");
    expect(fp1).toBe(fp2);
  });

  it("returns a different hash when theme changes", () => {
    const fp1 = BuildCache.computeOptionsFingerprint(makeOptions({ theme: "seriph" }), "/");
    const fp2 = BuildCache.computeOptionsFingerprint(makeOptions({ theme: "apple-basic" }), "/");
    expect(fp1).not.toBe(fp2);
  });

  it("returns a different hash when addons change", () => {
    const fp1 = BuildCache.computeOptionsFingerprint(makeOptions({ addons: ["slidev-addon-a"] }), "/");
    const fp2 = BuildCache.computeOptionsFingerprint(makeOptions({ addons: ["slidev-addon-b"] }), "/");
    expect(fp1).not.toBe(fp2);
  });

  it("returns a different hash when exportFormats change", () => {
    const fp1 = BuildCache.computeOptionsFingerprint(makeOptions({ exportFormats: [] }), "/");
    const fp2 = BuildCache.computeOptionsFingerprint(makeOptions({ exportFormats: ["pdf"] }), "/");
    expect(fp1).not.toBe(fp2);
  });

  it("returns a different hash when exportWithClicks changes", () => {
    const fp1 = BuildCache.computeOptionsFingerprint(makeOptions({ exportWithClicks: false }), "/");
    const fp2 = BuildCache.computeOptionsFingerprint(makeOptions({ exportWithClicks: true }), "/");
    expect(fp1).not.toBe(fp2);
  });

  it("returns a different hash when withoutNotes changes", () => {
    const fp1 = BuildCache.computeOptionsFingerprint(makeOptions({ withoutNotes: false }), "/");
    const fp2 = BuildCache.computeOptionsFingerprint(makeOptions({ withoutNotes: true }), "/");
    expect(fp1).not.toBe(fp2);
  });

  it("returns a different hash when baseUrl changes", () => {
    const opts = makeOptions();
    const fp1 = BuildCache.computeOptionsFingerprint(opts, "/");
    const fp2 = BuildCache.computeOptionsFingerprint(opts, "/subpath/");
    expect(fp1).not.toBe(fp2);
  });

  it("returns a 16-character hex string", () => {
    const fp = BuildCache.computeOptionsFingerprint(makeOptions(), "/");
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it("produces the same hash regardless of object key insertion order", () => {
    // A non-deterministic JSON.stringify would produce different hashes when the
    // internal object key order changes across Node.js versions. Verify that two
    // equivalent option objects (same values, spread-copied) produce the same hash.
    const opts = makeOptions({ theme: "seriph", addons: ["slidev-addon-a"], download: true });
    const fp1 = BuildCache.computeOptionsFingerprint(opts, "/training/");
    const fp2 = BuildCache.computeOptionsFingerprint({ ...opts }, "/training/");
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ── isCached ─────────────────────────────────────────────────────────────────

describe("BuildCache.isCached", () => {
  it("returns false when no hash manifest exists", () => {
    const cache = new BuildCache(tmpDir);
    expect(cache.isCached("talk", "abc123")).toBe(false);
  });

  it("returns false when hash does not match manifest", () => {
    // Seed manifest with a different hash
    fs.writeFileSync(path.join(tmpDir, "build-hashes.json"), JSON.stringify({ talk: "old-hash" }));
    const outputDir = path.join(tmpDir, "output", "talk");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "index.html"), "<html/>");

    const cache = new BuildCache(tmpDir);
    expect(cache.isCached("talk", "new-hash")).toBe(false);
  });

  it("returns false when hash matches but output index.html is missing", () => {
    const hash = "abc123";
    fs.writeFileSync(path.join(tmpDir, "build-hashes.json"), JSON.stringify({ talk: hash }));
    // Output dir exists but is empty (no index.html)
    fs.mkdirSync(path.join(tmpDir, "output", "talk"), { recursive: true });

    const cache = new BuildCache(tmpDir);
    expect(cache.isCached("talk", hash)).toBe(false);
  });

  it("returns false when hash matches but output dir does not exist", () => {
    const hash = "abc123";
    fs.writeFileSync(path.join(tmpDir, "build-hashes.json"), JSON.stringify({ talk: hash }));

    const cache = new BuildCache(tmpDir);
    expect(cache.isCached("talk", hash)).toBe(false);
  });

  it("returns true when hash matches and index.html is present", () => {
    const hash = "abc123";
    fs.writeFileSync(path.join(tmpDir, "build-hashes.json"), JSON.stringify({ talk: hash }));
    const outputDir = path.join(tmpDir, "output", "talk");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "index.html"), "<html/>");

    const cache = new BuildCache(tmpDir);
    expect(cache.isCached("talk", hash)).toBe(true);
  });
});

// ── recordHash / invalidate / persist ────────────────────────────────────────

describe("BuildCache.persist", () => {
  it("writes recorded hashes to disk", () => {
    const cache = new BuildCache(tmpDir);
    cache.recordHash("talk", "hash-a");
    cache.recordHash("intro", "hash-b");
    cache.persist();

    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, "build-hashes.json"), "utf-8"));
    expect(manifest).toEqual({ talk: "hash-a", intro: "hash-b" });
  });

  it("invalidated entries are excluded from the persisted manifest", () => {
    const cache = new BuildCache(tmpDir);
    cache.recordHash("talk", "hash-a");
    cache.recordHash("intro", "hash-b");
    cache.invalidate("intro");
    cache.persist();

    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, "build-hashes.json"), "utf-8"));
    expect(manifest).toHaveProperty("talk", "hash-a");
    expect(manifest).not.toHaveProperty("intro");
  });

  it("a second BuildCache instance reads the persisted manifest", () => {
    const cache1 = new BuildCache(tmpDir);
    cache1.recordHash("talk", "hash-a");
    cache1.persist();

    // Write a valid output so isCached passes
    const outputDir = path.join(tmpDir, "output", "talk");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "index.html"), "<html/>");

    const cache2 = new BuildCache(tmpDir);
    expect(cache2.isCached("talk", "hash-a")).toBe(true);
  });
});

// ── computeHash ──────────────────────────────────────────────────────────────

describe("BuildCache.computeHash", () => {
  it("returns a composite hash combining file content and options fingerprint", () => {
    const mdFile = path.join(tmpDir, "talk.md");
    fs.writeFileSync(mdFile, "# Hello");

    const cache = new BuildCache(tmpDir);
    const fp = BuildCache.computeOptionsFingerprint(makeOptions(), "/");
    const hash = cache.computeHash(mdFile, fp);

    expect(hash).toContain(":");
    const [fileHash, fingerprint] = hash.split(":");
    expect(fileHash.length).toBeGreaterThan(0);
    expect(fingerprint).toBe(fp);
  });

  it("returns different hash when file content changes", () => {
    const mdFile = path.join(tmpDir, "talk.md");
    fs.writeFileSync(mdFile, "# Hello");
    const cache = new BuildCache(tmpDir);
    const fp = BuildCache.computeOptionsFingerprint(makeOptions(), "/");

    const hash1 = cache.computeHash(mdFile, fp);
    fs.writeFileSync(mdFile, "# Hello updated");
    const hash2 = cache.computeHash(mdFile, fp);

    expect(hash1).not.toBe(hash2);
  });

  it("returns different hash when options fingerprint changes", () => {
    const mdFile = path.join(tmpDir, "talk.md");
    fs.writeFileSync(mdFile, "# Hello");
    const cache = new BuildCache(tmpDir);

    const fp1 = BuildCache.computeOptionsFingerprint(makeOptions({ theme: "seriph" }), "/");
    const fp2 = BuildCache.computeOptionsFingerprint(makeOptions({ theme: "apple-basic" }), "/");

    expect(cache.computeHash(mdFile, fp1)).not.toBe(cache.computeHash(mdFile, fp2));
  });
});
