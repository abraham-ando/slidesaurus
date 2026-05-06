import { describe, it, expect } from "vitest";
import { validateOptions } from "../../index";

// validateOptions is a pure function with no side-effects — no mocks needed.

function callValidate(opts: Record<string, unknown>) {
  return validateOptions({
    options: opts,
    validate: (schema: unknown, options: unknown) => options,
  });
}

describe("validateOptions — defaults", () => {
  it("returns valid options with all defaults when no options provided", () => {
    const result = callValidate({});
    expect(result.path).toBe("./slidev");
    expect(result.autoInstall).toBe(false);
    expect(result.devServerBasePort).toBe(8600);
  });

  it("autoInstall defaults to false (OWASP A05 — principle of least privilege)", () => {
    const result = callValidate({});
    expect(result.autoInstall).toBe(false);
  });

  it("accepts a valid relative path", () => {
    const result = callValidate({ path: "docs/slides" });
    expect(result.path).toBe("docs/slides");
  });
});

describe("validateOptions — OWASP A01 path traversal guard", () => {
  it("throws for an absolute path (POSIX)", () => {
    expect(() => callValidate({ path: "/etc/passwd" })).toThrow(
      /\[Security\].*absolute/,
    );
  });

  it("throws for a traversal path escaping the site directory", () => {
    expect(() => callValidate({ path: "../../etc/passwd" })).toThrow(
      /\[Security\].*traverse/,
    );
  });

  it("throws for a single-level traversal", () => {
    expect(() => callValidate({ path: "../sibling" })).toThrow(
      /\[Security\].*traverse/,
    );
  });
});
