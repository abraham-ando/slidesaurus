import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { PluginOptions } from "../types";

const PLUGIN_NAME = "slidesaurus";

const CONFIG_CANDIDATES = [
  "docusaurus.config.ts",
  "docusaurus.config.js",
  "docusaurus.config.mjs",
];

/** Minimal defaults so the CLI is usable even without a config file. */
export const CONFIG_DEFAULTS: Pick<PluginOptions, "path" | "routeBasePath" | "id"> = {
  path: "./slidev",
  routeBasePath: "/slidev",
  id: "default",
};

export interface LoadedConfig {
  options: Partial<PluginOptions>;
  configFile: string | null;
  pluginFound: boolean;
}

/** Find the docusaurus config file starting from cwd. */
export function findConfigFile(cwd: string): string | null {
  for (const name of CONFIG_CANDIDATES) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Load the plugin options for a given pluginId from the project's
 * docusaurus.config.ts/js file. Falls back to empty options if the file
 * cannot be loaded or the plugin is not found.
 */
export function loadPluginOptions(cwd: string, pluginId: string): LoadedConfig {
  const configFile = findConfigFile(cwd);
  if (!configFile) return { options: {}, configFile: null, pluginFound: false };

  try {
    const raw = execLoadConfig(configFile);
    const plugins: unknown[] = Array.isArray(raw?.plugins) ? raw.plugins : [];

    for (const entry of plugins) {
      if (!Array.isArray(entry)) continue;
      const [name, opts = {}] = entry as [unknown, Record<string, unknown>];
      if (name !== PLUGIN_NAME) continue;
      const id = (opts.id as string | undefined) ?? "default";
      if (id === pluginId) {
        return { options: opts as Partial<PluginOptions>, configFile, pluginFound: true };
      }
    }

    return { options: {}, configFile, pluginFound: false };
  } catch {
    return { options: {}, configFile, pluginFound: false };
  }
}

/**
 * Execute the config file using ts-node (for .ts) or node (for .js/.mjs).
 *
 * ⚠️ Security surface: this function executes the project's docusaurus.config file
 * as JavaScript in a child process. This is intentional (it's the only way to read
 * a Docusaurus config) and consistent with how webpack, ESLint, and other tools work.
 * Never call this on a config file outside the project's own directory.
 */
function execLoadConfig(configFile: string): Record<string, unknown> {
  const isTs = configFile.endsWith(".ts");

  let script: string;
  if (isTs) {
    // Resolve ts-node from the CLI binary's own node_modules tree so it works
    // regardless of whether the user project has ts-node installed.
    const tsNodePath = resolveTsNode();
    if (!tsNodePath) throw new Error("ts-node not found");
    // Pass explicit compiler options compatible with TypeScript 6.x.
    // ts-node 10.x defaults to moduleResolution=node10 which TypeScript 6 has deprecated;
    // ignoreDeprecations silences the error while preserving CJS-compatible behavior.
    const tsOpts = JSON.stringify({
      module: "CommonJS",
      moduleResolution: "node",
      ignoreDeprecations: "6.0",
      target: "ES2020",
      esModuleInterop: true,
      skipLibCheck: true,
    });
    script = [
      `require(${JSON.stringify(tsNodePath)}).register({ transpileOnly: true, skipProject: true, compilerOptions: ${tsOpts} });`,
      `const m = require(${JSON.stringify(configFile)});`,
      "process.stdout.write(JSON.stringify(m.default || m));",
    ].join("\n");
  } else {
    script = [
      `const m = require(${JSON.stringify(configFile)});`,
      "process.stdout.write(JSON.stringify(m.default || m));",
    ].join("\n");
  }

  const output = execFileSync(process.execPath, ["-e", script], {
    cwd: path.dirname(configFile),
    encoding: "utf-8",
    timeout: 15_000,
    // Suppress child stderr so it doesn't pollute the CLI output
    stdio: ["pipe", "pipe", "pipe"],
  });

  return JSON.parse(output);
}

/**
 * Resolve the absolute path to ts-node from the CLI package's own node_modules.
 * This allows the CLI to load TypeScript config files even when the user's
 * project does not have ts-node installed directly.
 */
function resolveTsNode(): string | null {
  try {
    // __dirname is lib/ at runtime; resolve from lib/ → packages/plugin/ → monorepo root
    return require.resolve("ts-node", { paths: [__dirname, path.join(__dirname, "..")] });
  } catch {
    return null;
  }
}

/** Merge loaded config with defaults. */
export function resolveOptions(loaded: Partial<PluginOptions>, pluginId: string): PluginOptions & typeof CONFIG_DEFAULTS {
  return {
    ...CONFIG_DEFAULTS,
    id: pluginId,
    ...loaded,
  } as PluginOptions & typeof CONFIG_DEFAULTS;
}
