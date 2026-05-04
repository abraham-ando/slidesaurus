import { describe, it, expect } from "vitest";
import { renderTemplate, TEMPLATE_NAMES } from "../../cli/templates";

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
});
