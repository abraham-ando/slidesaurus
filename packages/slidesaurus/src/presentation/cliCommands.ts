/**
 * CLI command implementations for the `slidev:*` Docusaurus CLI commands.
 *
 * Single responsibility: format and print scan results to stdout.
 * Extension point: `registerCliCommands` accepts additional `ICliCommand`
 * objects so third-party commands can be plugged in without modifying this file.
 */
import path from "node:path";
import type { PluginOptions, BuildContext } from "../domain/types";
import type { ICliCommand } from "../domain/interfaces";
import { scanPresentations } from "../application/scanner";

/** Lazy-evaluated scan result — shared across all commands in one CLI invocation. */
export type ScanGetter = () => ReturnType<typeof scanPresentations>;

// ── Built-in commands ─────────────────────────────────────────────────────────

export async function runListCommand(
  options: PluginOptions,
  getScan: ScanGetter,
): Promise<void> {
  const result = await getScan();
  if (result.presentations.length === 0) {
    console.log("No presentations found.");
    return;
  }
  console.log(
    `\nFound ${result.presentations.length} presentation(s) in "${options.path}":\n`,
  );
  for (const p of result.presentations) {
    const meta: string[] = [];
    if (p.author) meta.push(`author: ${p.author}`);
    if (p.level) meta.push(`level: ${p.level}`);
    if (p.duration !== undefined) meta.push(`${p.duration} min`);
    if (p.deprecated) meta.push("DEPRECATED");
    const metaStr = meta.length ? `  [${meta.join(", ")}]` : "";
    const prefix = p.category ? `${p.category}/` : "";
    console.log(
      `  ${prefix}${path.basename(p.sourcePath, ".md")}  →  ${p.title}${metaStr}`,
    );
  }
}

export async function runStatsCommand(
  options: PluginOptions,
  getScan: ScanGetter,
): Promise<void> {
  const result = await getScan();
  const ps = result.presentations;
  if (ps.length === 0) {
    console.log("No presentations found.");
    return;
  }
  const authors = [...new Set(ps.map((p) => p.author).filter(Boolean))];
  const tags = [...new Set(ps.flatMap((p) => p.tags ?? []))].sort();
  const levels = [...new Set(ps.map((p) => p.level).filter(Boolean))].sort();
  const deprecated = ps.filter((p) => p.deprecated).length;
  const missing = ps.filter((p) => !p.description || !p.author).length;
  console.log(`\nSlidev presentations — "${options.path}"`);
  console.log(`  Total:       ${ps.length}`);
  console.log(
    `  Authors:     ${authors.length > 0 ? authors.join(", ") : "—"}`,
  );
  console.log(`  Tags:        ${tags.length > 0 ? tags.join(", ") : "—"}`);
  console.log(`  Levels:      ${levels.length > 0 ? levels.join(", ") : "—"}`);
  console.log(`  Deprecated:  ${deprecated}`);
  console.log(`  Incomplete:  ${missing} (missing description or author)`);
  if (result.playlists.length > 0) {
    console.log(`  Playlists:   ${result.playlists.length}`);
    for (const pl of result.playlists)
      console.log(`    • ${pl.title} (${pl.items.length} items)`);
  }
}

export async function runValidateCommand(
  options: PluginOptions,
  getScan: ScanGetter,
): Promise<void> {
  const result = await getScan();
  const total = result.presentations.length;
  console.log(`\nScanned ${total} presentation(s) in "${options.path}"\n`);
  if (total === 0) return;
  let warnings = 0;
  for (const p of result.presentations) {
    const issues: string[] = [];
    if (!p.description) issues.push("no description");
    if (!p.author) issues.push("no author");
    if (p.deprecated) issues.push("deprecated — consider removing or updating");
    if (issues.length > 0) {
      console.log(`  ⚠  ${p.id}:  ${issues.join(", ")}`);
      warnings += issues.length;
    }
  }
  if (warnings === 0) console.log("  ✓  All presentations look good.");
  else
    console.log(`\n${warnings} suggestion(s) across ${total} presentation(s).`);
}

// ── Built-in ICliCommand implementations ─────────────────────────────────────

class ListCommand implements ICliCommand {
  readonly name = "slidev:list";
  readonly description =
    "List all Slidev presentations discovered in the configured path";
  async action(options: PluginOptions, context: BuildContext): Promise<void> {
    const getScan = () => scanPresentations(options, context);
    await runListCommand(options, getScan);
  }
}

class StatsCommand implements ICliCommand {
  readonly name = "slidev:stats";
  readonly description = "Print statistics about discovered presentations";
  async action(options: PluginOptions, context: BuildContext): Promise<void> {
    const getScan = () => scanPresentations(options, context);
    await runStatsCommand(options, getScan);
  }
}

class ValidateCommand implements ICliCommand {
  readonly name = "slidev:validate";
  readonly description =
    "Scan presentations and report metadata issues without building";
  async action(options: PluginOptions, context: BuildContext): Promise<void> {
    const getScan = () => scanPresentations(options, context);
    await runValidateCommand(options, getScan);
  }
}

/** Built-in commands provided by the plugin. */
export const BUILTIN_COMMANDS: ICliCommand[] = [
  new ListCommand(),
  new StatsCommand(),
  new ValidateCommand(),
];

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Register CLI commands on the Docusaurus CLI instance.
 *
 * Accepts additional `extraCommands` so third-party extensions can inject
 * new `slidev:*` commands without modifying this file (OCP).
 * Built-in commands share a lazy scan cache so concurrent `slidev:list &&
 * slidev:stats` invocations only scan the file system once.
 */
export function registerCliCommands(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cli: any,
  options: PluginOptions,
  context: BuildContext,
  extraCommands: ICliCommand[] = [],
): void {
  // Lazy scan: the first command that fires initialises the Promise;
  // subsequent commands in the same CLI invocation reuse the cached result.
  let scanPromise: ReturnType<typeof scanPresentations> | null = null;
  const getScan: ScanGetter = () => {
    scanPromise ??= scanPresentations(options, context);
    return scanPromise;
  };

  const allCommands = [...BUILTIN_COMMANDS, ...extraCommands];
  for (const cmd of allCommands) {
    cli
      .command(cmd.name)
      .description(cmd.description)
      // Wrap to share the lazy scan across built-in commands; extra commands
      // manage their own scan via cmd.action(options, context).
      .action(() => {
        if (cmd instanceof ListCommand) return runListCommand(options, getScan);
        if (cmd instanceof StatsCommand)
          return runStatsCommand(options, getScan);
        if (cmd instanceof ValidateCommand)
          return runValidateCommand(options, getScan);
        return cmd.action(options, context);
      });
  }
}
