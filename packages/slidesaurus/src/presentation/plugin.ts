/**
 * Slidesaurus plugin entry point — pure orchestrator.
 *
 * Delegates every concern to a focused module:
 *   scanner       → presentation discovery
 *   builder       → parallel incremental builds
 *   routeBuilder  → Docusaurus route registration
 *   cliCommands   → `slidev:*` CLI commands
 *   webpackConfig → dev-server static file serving
 *   outputManager → postBuild file copying
 */
import path from "node:path";
import type { LoadContext, Plugin } from "@docusaurus/types";
import * as utilsValidation from "@docusaurus/utils-validation";
import type { PluginOptions, PluginContentData } from "../domain/types";
import { PLUGIN_NAME } from "../domain/constants";
import { scanPresentations } from "../application/scanner";
import {
  assertBuildSucceeded,
  buildAllPresentations,
  checkSlidevInstalled,
  collectBuildFailures,
} from "../application/builder";
import { log } from "../shared/logger";
import { cleanupSourceDirectory } from "../infrastructure/fs/fileSystem";
import {
  getSlidevBuildOutputDir,
  copyBuiltPresentationsToOutput,
  createPresenterFallbacks,
  writeSearchIndex,
} from "../infrastructure/fs/outputManager";
import { defaultMaxParallelBuilds, stripSlashes } from "../shared/utils";
import { registerRoutes } from "./routeBuilder";
import { registerCliCommands } from "./cliCommands";
import { buildWebpackDevServerConfig } from "./webpackConfig";

const DEFAULT_OPTIONS: PluginOptions = {
  path: "./slidev",
  download: false,
  exportFormats: ["pdf"],
  routeBasePath: "/slidev",
  pageTitle: "Slidev Presentations",
  pageTagline: "Interactive presentation overview",
  id: "default",
  addons: [],
  // Seconds per presentation. A cold `slidev build` (first run after an
  // install, Windows antivirus, several builds in parallel) often exceeds 2 min.
  buildTimeout: 300,
  verbose: false,
  maxParallelBuilds: defaultMaxParallelBuilds(),
  // OWASP A05 — Principle of Least Privilege: auto-installing packages (pnpm add) must
  // be an explicit opt-in, not an invisible default that runs in CI/production environments.
  autoInstall: false,
  dryRun: false,
  withoutNotes: false,
  exportWithClicks: false,
  uiTheme: "default",
};

// @docusaurus/utils-validation is CommonJS: Node's ESM loader cannot detect its
// `Joi` named export (lib/index.mjs), and it has no default export for the
// CJS bundle. Under ESM the namespace exposes module.exports as `default`.
const { Joi } = ((utilsValidation as { default?: typeof utilsValidation })
  .default ?? utilsValidation) as typeof utilsValidation;

export type SlidesaurusPluginOptions = Partial<PluginOptions>;

const DEPRECATED: Record<string, string> = {
  sourceDir: "path",
  overviewPath: "routeBasePath",
  overviewTitle: "pageTitle",
  overviewTagline: "pageTagline",
};

/** Options of the removed per-presentation dev servers — accepted, ignored. */
const NO_EFFECT = ["devServerBasePort", "devServerTimeout"] as const;

function processDeprecated(
  opts: Record<string, unknown>,
): Record<string, unknown> {
  const processed = { ...opts };
  for (const [oldName, newName] of Object.entries(DEPRECATED)) {
    if (!(oldName in processed)) continue;
    if (newName in processed) {
      log.warn(
        `Deprecated option "${oldName}" ignored: "${newName}" is also set and takes precedence`,
      );
    } else {
      log.warn(`Deprecated option "${oldName}": use "${newName}" instead`);
      processed[newName] = processed[oldName];
    }
    delete processed[oldName];
  }
  for (const name of NO_EFFECT) {
    if (name in processed) {
      log.warn(
        `Deprecated option "${name}" has no effect: presentations are now built and served statically in dev mode`,
      );
    }
  }
  return processed;
}

export default function pluginSlidev(
  context: LoadContext,
  opts: SlidesaurusPluginOptions,
): Plugin<PluginContentData> {
  const options: PluginOptions = {
    ...DEFAULT_OPTIONS,
    ...opts,
  } as PluginOptions;
  const isDev = process.env.NODE_ENV === "development";
  // Non-default locales get their own build cache (their baseUrl differs).
  // `i18n` is optional here so the plugin also works with a minimal context
  // (programmatic use, smoke tests).
  const i18n = context.i18n as LoadContext["i18n"] | undefined;
  const buildContext = {
    siteDir: context.siteDir,
    baseUrl: context.baseUrl,
    locale:
      i18n && i18n.currentLocale !== i18n.defaultLocale
        ? i18n.currentLocale
        : undefined,
  };

  return {
    name: PLUGIN_NAME,

    // `__dirname` is the bundle directory (lib/) — native in lib/index.cjs,
    // shimmed from import.meta.url in lib/index.mjs (see rollup.config.mjs).
    getThemePath() {
      // Compiled JS: Docusaurus does not transpile TSX from node_modules.
      return path.resolve(__dirname, "theme");
    },

    getTypeScriptThemePath() {
      // Raw TSX sources, used by `docusaurus swizzle --typescript`.
      return path.resolve(__dirname, "../theme");
    },

    getPathsToWatch() {
      const slidevDir = path.resolve(context.siteDir, options.path);
      return [
        `${slidevDir}/**/*.{md,vue,ts,js,json,yml,yaml}`,
        `${slidevDir}/**/*.{css,scss,sass,less,postcss}`,
        `${slidevDir}/**/*.{png,jpg,jpeg,gif,svg,webp,avif,ico,mp4,webm}`,
      ];
    },

    async loadContent(): Promise<PluginContentData> {
      const { presentations, categories, playlists } = await scanPresentations(
        options,
        buildContext,
      );

      if (presentations.length > 0) {
        if (checkSlidevInstalled(context.siteDir)) {
          cleanupSourceDirectory(path.join(context.siteDir, options.path));

          if (options.dryRun) {
            log.info(
              `Dry-run mode: skipping build for ${presentations.length} presentation(s).`,
            );
          } else {
            const results = await buildAllPresentations(
              presentations,
              options,
              buildContext,
            );
            if (isDev) {
              for (const failure of collectBuildFailures(results)) {
                log.error(
                  `Presentation "${failure.id}" failed to build: ${failure.error ?? "unknown error"}`,
                );
              }
            } else {
              // A broken deck must fail `docusaurus build`, not ship a 404.
              assertBuildSucceeded(results);
            }
          }
        } else {
          log.warn(
            `Slidev CLI not installed. Presentations will not be ${isDev ? "available in dev mode" : "built"}. Install with: pnpm add @slidev/cli`,
          );
        }
      }

      return { presentations, categories, playlists, config: options, isDev };
    },

    async contentLoaded({ content, actions }) {
      await registerRoutes(content, actions, options.id, context.baseUrl);
    },

    async postBuild({ outDir, content: postBuildContent }) {
      const presentations = postBuildContent?.presentations;
      if (isDev || !presentations?.length) return;
      const cacheOutputDir = getSlidevBuildOutputDir(
        context.siteDir,
        options.id,
        buildContext.locale,
      );
      const routeDir = stripSlashes(options.routeBasePath);
      const finalOutputDir = path.join(outDir, routeDir);
      copyBuiltPresentationsToOutput(cacheOutputDir, finalOutputDir);
      log.info(
        `Copied ${presentations.length} presentation(s) to final output`,
      );
      createPresenterFallbacks(finalOutputDir, presentations);
      writeSearchIndex(outDir, routeDir, presentations);
    },

    extendCli(cli) {
      registerCliCommands(cli, options, buildContext);
    },

    configureWebpack() {
      if (!isDev) return {};
      return buildWebpackDevServerConfig(context.siteDir, options, buildContext);
    },
  };
}

export function getSwizzleComponentList(): string[] {
  return [
    "SlidevOverview",
    "SlidevCard",
    "SlidevListItem",
    "SlidevCategoryCard",
    "SlidevPresentation",
  ];
}
export function validateOptions({
  options,
}: {
  options: Record<string, unknown>;
  validate: (schema: unknown, options: unknown) => unknown;
}): PluginOptions {
  const schema = Joi.object({
    path: Joi.string().default(DEFAULT_OPTIONS.path),
    sourceDir: Joi.string().optional(),
    // No default: decks without a frontmatter theme keep Slidev's own default.
    theme: Joi.string().optional(),
    addons: Joi.array().items(Joi.string()).default(DEFAULT_OPTIONS.addons),
    download: Joi.boolean().default(DEFAULT_OPTIONS.download),
    exportFormats: Joi.array()
      .items(Joi.string().valid("pdf", "pptx"))
      .default(DEFAULT_OPTIONS.exportFormats),
    routeBasePath: Joi.string()
      .pattern(/^\/(?!.*\.\.)/, "absolute URL path without '..'")
      .default(DEFAULT_OPTIONS.routeBasePath),
    overviewPath: Joi.string().optional(),
    pageTitle: Joi.string().default(DEFAULT_OPTIONS.pageTitle),
    overviewTitle: Joi.string().optional(),
    pageTagline: Joi.string().default(DEFAULT_OPTIONS.pageTagline),
    overviewTagline: Joi.string().optional(),
    id: Joi.string()
      .pattern(/^[a-zA-Z0-9_-]+$/, "letters, digits, '_' and '-'")
      .default(DEFAULT_OPTIONS.id),
    buildTimeout: Joi.number()
      .min(10)
      .max(600)
      .default(DEFAULT_OPTIONS.buildTimeout),
    verbose: Joi.boolean().default(DEFAULT_OPTIONS.verbose),
    maxParallelBuilds: Joi.number()
      .min(1)
      .max(64)
      .default(DEFAULT_OPTIONS.maxParallelBuilds),
    autoInstall: Joi.boolean().default(DEFAULT_OPTIONS.autoInstall),
    dryRun: Joi.boolean().default(DEFAULT_OPTIONS.dryRun),
    withoutNotes: Joi.boolean().default(DEFAULT_OPTIONS.withoutNotes),
    exportWithClicks: Joi.boolean().default(DEFAULT_OPTIONS.exportWithClicks),
    // Deprecated, no effect (see NO_EFFECT).
    devServerBasePort: Joi.number().optional(),
    devServerTimeout: Joi.number().optional(),
    // Any string is valid — built-ins are "default" | "compact" | "minimal".
    // Custom values are passed as-is to data-slidev-ui-theme on component roots.
    uiTheme: Joi.string().default(DEFAULT_OPTIONS.uiTheme),
    onPresentationScanned: Joi.function().optional(),
    onBuildComplete: Joi.function().optional(),
    transformFrontmatter: Joi.function().optional(),
  });

  const processed = processDeprecated(options);
  const { value, error } = schema.validate(processed);
  if (error) throw error;

  // OWASP A01 — Broken Access Control: reject paths that could escape the site directory.
  const slidevPath = value.path as string;
  if (path.isAbsolute(slidevPath)) {
    throw new Error(
      `[Security] Plugin option "path" must be a relative path, got absolute: "${slidevPath}"`,
    );
  }
  const normalized = path.normalize(slidevPath);
  if (normalized.startsWith("..")) {
    throw new Error(
      `[Security] Plugin option "path" must not traverse above the site directory: "${slidevPath}"`,
    );
  }

  return value as PluginOptions;
}
