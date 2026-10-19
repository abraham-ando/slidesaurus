/**
 * Webpack / devServer static file configuration for Docusaurus dev mode.
 *
 * Single responsibility: build the webpack config object that serves the
 * Slidev build cache as static files under the configured routeBasePath.
 *
 * This eliminates Slidev dev-server processes and port proxying: presentations
 * are rebuilt by `loadContent()` on file changes (via `getPathsToWatch`) and
 * webpack's file watcher picks up the new static files automatically.
 */
import { getSlidevBuildOutputDir } from "../infrastructure/fs/outputManager";
import { buildRouteBase } from "../shared/utils";
import type { BuildContext, PluginOptions } from "../domain/types";

/**
 * Build the webpack devServer.static config for dev mode.
 *
 * Maps `{cacheOutputDir}/` → `{baseUrl}{routeBasePath}/` so a presentation at
 * `.docusaurus/slidesaurus/default/output/getting-started/intro/index.html`
 * is served at `http://localhost:3001/{baseUrl}slidev/getting-started/intro/` —
 * the same URL the presentations were built for (`--base`).
 *
 * @param context - `baseUrl` of the site and, for non-default locales, the
 *   `locale` selecting the per-locale cache. Defaults to `/` and no locale.
 * @returns Empty object when not in dev mode (caller checks `isDev`).
 */
export function buildWebpackDevServerConfig(
  siteDir: string,
  options: PluginOptions,
  context: Partial<Pick<BuildContext, "baseUrl" | "locale">> = {},
): Record<string, unknown> {
  const outputDir = getSlidevBuildOutputDir(siteDir, options.id, context.locale);
  const publicPath = buildRouteBase(context.baseUrl ?? "/", options.routeBasePath) || "/";

  return {
    devServer: {
      static: [
        {
          directory: outputDir,
          publicPath,
          watch: { ignored: /node_modules/ },
        },
      ],
    },
  };
}
