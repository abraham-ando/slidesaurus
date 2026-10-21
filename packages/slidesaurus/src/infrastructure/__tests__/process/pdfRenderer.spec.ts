import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readDeckExportSettings } from "../../process/pdfRenderer";

let tmpDir: string;

function deck(content: string): string {
  const file = path.join(tmpDir, "deck.md");
  fs.writeFileSync(file, content);
  return file;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("readDeckExportSettings", () => {
  it("defaults to slidev export's defaults", () => {
    expect(readDeckExportSettings(deck("# no headmatter"), false)).toEqual({
      withClicks: false,
      headmatterWithClicks: false,
      exportFilename: undefined,
      dark: false,
      routerMode: "history",
      wait: 0,
      needsSlidevExport: false,
      title: undefined,
      author: undefined,
      info: undefined,
      keywords: undefined,
    });
  });

  it("reads export options, colour schema, router mode and metadata", () => {
    const file = deck(
      "---\r\ntitle: Talk\r\nauthor: Ada\r\ninfo: About\r\nkeywords: a, b\r\ncolorSchema: dark\r\nrouterMode: hash\r\n" +
        "exportFilename: my-talk\r\nexport:\r\n  withClicks: true\r\n  wait: 500\r\n---\r\n# Talk\r\n",
    );
    expect(readDeckExportSettings(file, false)).toEqual({
      withClicks: true,
      headmatterWithClicks: true,
      exportFilename: "my-talk",
      dark: true,
      routerMode: "hash",
      wait: 500,
      needsSlidevExport: false,
      title: "Talk",
      author: "Ada",
      info: "About",
      keywords: ["a", "b"],
    });
  });

  it("lets the exportWithClicks option force clicks", () => {
    expect(readDeckExportSettings(deck("---\ntitle: x\n---\n"), true).withClicks).toBe(true);
  });

  it("delegates withToc / perSlide to slidev export", () => {
    expect(readDeckExportSettings(deck("---\nexport:\n  withToc: true\n---\n"), false).needsSlidevExport).toBe(true);
    expect(readDeckExportSettings(deck("---\nexport:\n  perSlide: true\n---\n"), false).needsSlidevExport).toBe(true);
  });

  it("never evaluates a ---js headmatter and survives invalid YAML", () => {
    expect(readDeckExportSettings(deck("---js\n{ title: process.exit(1) }\n---\n"), false).title).toBeUndefined();
    expect(readDeckExportSettings(deck("---\n: : bad\n  - [\n---\n"), false).routerMode).toBe("history");
    expect(readDeckExportSettings(path.join(tmpDir, "missing.md"), false).withClicks).toBe(false);
  });
});
