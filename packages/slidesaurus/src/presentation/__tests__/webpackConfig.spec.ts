import { describe, it, expect } from "vitest";
import path from "node:path";
import type { PluginOptions } from "../../domain/types";
import { buildWebpackDevServerConfig } from "../webpackConfig";

function options(overrides: Partial<PluginOptions> = {}): PluginOptions {
  return {
    id: "default",
    routeBasePath: "/slidev",
    ...overrides,
  } as PluginOptions;
}

type StaticEntry = { directory: string; publicPath: string; watch: unknown };

function staticEntry(config: Record<string, unknown>, index = 0): StaticEntry {
  return (config.devServer as { static: StaticEntry[] }).static[index];
}

describe("buildWebpackDevServerConfig", () => {
  it("serves the cache output under routeBasePath", () => {
    const entry = staticEntry(buildWebpackDevServerConfig("/site", options()));
    expect(entry.publicPath).toBe("/slidev");
    expect(entry.directory).toBe(
      path.join("/site", ".docusaurus", "slidesaurus", "default", "output"),
    );
  });

  it("includes the site baseUrl in the public path", () => {
    const entry = staticEntry(
      buildWebpackDevServerConfig("/site", options(), { baseUrl: "/docs/" }),
    );
    expect(entry.publicPath).toBe("/docs/slidev");
  });

  it("normalises routeBasePath slashes", () => {
    const entry = staticEntry(
      buildWebpackDevServerConfig(
        "/site",
        options({ routeBasePath: "talks/" }),
        { baseUrl: "/" },
      ),
    );
    expect(entry.publicPath).toBe("/talks");
  });

  it("serves the per-locale cache for a non-default locale", () => {
    const entry = staticEntry(
      buildWebpackDevServerConfig("/site", options(), {
        baseUrl: "/fr/",
        locale: "fr",
      }),
    );
    expect(entry.publicPath).toBe("/fr/slidev");
    expect(entry.directory).toBe(
      path.join(
        "/site",
        ".docusaurus",
        "slidesaurus",
        "default",
        "i18n",
        "fr",
        "output",
      ),
    );
  });

  it("uses '/' when both baseUrl and routeBasePath are the root", () => {
    const entry = staticEntry(
      buildWebpackDevServerConfig("/site", options({ routeBasePath: "/" })),
    );
    expect(entry.publicPath).toBe("/");
  });

  it("does not watch the output (no full-page reload when a build finishes)", () => {
    const config = buildWebpackDevServerConfig("/site", options());
    expect(staticEntry(config).watch).toBe(false);
    expect(staticEntry(config, 1).watch).toBe(false);
  });

  it("serves the build status directory under routeBasePath/__slidesaurus__", () => {
    const entry = staticEntry(
      buildWebpackDevServerConfig("/site", options(), { baseUrl: "/docs/" }),
      1,
    );
    expect(entry.publicPath).toBe("/docs/slidev/__slidesaurus__");
    expect(entry.directory).toBe(
      path.join("/site", ".docusaurus", "slidesaurus", "default", "status"),
    );
  });

  it("serves the status directory at the root when routeBasePath is '/'", () => {
    const entry = staticEntry(
      buildWebpackDevServerConfig("/site", options({ routeBasePath: "/" })),
      1,
    );
    expect(entry.publicPath).toBe("/__slidesaurus__");
  });
});
