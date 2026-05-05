import { describe, it, expect, vi } from "vitest";

vi.mock("../logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    path: (p: string) => p,
    code: (c: string) => c,
  },
}));

import { validateOptions } from "../index";

const noopValidate = () => ({});

describe("validateOptions", () => {
  it("applies default options when none are provided", () => {
    const result = validateOptions({ options: {}, validate: noopValidate });

    expect(result.path).toBe("./slidev");
    expect(result.routeBasePath).toBe("/slidev");
    expect(result.buildTimeout).toBe(120);
    expect(result.verbose).toBe(false);
    expect(result.theme).toBe("unicorn");
    expect(result.maxParallelBuilds).toBe(Math.max(1, require("node:os").cpus().length - 1));
    expect(result.download).toBe(false);
    expect(result.autoInstall).toBe(true);
  });

  it("allows custom options to override defaults", () => {
    const result = validateOptions({
      options: {
        path: "./slides",
        routeBasePath: "/my-slides",
        theme: "seriph",
        buildTimeout: 60,
        verbose: true,
      },
      validate: noopValidate,
    });

    expect(result.path).toBe("./slides");
    expect(result.routeBasePath).toBe("/my-slides");
    expect(result.theme).toBe("seriph");
    expect(result.buildTimeout).toBe(60);
    expect(result.verbose).toBe(true);
  });

  it("throws when buildTimeout is below minimum", () => {
    expect(() =>
      validateOptions({
        options: { buildTimeout: 5 },
        validate: noopValidate,
      }),
    ).toThrow();
  });

  it("throws when buildTimeout exceeds maximum", () => {
    expect(() =>
      validateOptions({
        options: { buildTimeout: 9999 },
        validate: noopValidate,
      }),
    ).toThrow();
  });

  it("migrates deprecated sourceDir to path", () => {
    const result = validateOptions({
      options: { sourceDir: "./legacy" },
      validate: noopValidate,
    });

    expect(result.path).toBe("./legacy");
  });

  it("migrates deprecated overviewPath to routeBasePath", () => {
    const result = validateOptions({
      options: { overviewPath: "/old-route" },
      validate: noopValidate,
    });

    expect(result.routeBasePath).toBe("/old-route");
  });

  it("migrates deprecated overviewTitle to pageTitle", () => {
    const result = validateOptions({
      options: { overviewTitle: "Old Title" },
      validate: noopValidate,
    });

    expect(result.pageTitle).toBe("Old Title");
  });

  it("does not override explicit option with deprecated one", () => {
    const result = validateOptions({
      options: { path: "./explicit", sourceDir: "./deprecated" },
      validate: noopValidate,
    });

    expect(result.path).toBe("./explicit");
  });

  it("accepts valid addons array", () => {
    const result = validateOptions({
      options: { addons: ["addon-a", "addon-b"] },
      validate: noopValidate,
    });

    expect(result.addons).toEqual(["addon-a", "addon-b"]);
  });

  it("rejects invalid maxParallelBuilds", () => {
    expect(() =>
      validateOptions({
        options: { maxParallelBuilds: 0 },
        validate: noopValidate,
      }),
    ).toThrow();
  });
});
