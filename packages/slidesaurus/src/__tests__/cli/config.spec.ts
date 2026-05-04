import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { findConfigFile, loadPluginOptions, resolveOptions, CONFIG_DEFAULTS } from "../../cli/config";

describe("findConfigFile", () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-config-")); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("returns null when no config exists", () => {
    expect(findConfigFile(tmpDir)).toBeNull();
  });

  it("finds docusaurus.config.js", () => {
    const p = path.join(tmpDir, "docusaurus.config.js");
    fs.writeFileSync(p, "module.exports = {};");
    expect(findConfigFile(tmpDir)).toBe(p);
  });

  it("prefers .ts over .js when both exist", () => {
    const ts = path.join(tmpDir, "docusaurus.config.ts");
    const js = path.join(tmpDir, "docusaurus.config.js");
    fs.writeFileSync(ts, "export default {};");
    fs.writeFileSync(js, "module.exports = {};");
    expect(findConfigFile(tmpDir)).toBe(ts);
  });
});

describe("loadPluginOptions", () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-config-")); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("returns empty options when no config file exists", () => {
    const result = loadPluginOptions(tmpDir, "default");
    expect(result.configFile).toBeNull();
    expect(result.pluginFound).toBe(false);
    expect(result.options).toEqual({});
  });

  it("returns pluginFound=false when config has no slidesaurus entry", () => {
    const config = path.join(tmpDir, "docusaurus.config.js");
    fs.writeFileSync(config, "module.exports = { plugins: [] };");
    const result = loadPluginOptions(tmpDir, "default");
    expect(result.configFile).toBe(config);
    expect(result.pluginFound).toBe(false);
  });

  it("extracts plugin options from a .js config", () => {
    const config = path.join(tmpDir, "docusaurus.config.js");
    fs.writeFileSync(
      config,
      `module.exports = {
        plugins: [
          ["slidesaurus", { path: "./my-slides", routeBasePath: "/decks", theme: "seriph" }]
        ]
      };`,
    );
    const result = loadPluginOptions(tmpDir, "default");
    expect(result.pluginFound).toBe(true);
    expect(result.options.path).toBe("./my-slides");
    expect(result.options.routeBasePath).toBe("/decks");
    expect(result.options.theme).toBe("seriph");
  });

  it("matches the correct pluginId in multi-instance config", () => {
    const config = path.join(tmpDir, "docusaurus.config.js");
    fs.writeFileSync(
      config,
      `module.exports = {
        plugins: [
          ["slidesaurus", { id: "default", path: "./slidev-a" }],
          ["slidesaurus", { id: "secondary", path: "./slidev-b" }]
        ]
      };`,
    );
    const result = loadPluginOptions(tmpDir, "secondary");
    expect(result.pluginFound).toBe(true);
    expect(result.options.path).toBe("./slidev-b");
  });
});

describe("resolveOptions", () => {
  it("applies defaults for missing fields", () => {
    const opts = resolveOptions({}, "default");
    expect(opts.path).toBe(CONFIG_DEFAULTS.path);
    expect(opts.routeBasePath).toBe(CONFIG_DEFAULTS.routeBasePath);
    expect(opts.id).toBe("default");
  });

  it("loaded options override defaults", () => {
    const opts = resolveOptions({ path: "./my-slides" }, "default");
    expect(opts.path).toBe("./my-slides");
  });

  it("uses the provided pluginId", () => {
    const opts = resolveOptions({}, "secondary");
    expect(opts.id).toBe("secondary");
  });
});
