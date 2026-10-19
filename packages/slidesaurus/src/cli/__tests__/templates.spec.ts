import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import { renderTemplate, TEMPLATE_NAMES, yamlScalar } from "../templates";

describe("renderTemplate", () => {
  const vars = { title: "My Presentation", theme: "seriph", author: "Alice" };

  it("includes the title in all templates", () => {
    for (const t of TEMPLATE_NAMES) {
      const out = renderTemplate(t, vars);
      expect(out).toContain("My Presentation");
    }
  });

  it("includes the theme in all templates", () => {
    for (const t of TEMPLATE_NAMES) {
      const out = renderTemplate(t, vars);
      expect(out).toContain("theme: seriph");
    }
  });

  it("generates valid YAML frontmatter block", () => {
    const out = renderTemplate("basic", vars);
    expect(out.startsWith("---\n")).toBe(true);
    expect(out).toContain("\n---\n");
  });

  it("basic template has slide separators", () => {
    const out = renderTemplate("basic", vars);
    expect(out.split("\n---\n").length).toBeGreaterThan(2);
  });

  it("tutorial template includes level and duration", () => {
    const out = renderTemplate("tutorial", vars);
    expect(out).toContain("level: beginner");
    expect(out).toContain("duration: 30");
    expect(out).toContain("Prerequisites");
  });

  it("talk template includes agenda and duration", () => {
    const out = renderTemplate("talk", vars);
    expect(out).toContain("duration: 45");
    expect(out).toContain("Agenda");
  });

  it("escapes YAML-special characters in title, theme and author", () => {
    const nasty = {
      title: 'Intro: "quotes" # not a comment\nsecond: line',
      theme: "@scope/slidev-theme-x",
      author: "Bob: the *builder*",
    };
    for (const t of TEMPLATE_NAMES) {
      const { data } = matter(renderTemplate(t, nasty));
      expect(data.title).toBe(nasty.title);
      expect(data.theme).toBe(nasty.theme);
      expect(data.author).toBe(nasty.author);
    }
  });
});

describe("yamlScalar", () => {
  it("keeps simple values plain", () => {
    expect(yamlScalar("My Talk")).toBe("My Talk");
    expect(yamlScalar("seriph")).toBe("seriph");
  });

  it.each(["true", "null", "123", "", " padded ", "a: b", "x #y", "@scope/pkg", "- item"])(
    "quotes ambiguous value %j",
    (v) => {
      expect(yamlScalar(v)).toBe(JSON.stringify(v));
    },
  );
});
