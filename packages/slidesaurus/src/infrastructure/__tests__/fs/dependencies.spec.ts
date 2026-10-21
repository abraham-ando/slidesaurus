import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectPresentationDependencies,
  containsPresentations,
  extractReferences,
  stripCodeFences,
} from "../../fs/dependencies";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deps-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function write(rel: string, content = "x"): string {
  const p = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

describe("stripCodeFences", () => {
  it("removes HTML comments, including ones spliced by a previous removal", () => {
    expect(stripCodeFences("a <!-- x --> b")).toBe("a  b");
    expect(stripCodeFences("a<!-<!-- x -->- y -->b")).toBe("ab");
  });

  it("drops an unterminated comment up to the end", () => {
    expect(stripCodeFences("keep <!-- ![](./hidden.png)")).toBe("keep ");
  });

  it("removes fenced blocks and inline code", () => {
    expect(
      stripCodeFences("x\n```\n![](./a.png)\n```\ny `![](./b.png)` z"),
    ).toBe("x\n\ny  z");
  });
});

describe("extractReferences", () => {
  it("finds images, src/href attributes, backgrounds and src: imports", () => {
    const md = [
      "---",
      "background: ./bg.jpg",
      "---",
      "![a](./a.png)",
      '<img src="../shared/b.svg">',
      "---",
      "src: ./pages/intro.md#2-3",
      "---",
    ].join("\n");
    const refs = extractReferences(md);
    expect(refs.assets).toEqual(
      expect.arrayContaining(["./bg.jpg", "./a.png", "../shared/b.svg"]),
    );
    expect(refs.imports).toEqual(["./pages/intro.md"]);
  });

  it("ignores references inside code fences, inline code and comments", () => {
    const md =
      "```md\n![x](./in-fence.png)\n```\n`![y](./inline.png)`\n<!-- ![z](./comment.png) -->\n";
    expect(extractReferences(md).assets).toEqual([]);
  });
});

describe("containsPresentations", () => {
  it("detects nested decks but ignores sections/ and _private dirs", () => {
    write("cat/sub/talk.md");
    write("assets/sections/part.md");
    write("assets/_drafts/wip.md");
    expect(containsPresentations(path.join(tmpDir, "cat"))).toBe(true);
    expect(containsPresentations(path.join(tmpDir, "assets"))).toBe(false);
  });
});

describe("collectPresentationDependencies", () => {
  it("is sorted, excludes the entry and other decks, includes referenced files", () => {
    const entry = write(
      "talk.md",
      "![l](./shared/logo.png)\n---\nsrc: ./pages/p.md\n---\n",
    );
    write("other.md");
    write("_category_.yml", "label: X");
    write("shared/logo.png");
    write("pages/p.md", "# p");
    write("components/C.vue");
    write("sibling-cat/deck.md");

    const deps = collectPresentationDependencies(entry, tmpDir).map((d) =>
      path.relative(tmpDir, d).replace(/\\/g, "/"),
    );
    expect(deps).toEqual(["components/C.vue", "pages/p.md", "shared/logo.png"]);
  });

  it("follows nested src: imports without looping on cycles", () => {
    const entry = write("deck/main.md", "---\nsrc: ../parts/a.md\n---\n");
    write("parts/a.md", "---\nsrc: ./b.md\n---\n");
    write("parts/b.md", "---\nsrc: ./a.md\n---\n![i](./img.png)\n");
    write("parts/img.png");

    const deps = collectPresentationDependencies(entry, tmpDir).map((d) =>
      path.relative(tmpDir, d).replace(/\\/g, "/"),
    );
    expect(deps).toEqual(["parts/a.md", "parts/b.md", "parts/img.png"]);
  });

  it("confines references to the slides root", () => {
    const root = path.join(tmpDir, "slides");
    write("outside.png");
    const entry = write("slides/talk.md", "![x](../outside.png)\n");
    expect(collectPresentationDependencies(entry, root)).toEqual([]);
  });
});
