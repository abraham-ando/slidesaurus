import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { _resetIconCollectionCache, findPackageDir, prepareIconCollections } from "../../fs/iconCollections";

let tmp: string;

function pkg(dir: string, name: string, files: Record<string, string> = {}): string {
  const root = path.join(dir, "node_modules", ...name.split("/"));
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "icons-")));
  _resetIconCollectionCache();
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/**
 * store/       ← pnpm-like: the client and its collections are NOT visible from the site
 *   node_modules/@slidev/client  (TitleIcon uses i-vscode-icons:…)
 *   node_modules/@iconify-json/carbon
 * site/
 *   node_modules/@slidev/theme-x
 *   .docusaurus/…/builds/deck    ← isolated dir
 */
function layout() {
  const store = path.join(tmp, "store");
  const clientDir = pkg(store, "@slidev/client", {
    "internals/TitleIcon.vue": `<div class="i-vscode-icons:file-type-npm i-carbon:close" />`,
  });
  pkg(store, "@iconify-json/carbon", { "icons.json": "{}" });
  const siteDir = path.join(tmp, "site");
  const themeDir = pkg(siteDir, "@slidev/theme-x");
  const isolatedDir = path.join(siteDir, ".docusaurus", "slidesaurus", "default", "builds", "deck");
  fs.mkdirSync(isolatedDir, { recursive: true });
  return { store, clientDir, siteDir, themeDir, isolatedDir };
}

describe("findPackageDir", () => {
  it("walks up node_modules like Node", () => {
    const { siteDir, themeDir } = layout();
    expect(findPackageDir(path.join(siteDir, "a", "b"), "@slidev/theme-x")).toBe(themeDir);
    expect(findPackageDir(siteDir, "@slidev/missing")).toBeUndefined();
  });
});

describe("prepareIconCollections", () => {
  it("links client-only collections and creates empty ones for missing collections", () => {
    const { clientDir, siteDir, themeDir, isolatedDir, store } = layout();
    const result = prepareIconCollections(isolatedDir, { siteDir, packageDirs: [themeDir], clientDir });

    expect(result.linked).toEqual(["carbon"]);
    expect(result.stubbed).toEqual(["vscode-icons"]);
    const scope = path.join(isolatedDir, "node_modules", "@iconify-json");
    expect(fs.realpathSync(path.join(scope, "carbon"))).toBe(path.join(store, "node_modules", "@iconify-json", "carbon"));
    expect(JSON.parse(fs.readFileSync(path.join(scope, "vscode-icons", "icons.json"), "utf-8"))).toEqual({
      prefix: "vscode-icons",
      icons: {},
    });
  });

  it("never shadows a collection the site, the theme or an addon resolves", () => {
    const { clientDir, siteDir, themeDir, isolatedDir } = layout();
    pkg(siteDir, "@iconify-json/carbon", { "icons.json": "{}" });
    pkg(themeDir, "@iconify-json/vscode-icons", { "icons.json": "{}" });
    const result = prepareIconCollections(isolatedDir, { siteDir, packageDirs: [themeDir], clientDir });
    expect(result).toEqual({ linked: [], stubbed: [] });
    expect(fs.existsSync(path.join(isolatedDir, "node_modules"))).toBe(false);
  });

  it("removing the isolated dir keeps the linked package intact", () => {
    const { clientDir, siteDir, themeDir, isolatedDir, store } = layout();
    prepareIconCollections(isolatedDir, { siteDir, packageDirs: [themeDir], clientDir });
    fs.rmSync(isolatedDir, { recursive: true, force: true });
    expect(fs.existsSync(path.join(store, "node_modules", "@iconify-json", "carbon", "icons.json"))).toBe(true);
  });
});
