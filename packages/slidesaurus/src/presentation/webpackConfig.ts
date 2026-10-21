/**
 * Webpack / devServer static file configuration for Docusaurus dev mode.
 *
 * Single responsibility: build the webpack config object that serves the
 * Slidev build cache (and the dev build status file) as static files under
 * the configured routeBasePath.
 *
 * This eliminates Slidev dev-server processes and port proxying: presentations
 * are built in the background by `loadContent()` (and rebuilt on file changes
 * via `getPathsToWatch`). The output directory is NOT watched: a finished
 * build must not reload every open page — `SlidevPresentation` polls the
 * status file and reloads its own iframe instead.
 */
import { getSlidevBuildOutputDir } from "../infrastructure/fs/outputManager";
import { BUILD_STATUS_URL_SEGMENT, getBuildStatusDir } from "../infrastructure/fs/buildStatus";
import { buildRouteBase } from "../shared/utils";
import type { BuildContext, PluginOptions } from "../domain/types";

/**
 * Build the webpack devServer.static config for dev mode.
 *
 * Maps `{cacheOutputDir}/` → `{baseUrl}{routeBasePath}/` so a presentation at
 * `.docusaurus/slidesaurus/default/output/getting-started/intro/index.html`
 * is served at `http://localhost:3001/{baseUrl}slidev/getting-started/intro/` —
 * the same URL the presentations were built for (`--base`) — and
 * `{cacheDir}/status/` → `{baseUrl}{routeBasePath}/__slidesaurus__/`.
 *
 * @param context - `baseUrl` of the site and, for non-default locales, the
 *   `locale` selecting the per-locale cache. Defaults to `/` and no locale.
 * @returns The `devServer` config (the caller only uses it in dev mode).
 */
export function buildWebpackDevServerConfig(
  siteDir: string,
  options: PluginOptions,
  context: Partial<Pick<BuildContext, "baseUrl" | "locale">> = {},
): Record<string, unknown> {
  const outputDir = getSlidevBuildOutputDir(siteDir, options.id, context.locale);
  const routeBase = buildRouteBase(context.baseUrl ?? "/", options.routeBasePath);

  return {
    devServer: {
      static: [
        {
          directory: outputDir,
          publicPath: routeBase || "/",
          watch: false,
        },
        {
          directory: getBuildStatusDir(siteDir, options.id, context.locale),
          publicPath: `${routeBase}/${BUILD_STATUS_URL_SEGMENT}`,
          watch: false,
        },
      ],
    },
  };
}
