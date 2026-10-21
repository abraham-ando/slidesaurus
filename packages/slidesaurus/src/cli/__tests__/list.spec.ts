import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  loadPluginOptions: vi.fn(),
  resolveOptions: vi.fn(),
  scanPresentations: vi.fn(),
}));

vi.mock("../config", () => ({
  loadPluginOptions: mocks.loadPluginOptions,
  resolveOptions: mocks.resolveOptions,
}));
vi.mock("../../application/scanner", () => ({
  scanPresentations: mocks.scanPresentations,
}));

import { runList } from "../commands/list";

describe("runList", () => {
  let output: string[];

  beforeEach(() => {
    output = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      output.push(args.join(" "));
    });
    mocks.loadPluginOptions.mockReturnValue({
      options: {},
      configFile: "docusaurus.config.ts",
      pluginFound: true,
    });
    mocks.resolveOptions.mockReturnValue({
      path: "./slidev",
      routeBasePath: "/slidev",
      id: "default",
      theme: "seriph",
    });
    mocks.scanPresentations.mockResolvedValue({
      presentations: [
        {
          id: "intro/hello",
          title: "Hello",
          category: "intro",
          level: "beginner",
          tags: ["a", "b"],
        },
        { id: "bye", title: "Bye", category: "", theme: "unicorn" },
      ],
      categories: [
        {
          path: "intro",
          label: "Intro",
          count: 1,
          position: 1,
          url: "/slidev/intro",
        },
      ],
      playlists: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.values(mocks).forEach((m) => m.mockReset());
  });

  it("prints presentations as JSON without any decoration with --json", async () => {
    await runList({ json: true, pluginId: "default" });

    expect(output).toHaveLength(1);
    const parsed = JSON.parse(output[0]);
    expect(parsed.map((p: { id: string }) => p.id)).toEqual([
      "intro/hello",
      "bye",
    ]);
  });

  it("renders a table with the key columns", async () => {
    await runList({ pluginId: "default" });

    const text = output.join("\n");
    expect(text).toContain("intro/hello");
    expect(text).toContain("Hello");
    expect(text).toContain("unicorn");
    expect(text).toContain("beginner");
    expect(text).toContain("1 category");
  });

  it("falls back to the global theme when a presentation has none", async () => {
    await runList({ pluginId: "default" });
    expect(output.join("\n")).toContain("seriph");
  });

  it("says so when no presentation is found", async () => {
    mocks.scanPresentations.mockResolvedValue({
      presentations: [],
      categories: [],
      playlists: [],
    });
    await runList({ pluginId: "default" });
    expect(output.join("\n")).toContain("No presentations found");
  });

  it("passes the plugin id to the config loader", async () => {
    await runList({ json: true, pluginId: "docs2" });
    expect(mocks.loadPluginOptions).toHaveBeenCalledWith(
      expect.any(String),
      "docs2",
    );
  });
});
