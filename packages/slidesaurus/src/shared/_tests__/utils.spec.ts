import { describe, it, expect } from "vitest";
import { getUrlPathFromPath, validatePackageName } from "../utils";

describe("getUrlPathFromPath", () => {
  it('returns last segment from "./slidev"', () => {
    expect(getUrlPathFromPath("./slidev")).toBe("slidev");
  });

  it('returns last segment from "slidev" without leading dot', () => {
    expect(getUrlPathFromPath("slidev")).toBe("slidev");
  });

  it('returns last segment from nested path "./demos/slides"', () => {
    expect(getUrlPathFromPath("./demos/slides")).toBe("slides");
  });

  it("strips trailing slash from ./presentations/", () => {
    expect(getUrlPathFromPath("./presentations/")).toBe("presentations");
  });

  it('falls back to "slidev" for empty string', () => {
    expect(getUrlPathFromPath("")).toBe("slidev");
  });

  it("handles deeply nested paths", () => {
    expect(getUrlPathFromPath("./a/b/c/deep")).toBe("deep");
  });

  it("handles leading slash", () => {
    expect(getUrlPathFromPath("/my-slides")).toBe("my-slides");
  });
});

describe("validatePackageName", () => {
  it("accepts simple package name", () => {
    expect(validatePackageName("gray-matter")).toBe("gray-matter");
  });

  it("accepts scoped package name", () => {
    expect(validatePackageName("@slidev/theme-seriph")).toBe(
      "@slidev/theme-seriph",
    );
  });

  it("accepts theme-style name", () => {
    expect(validatePackageName("slidev-theme-unicorn")).toBe(
      "slidev-theme-unicorn",
    );
  });

  it("accepts dots and underscores", () => {
    expect(validatePackageName("my.pkg_name")).toBe("my.pkg_name");
  });

  it("passes through relative local path", () => {
    expect(validatePackageName("./local")).toBe("./local");
  });

  it("passes through absolute path", () => {
    expect(validatePackageName("/absolute")).toBe("/absolute");
  });

  it("passes through Windows-style path", () => {
    expect(validatePackageName("\\windows")).toBe("\\windows");
  });

  it("rejects command injection via semicolon", () => {
    expect(() => validatePackageName("pkg; rm -rf /")).toThrow(
      /Invalid package name/,
    );
  });

  it("rejects shell substitution", () => {
    expect(() => validatePackageName("$(malicious)")).toThrow(
      /Invalid package name/,
    );
  });

  it("rejects chained command via &&", () => {
    expect(() => validatePackageName("pkg && echo hacked")).toThrow(
      /Invalid package name/,
    );
  });
});
