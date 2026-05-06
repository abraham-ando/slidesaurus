import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validatePluginId } from "../fs/fileSystem";
import { hasCachedOutput } from "../fs/outputManager";
import { filterEnvAllowlist } from "../packages/env";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "security-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── validatePluginId ──────────────────────────────────────────────────────────

describe("validatePluginId", () => {
  it("accepts valid alphanumeric IDs", () => {
    expect(() => validatePluginId("default")).not.toThrow();
    expect(() => validatePluginId("my-plugin")).not.toThrow();
    expect(() => validatePluginId("plugin_v2")).not.toThrow();
    expect(() => validatePluginId("Abc123")).not.toThrow();
  });

  it("rejects empty string", () => {
    expect(() => validatePluginId("")).toThrow("[Security]");
  });

  it("rejects path traversal via double-dot", () => {
    expect(() => validatePluginId("../evil")).toThrow("[Security]");
  });

  it("rejects forward slashes", () => {
    expect(() => validatePluginId("foo/bar")).toThrow("[Security]");
  });

  it("rejects backslashes", () => {
    expect(() => validatePluginId("foo\\bar")).toThrow("[Security]");
  });

  it("rejects dots", () => {
    expect(() => validatePluginId(".hidden")).toThrow("[Security]");
  });

  it("rejects spaces", () => {
    expect(() => validatePluginId("my plugin")).toThrow("[Security]");
  });
});

// ── hasCachedOutput path traversal guard ─────────────────────────────────────

describe("hasCachedOutput — path traversal guard", () => {
  it("throws on double-dot traversal", () => {
    expect(() => hasCachedOutput(tmpDir, "../escape")).toThrow("[Security]");
  });

  it("throws on absolute path as presentationId", () => {
    const absPath = process.platform === "win32" ? "C:\\evil" : "/etc/passwd";
    expect(() => hasCachedOutput(tmpDir, absPath)).toThrow("[Security]");
  });

  it("throws on combined traversal", () => {
    expect(() => hasCachedOutput(tmpDir, "valid/../../escape")).toThrow("[Security]");
  });

  it("returns false for a valid ID with no cached output", () => {
    expect(hasCachedOutput(tmpDir, "my-presentation")).toBe(false);
  });

  it("returns true when index.html exists at expected path", () => {
    const outputDir = path.join(tmpDir, "output", "my-talk");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "index.html"), "<html/>");
    expect(hasCachedOutput(tmpDir, "my-talk")).toBe(true);
  });
});

// ── filterEnvAllowlist ────────────────────────────────────────────────────────

describe("filterEnvAllowlist", () => {
  it("passes through allowlisted keys", () => {
    const result = filterEnvAllowlist({ PATH: "/usr/bin", HOME: "/home/user" });
    expect(result).toHaveProperty("PATH", "/usr/bin");
    expect(result).toHaveProperty("HOME", "/home/user");
  });

  it("blocks secret-like keys", () => {
    const result = filterEnvAllowlist({
      PATH: "/usr/bin",
      AWS_SECRET_ACCESS_KEY: "secret",
      GITHUB_TOKEN: "ghp_xxx",
      DATABASE_URL: "postgres://...",
      NPM_TOKEN: "npm_xxx",
    });
    expect(result).toHaveProperty("PATH");
    expect(result).not.toHaveProperty("AWS_SECRET_ACCESS_KEY");
    expect(result).not.toHaveProperty("GITHUB_TOKEN");
    expect(result).not.toHaveProperty("DATABASE_URL");
    expect(result).not.toHaveProperty("NPM_TOKEN");
  });

  it("blocks npm registry and cache env vars (intentional exclusion)", () => {
    const result = filterEnvAllowlist({
      npm_config_registry: "https://evil.registry.com",
      npm_config_cache: "/tmp/evil",
      PATH: "/usr/bin",
    });
    expect(result).not.toHaveProperty("npm_config_registry");
    expect(result).not.toHaveProperty("npm_config_cache");
    expect(result).toHaveProperty("PATH");
  });

  it("key matching is case-insensitive", () => {
    const result = filterEnvAllowlist({ path: "/usr/bin", Path: "/usr/local/bin" });
    // At least one of the path variants should pass through
    const hasPath = "path" in result || "Path" in result;
    expect(hasPath).toBe(true);
  });

  it("respects additionalKeys parameter", () => {
    const result = filterEnvAllowlist(
      { CUSTOM_KEY: "value", PATH: "/usr/bin" },
      ["CUSTOM_KEY"],
    );
    expect(result).toHaveProperty("CUSTOM_KEY", "value");
    expect(result).toHaveProperty("PATH");
  });

  it("returns empty object when env has no allowlisted keys", () => {
    const result = filterEnvAllowlist({ SECRET: "x", TOKEN: "y" });
    expect(Object.keys(result)).toHaveLength(0);
  });
});
