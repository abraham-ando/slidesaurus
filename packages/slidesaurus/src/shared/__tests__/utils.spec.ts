import { describe, it, expect } from "vitest";
import {
  buildRouteBase,
  encodeIdForUrl,
  getUrlPathFromPath,
  isLocalPath,
  stableStringify,
  stripSlashes,
  toSafeId,
  validatePackageName,
  validateSlidevPackageName,
} from "../utils";

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

describe("validateSlidevPackageName", () => {
  it.each([
    ["theme", "slidev-theme-unicorn"],
    ["theme", "@slidev/theme-seriph"],
    ["theme", "@acme/slidev-theme-corporate"],
    ["addon", "slidev-addon-excalidraw"],
    ["addon", "@slidev/addon-foo"],
    ["addon", "@acme/slidev-addon-qrcode"],
  ] as const)("accepts %s %s", (kind, name) => {
    expect(validateSlidevPackageName(name, kind)).toBe(name);
  });

  it.each([
    ["theme", "lodash"],
    ["theme", "slidev-addon-foo"],
    ["theme", "@acme/theme-foo"],
    ["addon", "@org/addon"],
    ["addon", "slidev-theme-foo"],
    ["addon", "evil-package"],
  ] as const)("rejects %s %s (not a Slidev package name)", (kind, name) => {
    expect(() => validateSlidevPackageName(name, kind)).toThrow(/Invalid Slidev/);
  });

  it("still rejects injection characters", () => {
    expect(() => validateSlidevPackageName("slidev-theme-x;rm -rf /", "theme")).toThrow(/Invalid package name/);
  });

  it("passes local paths through", () => {
    expect(validateSlidevPackageName("./themes/mine", "theme")).toBe("./themes/mine");
  });
});

describe("isLocalPath", () => {
  it("detects relative and absolute paths", () => {
    expect(isLocalPath("./x")).toBe(true);
    expect(isLocalPath("../x")).toBe(true);
    expect(isLocalPath("/x")).toBe(true);
    expect(isLocalPath("\\x")).toBe(true);
  });

  it("does not treat package names as paths", () => {
    expect(isLocalPath("@slidev/theme-seriph")).toBe(false);
    expect(isLocalPath("slidev-theme-x")).toBe(false);
  });
});

describe("buildRouteBase", () => {
  it("joins baseUrl and routeBasePath without duplicate or trailing slashes", () => {
    expect(buildRouteBase("/", "/slidev")).toBe("/slidev");
    expect(buildRouteBase("/docs/", "/slidev")).toBe("/docs/slidev");
    expect(buildRouteBase("/docs", "slidev/")).toBe("/docs/slidev");
    expect(buildRouteBase("/fr/", "talks/2024")).toBe("/fr/talks/2024");
  });

  it("returns an empty string when both are root", () => {
    expect(buildRouteBase("/", "/")).toBe("");
  });
});

describe("stripSlashes", () => {
  it("strips repeated leading and trailing slashes", () => {
    expect(stripSlashes("//slidev//")).toBe("slidev");
  });
});

describe("encodeIdForUrl", () => {
  it("percent-encodes each segment but keeps separators", () => {
    expect(encodeIdForUrl("my talk/part #1")).toBe("my%20talk/part%20%231");
    expect(encodeIdForUrl("a?b/c%d")).toBe("a%3Fb/c%25d");
  });

  it("leaves simple ids unchanged", () => {
    expect(encodeIdForUrl("getting-started/intro")).toBe("getting-started/intro");
  });
});

describe("toSafeId", () => {
  it("produces a single filesystem-safe segment", () => {
    const safe = toSafeId("cat/sub talk");
    expect(safe).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is injective: a/b and a__b never collide", () => {
    expect(toSafeId("a/b")).not.toBe(toSafeId("a__b"));
    expect(toSafeId("a/b")).not.toBe(toSafeId("a_b"));
    expect(toSafeId("a.b")).not.toBe(toSafeId("a/b"));
  });

  it("never yields a traversal segment", () => {
    expect(toSafeId("..")).not.toContain(".");
  });

  it("keeps simple ids readable", () => {
    expect(toSafeId("intro-2024")).toBe("intro-2024");
  });
});

describe("stableStringify", () => {
  it("is independent of key insertion order (recursively)", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it("keeps array order", () => {
    expect(stableStringify([2, 1])).toBe("[2,1]");
  });
});
