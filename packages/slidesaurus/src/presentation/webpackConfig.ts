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
import { stripSlashes } from "../shared/utils";
import type { PluginOptions } from "../domain/types";

/**
 * Build the webpack devServer.static config for dev mode.
 *
 * Maps `{cacheOutputDir}/` → `/{routeDir}/` so a presentation at
 * `.docusaurus/slidesaurus/default/output/getting-started/intro/index.html`
 * is served at `http://localhost:3001/slidev/getting-started/intro/`.
 *
 * @returns Empty object when not in dev mode (caller checks `isDev`).
 */
export function buildWebpackDevServerConfig(
  siteDir: string,
  options: PluginOptions,
): Record<string, unknown> {
  const outputDir = getSlidevBuildOutputDir(siteDir, options.id);
  const routeDir = stripSlashes(options.routeBasePath);

  return {
    devServer: {
      static: [
        {
          directory: outputDir,
          publicPath: `/${routeDir}`,
          watch: { ignored: /node_modules/ },
        },
      ],
    },
  };
}
