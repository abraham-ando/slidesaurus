import { describe, it, expect, vi } from "vitest";
import type { PluginContentData, PluginOptions } from "../../domain/types";
import { registerRoutes, toPublicPluginData } from "../routeBuilder";

function makeContent(overrides: Partial<PluginOptions> = {}): PluginContentData {
  return {
    presentations: [
      {
        id: "cat/talk",
        title: "Talk",
        sourcePath: "cat/talk.md",
        sourceAbsolutePath: "/home/me/site/slidev/cat/talk.md",
        url: "/docs/slidev/cat/talk/",
        outputPath: "/home/me/site/.docusaurus/slidesaurus/default/output/cat/talk",
        previewUrl: "/docs/slidev/cat/talk/",
        thumbnailUrl: "/docs/slidev/cat/talk/thumbnail.png",
        category: "cat",
        tags: ["intro"],
        level: "beginner",
      },
    ],
    categories: [{ path: "cat", label: "Cat", position: 1, count: 1, url: "/docs/slidev/cat" }],
    playlists: [{ id: "pl", title: "PL", items: ["cat/talk"] }],
    config: {
      path: "./slidev",
      id: "default",
      routeBasePath: "/slidev",
      pageTitle: "Slides",
      pageTagline: "All decks",
      uiTheme: "compact",
      theme: "seriph",
      addons: [],
      buildTimeout: 120,
      verbose: false,
      maxParallelBuilds: 2,
      autoInstall: true,
      download: false,
      exportFormats: ["pdf"],
      dryRun: false,
      withoutNotes: false,
      exportWithClicks: false,
      devServerBasePort: 8600,
      devServerTimeout: 60000,
      onBuildComplete: () => undefined,
      ...overrides,
    },
    isDev: false,
  };
}

function makeActions() {
  return {
    setGlobalData: vi.fn(),
    addRoute: vi.fn(),
    createData: vi.fn().mockResolvedValue("@generated/pluginId.json"),
  };
}

describe("toPublicPluginData", () => {
  it("strips server-only fields and options from the global data", () => {
    const data = toPublicPluginData(makeContent());
    const serialized = JSON.stringify(data);

    expect(serialized).not.toContain("/home/me");
    expect(data.presentations[0]).not.toHaveProperty("sourceAbsolutePath");
    expect(data.presentations[0]).not.toHaveProperty("outputPath");
    expect(data.config).toEqual({
      routeBasePath: "/slidev",
      path: "./slidev",
      pageTitle: "Slides",
      pageTagline: "All decks",
      uiTheme: "compact",
    });
  });

  it("keeps every field read by the theme components", () => {
    const data = toPublicPluginData(makeContent());
    expect(data.presentations[0]).toMatchObject({
      id: "cat/talk",
      title: "Talk",
      sourcePath: "cat/talk.md",
      url: "/docs/slidev/cat/talk/",
      previewUrl: "/docs/slidev/cat/talk/",
      thumbnailUrl: "/docs/slidev/cat/talk/thumbnail.png",
      category: "cat",
      tags: ["intro"],
      level: "beginner",
    });
    expect(data.categories).toEqual(makeContent().categories);
    expect(data.playlists).toEqual(makeContent().playlists);
    expect(data.isDev).toBe(false);
  });
});

describe("registerRoutes", () => {
  it("publishes the public DTO as global data", async () => {
    const actions = makeActions();
    await registerRoutes(makeContent(), actions, "default", "/docs/");
    const published = actions.setGlobalData.mock.calls[0][0];
    expect(JSON.stringify(published)).not.toContain("/home/me");
  });

  it("prefixes the overview route with baseUrl, like category and presentation routes", async () => {
    const actions = makeActions();
    await registerRoutes(makeContent(), actions, "default", "/docs/");
    const paths = actions.addRoute.mock.calls.map(([r]) => r.path);
    expect(paths).toEqual(["/docs/slidev", "/docs/slidev/cat", "/docs/slidev/cat/talk"]);
  });

  it("normalises routeBasePath without leading slash", async () => {
    const actions = makeActions();
    await registerRoutes(makeContent({ routeBasePath: "slidev/" }), actions, "default");
    expect(actions.addRoute.mock.calls[0][0].path).toBe("/slidev");
  });

  it("serves the overview at the site root when routeBasePath is '/'", async () => {
    const actions = makeActions();
    await registerRoutes(makeContent({ routeBasePath: "/" }), actions, "default", "/");
    expect(actions.addRoute.mock.calls[0][0].path).toBe("/");
  });

  it("wires the pluginId data module into every route", async () => {
    const actions = makeActions();
    await registerRoutes(makeContent(), actions, "second");
    expect(actions.createData).toHaveBeenCalledWith("pluginId.json", JSON.stringify("second"));
    for (const [route] of actions.addRoute.mock.calls) {
      expect(route.modules).toEqual({ pluginId: "@generated/pluginId.json" });
    }
  });
});
