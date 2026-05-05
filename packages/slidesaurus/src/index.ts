import path from "node:path";
import os from "node:os";
import type { LoadContext, Plugin } from "@docusaurus/types";
import { Joi } from "@docusaurus/utils-validation";
import type { PluginOptions, PluginContentData } from "./types";
import { PLUGIN_NAME } from "./constants";
import { scanPresentations } from "./scanner";
import { buildAllPresentations, checkSlidevInstalled } from "./builder";
import { log } from "./logger";
import {
  cleanupSourceDirectory,
  getSlidevBuildOutputDir,
  copyBuiltPresentationsToOutput,
  createPresenterFallbacks,
  writeSearchIndex,
} from "./fileSystem";
import { stripSlashes } from "./utils";


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
  autoInstall: true,
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

function processDeprecated(opts: Record<string, unknown>): Record<string, unknown> {
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

async function runListCommand(options: PluginOptions, context: LoadContext): Promise<void> {
  const result = await scanPresentations(options, { siteDir: context.siteDir, baseUrl: context.baseUrl });
  if (result.presentations.length === 0) { console.log("No presentations found."); return; }
  console.log(`\nFound ${result.presentations.length} presentation(s) in "${options.path}":\n`);
  for (const p of result.presentations) {
    const meta: string[] = [];
    if (p.author) meta.push(`author: ${p.author}`);
    if (p.level) meta.push(`level: ${p.level}`);
    if (p.duration !== undefined) meta.push(`${p.duration} min`);
    if (p.deprecated) meta.push("DEPRECATED");
    const metaStr = meta.length ? `  [${meta.join(", ")}]` : "";
    const prefix = p.category ? `${p.category}/` : "";
    console.log(`  ${prefix}${path.basename(p.sourcePath)}  →  ${p.title}${metaStr}`);
  }
}

async function runStatsCommand(options: PluginOptions, context: LoadContext): Promise<void> {
  const result = await scanPresentations(options, { siteDir: context.siteDir, baseUrl: context.baseUrl });
  const ps = result.presentations;
  if (ps.length === 0) { console.log("No presentations found."); return; }
  const authors = [...new Set(ps.map((p) => p.author).filter(Boolean))];
  const tags = [...new Set(ps.flatMap((p) => p.tags ?? []))].sort();
  const levels = [...new Set(ps.map((p) => p.level).filter(Boolean))].sort();
  const deprecated = ps.filter((p) => p.deprecated).length;
  const missing = ps.filter((p) => !p.description || !p.author).length;
  console.log(`\nSlidev presentations — "${options.path}"`);
  console.log(`  Total:       ${ps.length}`);
  console.log(`  Authors:     ${authors.length > 0 ? authors.join(", ") : "—"}`);
  console.log(`  Tags:        ${tags.length > 0 ? tags.join(", ") : "—"}`);
  console.log(`  Levels:      ${levels.length > 0 ? levels.join(", ") : "—"}`);
  console.log(`  Deprecated:  ${deprecated}`);
  console.log(`  Incomplete:  ${missing} (missing description or author)`);
  if (result.playlists.length > 0) {
    console.log(`  Playlists:   ${result.playlists.length}`);
    for (const pl of result.playlists) {
      console.log(`    • ${pl.title} (${pl.items.length} items)`);
    }
  }
}

async function runValidateCommand(options: PluginOptions, context: LoadContext): Promise<void> {
  const result = await scanPresentations(options, { siteDir: context.siteDir, baseUrl: context.baseUrl });
  const total = result.presentations.length;
  console.log(`\nScanned ${total} presentation(s) in "${options.path}"\n`);
  if (total === 0) return;
  let warnings = 0;
  for (const p of result.presentations) {
    const issues: string[] = [];
    if (!p.description) issues.push("no description");
    if (!p.author) issues.push("no author");
    if (p.deprecated) issues.push("deprecated — consider removing or updating");
    if (issues.length > 0) { console.log(`  ⚠  ${p.id}:  ${issues.join(", ")}`); warnings += issues.length; }
  }
  if (warnings === 0) { console.log("  ✓  All presentations look good."); }
  else { console.log(`\n${warnings} suggestion(s) across ${total} presentation(s).`); }
}

export default function pluginSlidev(
  context: LoadContext,
  opts: Partial<PluginOptions>,
): Plugin<PluginContentData> {
  const processedOpts = processDeprecated(opts as Record<string, unknown>);
  const options: PluginOptions = { ...DEFAULT_OPTIONS, ...processedOpts } as PluginOptions;

  const isDev = process.env.NODE_ENV === "development";

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
      const scanResult = await scanPresentations(options, {
        siteDir: context.siteDir,
        baseUrl: context.baseUrl,
      });

      const { presentations, categories, playlists } = scanResult;

      if (presentations.length > 0) {
        const slidevInstalled = checkSlidevInstalled(context.siteDir);
        if (!slidevInstalled) {
          log.warn(`Slidev CLI not installed. Presentations will not be ${isDev ? "available in dev mode" : "built"}. Install with: pnpm add @slidev/cli`);
        } else {
          // Build presentations for both dev and production.
          // In dev mode, the built output is served by webpack devServer.static (see configureWebpack).
          const sourcePath = path.join(context.siteDir, options.path);
          cleanupSourceDirectory(sourcePath);

          if (!options.dryRun) {
            await buildAllPresentations(presentations, options, {
              siteDir: context.siteDir,
              baseUrl: context.baseUrl,
            });
          } else {
            log.info(`Dry-run mode: skipping build for ${presentations.length} presentation(s).`);
          }
        }
      }

      return { presentations, categories, playlists, config: options, isDev };
    },

    async contentLoaded({ content, actions }) {
      const { setGlobalData, addRoute, createData } = actions;
      const { presentations, categories, config } = content;

      setGlobalData(content);

      // Create a JSON module containing the pluginId so each route component
      // can call usePluginData(name, pluginId) — required for multi-instance.
      const pluginIdPath = await createData(
        "pluginId.json",
        JSON.stringify(options.id),
      );

      // Overview page
      addRoute({
        path: config.routeBasePath,
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

      // Individual presentation pages
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
    },

    async postBuild({ outDir, content: postBuildContent }) {
      const presentations = postBuildContent?.presentations;
      if (isDev || !presentations?.length) return;

      const cacheOutputDir = getSlidevBuildOutputDir(context.siteDir, options.id);
      const routeDir = stripSlashes(options.routeBasePath);
      const finalOutputDir = path.join(outDir, routeDir);
      copyBuiltPresentationsToOutput(cacheOutputDir, finalOutputDir);
      log.info(`Copied ${presentations.length} presentation(s) to final output`);
      createPresenterFallbacks(finalOutputDir, presentations);
      writeSearchIndex(outDir, routeDir, presentations);
    },

    extendCli(cli) {
      cli.command("slidev:list").description("List all Slidev presentations discovered in the configured path")
        .action(() => runListCommand(options, context));
      cli.command("slidev:stats").description("Print statistics about discovered presentations")
        .action(() => runStatsCommand(options, context));
      cli.command("slidev:validate").description("Scan presentations and report metadata issues without building")
        .action(() => runValidateCommand(options, context));
    },

    configureWebpack() {
      if (!isDev) return {};

      // Serve the Slidev build cache as static files under the routeBasePath.
      // The cache output dir mirrors the production layout exactly:
      //   .docusaurus/slidesaurus/{id}/output/getting-started/introduction/index.html
      //   → http://localhost:3001/training/getting-started/introduction/index.html
      //
      // This eliminates all Slidev dev server processes, port management, and
      // proxy configuration. Presentations are rebuilt by loadContent() on file
      // changes (via getPathsToWatch) and webpack's file watcher picks up the
      // new static files automatically.
      const outputDir = getSlidevBuildOutputDir(context.siteDir, options.id);
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
      } as Record<string, unknown>;
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
    exportFormats: Joi.array().items(Joi.string().valid("pdf", "pptx")).default(DEFAULT_OPTIONS.exportFormats),
    routeBasePath: Joi.string().default(DEFAULT_OPTIONS.routeBasePath),
    overviewPath: Joi.string().optional(),
    pageTitle: Joi.string().default(DEFAULT_OPTIONS.pageTitle),
    overviewTitle: Joi.string().optional(),
    pageTagline: Joi.string().default(DEFAULT_OPTIONS.pageTagline),
    overviewTagline: Joi.string().optional(),
    id: Joi.string().default(DEFAULT_OPTIONS.id),
    buildTimeout: Joi.number().min(10).max(600).default(DEFAULT_OPTIONS.buildTimeout),
    verbose: Joi.boolean().default(DEFAULT_OPTIONS.verbose),
    maxParallelBuilds: Joi.number().min(1).max(64).default(DEFAULT_OPTIONS.maxParallelBuilds),
    autoInstall: Joi.boolean().default(DEFAULT_OPTIONS.autoInstall),
    dryRun: Joi.boolean().default(DEFAULT_OPTIONS.dryRun),
    withoutNotes: Joi.boolean().default(DEFAULT_OPTIONS.withoutNotes),
    exportWithClicks: Joi.boolean().default(DEFAULT_OPTIONS.exportWithClicks),
    devServerBasePort: Joi.number().integer().min(1024).max(65535).default(DEFAULT_OPTIONS.devServerBasePort),
    devServerTimeout: Joi.number().integer().min(5000).max(600000).default(DEFAULT_OPTIONS.devServerTimeout),
    onPresentationScanned: Joi.function().optional(),
    onBuildComplete: Joi.function().optional(),
    transformFrontmatter: Joi.function().optional(),
  });

  const { value, error } = schema.validate(processed);
  if (error) throw error;
  return value as PluginOptions;
}
