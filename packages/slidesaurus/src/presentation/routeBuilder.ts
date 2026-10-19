/**
 * Docusaurus route registration for Slidev presentations.
 *
 * Single responsibility: translate the scan result (presentations, categories)
 * into `addRoute()` calls and the global data store (`setGlobalData()`).
 * No filesystem access — pure Docusaurus API calls.
 */
import type { PluginContentData, PluginData, Presentation } from "../domain/types";
import { buildRouteBase } from "../shared/utils";

/** Minimal subset of Docusaurus `contentLoaded` actions used here. */
interface RouteActions {
  setGlobalData(data: unknown): void;
  addRoute(route: {
    path: string;
    component: string;
    modules: Record<string, string>;
    exact: boolean;
  }): void;
  createData(name: string, data: string): Promise<string>;
}

/**
 * Reduce the server-side content to the data the theme components need.
 *
 * Global data is serialised into the client bundle of EVERY page: absolute
 * filesystem paths (`sourceAbsolutePath`, `outputPath`), hooks and build
 * options must never leak there. Only the fields read by the theme are kept
 * (see `Presentation` / `PluginConfig` in domain/types.ts).
 */
export function toPublicPluginData(content: PluginContentData): PluginData {
  const presentations: Presentation[] = content.presentations.map((p) => {
    const { sourceAbsolutePath: _abs, outputPath: _out, ...publicFields } = p;
    return publicFields;
  });
  const { routeBasePath, path, pageTitle, pageTagline, uiTheme } = content.config;
  return {
    presentations,
    categories: content.categories,
    playlists: content.playlists,
    config: { routeBasePath, path, pageTitle, pageTagline, uiTheme },
    isDev: content.isDev,
  };
}

/**
 * Register all plugin routes and set global data.
 *
 * Creates:
 *  - One overview route (and one per category sub-page)
 *  - One route per individual presentation
 *  - A `pluginId.json` data module so theme components can call
 *    `usePluginData(PLUGIN_NAME, pluginId)` in multi-instance setups.
 *
 * @param baseUrl - Site `baseUrl` (`context.baseUrl`). Docusaurus routes are
 *   absolute and include it — category and presentation URLs already do.
 */
export async function registerRoutes(
  content: PluginContentData,
  actions: RouteActions,
  pluginId: string,
  baseUrl = "/",
): Promise<void> {
  const { setGlobalData, addRoute, createData } = actions;
  const { presentations, categories, config } = content;

  setGlobalData(toPublicPluginData(content));

  // Create a JSON module containing the pluginId so each route component
  // can call usePluginData(name, pluginId) — required for multi-instance.
  const pluginIdPath = await createData("pluginId.json", JSON.stringify(pluginId));

  // Overview page — same prefix as category / presentation routes.
  addRoute({
    path: buildRouteBase(baseUrl, config.routeBasePath) || "/",
    component: "@theme/SlidevOverview",
    modules: { pluginId: pluginIdPath },
    exact: true,
  });

  // Category sub-pages
  for (const category of categories) {
    addRoute({
      path: category.url,
      component: "@theme/SlidevOverview",
      modules: { pluginId: pluginIdPath },
      exact: true,
    });
  }

  // Individual presentation pages — strip trailing slash for React Router compat.
  for (const presentation of presentations) {
    const routePath = presentation.url.endsWith("/")
      ? presentation.url.slice(0, -1)
      : presentation.url;
    addRoute({
      path: routePath,
      component: "@theme/SlidevPresentation",
      modules: { pluginId: pluginIdPath },
      exact: true,
    });
  }
}
