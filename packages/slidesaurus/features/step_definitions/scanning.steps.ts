import { Given, When, Then, Before, After } from "@cucumber/cucumber";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PluginOptions, ScanResult, BuildContext } from "../../src/domain/types";

interface ScanWorld {
  tmpDir: string;
  slidevDir: string;
  result: ScanResult | null;
}

const world: ScanWorld = {
  tmpDir: "",
  slidevDir: "",
  result: null,
};

const defaultOptions: PluginOptions = {
  path: "slidev",
  download: false,
  exportFormats: ["pdf"],
  routeBasePath: "/slidev",
  pageTitle: "Presentations",
  pageTagline: "Overview",
  id: "default",
  theme: "unicorn",
  addons: [],
  buildTimeout: 120,
  verbose: false,
  maxParallelBuilds: 4,
  autoInstall: true,
  dryRun: false,
  devServerBasePort: 8600,
  devServerTimeout: 10000,
  withoutNotes: false,
  exportWithClicks: false,
  uiTheme: "default",
};

function makeFrontmatter(title: string): string {
  return `---\ntitle: ${title}\n---\n\n# Slide 1\nContent`;
}

Before(function () {
  world.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cucumber-scan-"));
  world.slidevDir = path.join(world.tmpDir, "slidev");
  fs.mkdirSync(world.slidevDir, { recursive: true });
  world.result = null;
});

After(function () {
  if (world.tmpDir && fs.existsSync(world.tmpDir)) {
    fs.rmSync(world.tmpDir, { recursive: true, force: true });
  }
});

Given(
  "a slidev directory with the following files:",
  function (dataTable: { hashes: () => Array<{ file: string; title: string }> }) {
    for (const row of dataTable.hashes()) {
      const filePath = path.join(world.slidevDir, row.file);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, makeFrontmatter(row.title));
    }
  },
);

Given(
  "a slidev directory with the following structure:",
  function (dataTable: { hashes: () => Array<{ path: string; title: string }> }) {
    for (const row of dataTable.hashes()) {
      const filePath = path.join(world.slidevDir, row.path);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, makeFrontmatter(row.title));
    }
  },
);

Given(
  "a category file {string} with:",
  function (
    relPath: string,
    dataTable: { hashes: () => Array<{ label: string; position: string }> },
  ) {
    const row = dataTable.hashes()[0];
    const filePath = path.join(world.slidevDir, relPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `label: ${row.label}\nposition: ${row.position}\n`);
  },
);

When("the plugin scans for presentations", async function () {
  // require() (not import()): step definitions run as CommonJS through tsx/cjs.
  const { scanPresentations } =
    require("../../src/application/scanner") as typeof import("../../src/application/scanner");
  const context: BuildContext = { siteDir: world.tmpDir, baseUrl: "/" };
  world.result = await scanPresentations(defaultOptions, context);
});

Then("{int} presentation(s) should be found", function (count: number) {
  assert.ok(world.result, "Scan result is null");
  assert.strictEqual(world.result.presentations.length, count);
});

Then("{int} categories should be found", function (count: number) {
  assert.ok(world.result, "Scan result is null");
  assert.strictEqual(world.result.categories.length, count);
});

Then(
  "the presentation {string} should have title {string}",
  function (id: string, title: string) {
    assert.ok(world.result, "Scan result is null");
    const presentation = world.result.presentations.find((p) => p.id === id);
    assert.ok(presentation, `Presentation "${id}" not found`);
    assert.strictEqual(presentation.title, title);
  },
);

Then(
  "the category {string} should have label {string}",
  function (catPath: string, label: string) {
    assert.ok(world.result, "Scan result is null");
    const category = world.result.categories.find((c) => c.path === catPath);
    assert.ok(category, `Category "${catPath}" not found`);
    assert.strictEqual(category.label, label);
  },
);
