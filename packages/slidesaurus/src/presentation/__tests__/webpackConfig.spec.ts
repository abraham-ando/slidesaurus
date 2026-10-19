import { describe, it, expect } from "vitest";
import path from "node:path";
import type { PluginOptions } from "../../domain/types";
import { buildWebpackDevServerConfig } from "../webpackConfig";

function options(overrides: Partial<PluginOptions> = {}): PluginOptions {
  return { id: "default", routeBasePath: "/slidev", ...overrides } as PluginOptions;
}

function staticEntry(config: Record<string, unknown>) {
  return (config.devServer as { static: Array<{ directory: string; publicPath: string }> }).static[0];
}

describe("buildWebpackDevServerConfig", () => {
  it("serves the cache output under routeBasePath", () => {
    const entry = staticEntry(buildWebpackDevServerConfig("/site", options()));
    expect(entry.publicPath).toBe("/slidev");
    expect(entry.directory).toBe(path.join("/site", ".docusaurus", "slidesaurus", "default", "output"));
  });

  it("includes the site baseUrl in the public path", () => {
    const entry = staticEntry(buildWebpackDevServerConfig("/site", options(), { baseUrl: "/docs/" }));
    expect(entry.publicPath).toBe("/docs/slidev");
  });

  it("normalises routeBasePath slashes", () => {
    const entry = staticEntry(buildWebpackDevServerConfig("/site", options({ routeBasePath: "talks/" }), { baseUrl: "/" }));
    expect(entry.publicPath).toBe("/talks");
  });

  it("serves the per-locale cache for a non-default locale", () => {
    const entry = staticEntry(buildWebpackDevServerConfig("/site", options(), { baseUrl: "/fr/", locale: "fr" }));
    expect(entry.publicPath).toBe("/fr/slidev");
    expect(entry.directory).toBe(path.join("/site", ".docusaurus", "slidesaurus", "default", "i18n", "fr", "output"));
  });

  it("uses '/' when both baseUrl and routeBasePath are the root", () => {
    const entry = staticEntry(buildWebpackDevServerConfig("/site", options({ routeBasePath: "/" })));
    expect(entry.publicPath).toBe("/");
  });
});
