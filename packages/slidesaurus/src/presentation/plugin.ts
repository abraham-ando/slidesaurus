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
import os from "node:os";
import type { LoadContext, Plugin } from "@docusaurus/types";
import { Joi } from "@docusaurus/utils-validation";
import type { PluginOptions, PluginContentData } from "../domain/types";
import { PLUGIN_NAME } from "../domain/constants";
import { scanPresentations } from "../application/scanner";
import {
  buildAllPresentations,
  checkSlidevInstalled,
} from "../application/builder";
import { log } from "../shared/logger";
import { cleanupSourceDirectory } from "../infrastructure/fs/fileSystem";
import {
  getSlidevBuildOutputDir,
  copyBuiltPresentationsToOutput,
  createPresenterFallbacks,
  writeSearchIndex,
} from "../infrastructure/fs/outputManager";
import { stripSlashes } from "../shared/utils";
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
  theme: "unicorn",
  addons: [],
  buildTimeout: 120,
  verbose: false,
  maxParallelBuilds: Math.max(1, os.cpus().length - 1),
  // OWASP A05 — Principle of Least Privilege: auto-installing packages (pnpm add) must
  // be an explicit opt-in, not an invisible default that runs in CI/production environments.
  autoInstall: false,
  dryRun: false,
  withoutNotes: false,
  exportWithClicks: false,
  devServerBasePort: 8600,
  devServerTimeout: 60000,
};

const DEPRECATED: Record<string, string> = {
  sourceDir: "path",
  overviewPath: "routeBasePath",
  overviewTitle: "pageTitle",
  overviewTagline: "pageTagline",
};

function processDeprecated(
  opts: Record<string, unknown>,
): Record<string, unknown> {
  const processed = { ...opts };
  for (const [oldName, newName] of Object.entries(DEPRECATED)) {
    if (oldName in processed && !(newName in processed)) {
      log.warn(`Deprecated option "${oldName}": use "${newName}" instead`);
      processed[newName] = processed[oldName];
      delete processed[oldName];
    }
  }
  return processed;
}

export default function pluginSlidev(
  context: LoadContext,
  opts: Partial<PluginOptions>,
): Plugin<PluginContentData> {
  const processedOpts = processDeprecated(opts as Record<string, unknown>);
  const options: PluginOptions = {
    ...DEFAULT_OPTIONS,
    ...processedOpts,
  } as PluginOptions;
  const isDev = process.env.NODE_ENV === "development";
  const buildContext = { siteDir: context.siteDir, baseUrl: context.baseUrl };

  return {
    name: PLUGIN_NAME,

    getThemePath() {
      return path.resolve(__dirname, "../theme");
    },

    getPathsToWatch() {
      const slidevDir = path.resolve(context.siteDir, options.path);
      return [
        `${slidevDir}/**/*.md`,
        `${slidevDir}/**/*.{png,jpg,jpeg,gif,svg,webp,css}`,
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
            await buildAllPresentations(presentations, options, buildContext);
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
      await registerRoutes(content, actions, options.id);
    },

    async postBuild({ outDir, content: postBuildContent }) {
      const presentations = postBuildContent?.presentations;
      if (isDev || !presentations?.length) return;
      const cacheOutputDir = getSlidevBuildOutputDir(
        context.siteDir,
        options.id,
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
      return buildWebpackDevServerConfig(context.siteDir, options);
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
  const processed = processDeprecated(options);

  const schema = Joi.object({
    path: Joi.string().default(DEFAULT_OPTIONS.path),
    sourceDir: Joi.string().optional(),
    theme: Joi.string().default(DEFAULT_OPTIONS.theme),
    addons: Joi.array().items(Joi.string()).default(DEFAULT_OPTIONS.addons),
    download: Joi.boolean().default(DEFAULT_OPTIONS.download),
    exportFormats: Joi.array()
      .items(Joi.string().valid("pdf", "pptx"))
      .default(DEFAULT_OPTIONS.exportFormats),
    routeBasePath: Joi.string().default(DEFAULT_OPTIONS.routeBasePath),
    overviewPath: Joi.string().optional(),
    pageTitle: Joi.string().default(DEFAULT_OPTIONS.pageTitle),
    overviewTitle: Joi.string().optional(),
    pageTagline: Joi.string().default(DEFAULT_OPTIONS.pageTagline),
    overviewTagline: Joi.string().optional(),
    id: Joi.string().default(DEFAULT_OPTIONS.id),
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
    devServerBasePort: Joi.number()
      .integer()
      .min(1024)
      .max(65535)
      .default(DEFAULT_OPTIONS.devServerBasePort),
    devServerTimeout: Joi.number()
      .integer()
      .min(5000)
      .max(600000)
      .default(DEFAULT_OPTIONS.devServerTimeout),
    onPresentationScanned: Joi.function().optional(),
    onBuildComplete: Joi.function().optional(),
    transformFrontmatter: Joi.function().optional(),
  });

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
