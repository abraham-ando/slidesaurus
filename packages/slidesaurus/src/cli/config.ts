import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { PluginOptions } from "../domain/types";
import { cliLogger } from "./output";

const PLUGIN_NAME = "slidesaurus";

/** Maximum time allowed to evaluate the project's docusaurus config. */
const CONFIG_LOAD_TIMEOUT_MS = 15_000;

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
 * docusaurus.config.ts/js/mjs file. Falls back to empty options if the plugin
 * is not found, or — with a warning — if the file cannot be loaded.
 */
export function loadPluginOptions(cwd: string, pluginId: string): LoadedConfig {
  const configFile = findConfigFile(cwd);
  if (!configFile) return { options: {}, configFile: null, pluginFound: false };

  let raw: Record<string, unknown>;
  try {
    raw = execLoadConfig(configFile);
  } catch (err) {
    cliLogger.warn(
      `Could not load ${path.basename(configFile)} (${describeLoadError(err)}). ` +
        "Falling back to default plugin options.",
    );
    return { options: {}, configFile, pluginFound: false };
  }

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
}

/**
 * Evaluate the config file with jiti — the loader Docusaurus itself uses — so
 * .ts, .js and .mjs configs, as well as configs exporting an (async) function,
 * are all supported. Runs in a child process with a timeout so a misbehaving
 * config cannot hang or pollute the CLI process.
 *
 * ⚠️ Security surface: this function executes the project's docusaurus.config file
 * as JavaScript in a child process. This is intentional (it's the only way to read
 * a Docusaurus config) and consistent with how webpack, ESLint, and other tools work.
 * Never call this on a config file outside the project's own directory.
 */
function execLoadConfig(configFile: string): Record<string, unknown> {
  // Resolve jiti from the CLI package's own dependencies so it works regardless
  // of what the user project has installed.
  const jitiPath = require.resolve("jiti");
  const script = [
    `const { createJiti } = require(${JSON.stringify(jitiPath)});`,
    `const file = ${JSON.stringify(configFile)};`,
    "const jiti = createJiti(file, { interopDefault: true, moduleCache: false });",
    "jiti.import(file, { default: true })",
    "  .then((m) => (typeof m === 'function' ? m() : m))",
    "  .then((config) => process.stdout.write(JSON.stringify(config ?? {})))",
    "  .catch((err) => { process.stderr.write(String((err && err.message) || err)); process.exit(1); });",
  ].join("\n");

  const output = execFileSync(process.execPath, ["-e", script], {
    cwd: path.dirname(configFile),
    encoding: "utf-8",
    timeout: CONFIG_LOAD_TIMEOUT_MS,
    // Capture child stderr so it doesn't pollute the CLI output
    stdio: ["pipe", "pipe", "pipe"],
  });

  return JSON.parse(output);
}

/** Extract a short, single-line reason from a config loading failure. */
function describeLoadError(err: unknown): string {
  const e = err as { stderr?: unknown; message?: unknown; signal?: unknown } | null;
  if (e?.signal === "SIGTERM") return `timed out after ${CONFIG_LOAD_TIMEOUT_MS / 1000}s`;
  const stderr = typeof e?.stderr === "string" ? e.stderr.trim() : "";
  const message = stderr || (typeof e?.message === "string" ? e.message : String(err));
  return message.split(/\r?\n/)[0];
}

/** Options as the CLI sees them: whatever the config sets, plus the defaults it needs. */
export type CliOptions = Partial<PluginOptions> & typeof CONFIG_DEFAULTS;

/** Merge loaded config with defaults. */
export function resolveOptions(loaded: Partial<PluginOptions>, pluginId: string): CliOptions {
  return {
    ...CONFIG_DEFAULTS,
    id: pluginId,
    ...loaded,
  };
}
