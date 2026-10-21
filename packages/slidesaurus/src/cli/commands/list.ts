import path from "node:path";
import pc from "picocolors";
import { loadPluginOptions, resolveOptions } from "../config";
import { renderTable } from "../table";
import { cliLogger } from "../output";
const { heading, warn } = cliLogger;
import { scanPresentations } from "../../application/scanner";

interface ListOptions {
  json?: boolean;
  pluginId: string;
}

export async function runList(opts: ListOptions): Promise<void> {
  const cwd = process.cwd();
  const { options: pluginOpts, configFile, pluginFound } = loadPluginOptions(cwd, opts.pluginId);
  const options = resolveOptions(pluginOpts, opts.pluginId);

  if (!configFile && !opts.json) {
    warn("No docusaurus.config.ts found — using defaults. Run from your project root.");
  }
  if (configFile && !pluginFound && !opts.json) {
    warn(`Plugin "slidesaurus" (id="${opts.pluginId}") not found in config — using defaults.`);
  }

  const result = await scanPresentations(options, {
    siteDir: cwd,
    baseUrl: "/",
  });

  if (opts.json) {
    console.log(JSON.stringify(result.presentations, null, 2));
    return;
  }

  if (result.presentations.length === 0) {
    console.log(pc.dim(`\nNo presentations found in "${path.resolve(cwd, options.path)}".`));
    return;
  }

  heading(`Presentations — ${path.relative(cwd, path.resolve(cwd, options.path))} (${result.presentations.length})`);

  renderTable(
    result.presentations.map((p) => ({
      ID: p.id,
      TITLE: p.title,
      CATEGORY: p.category || "—",
      THEME: p.theme ?? options.theme ?? "—",
      LEVEL: p.level ?? "—",
      TAGS: (p.tags ?? []).join(", ") || "—",
    })),
    [
      { header: "ID", key: "ID", maxWidth: 36 },
      { header: "TITLE", key: "TITLE", maxWidth: 40 },
      { header: "CATEGORY", key: "CATEGORY", maxWidth: 20 },
      { header: "THEME", key: "THEME", maxWidth: 16 },
      { header: "LEVEL", key: "LEVEL", maxWidth: 14 },
      { header: "TAGS", key: "TAGS", maxWidth: 30 },
    ],
  );

  if (result.categories.length > 0) {
    console.log(pc.dim(`\n  ${result.categories.length} category(ies): ${result.categories.map((c) => c.label).join(", ")}`));
  }
}
