import { Command } from "commander";
import pkg from "../../package.json";
import { runNew } from "./commands/new";
import { runList } from "./commands/list";
import { runDoctor } from "./commands/doctor";
import { runCacheClear } from "./commands/cache";

const program = new Command();

program
  .name("slidesaurus")
  .description("CLI for the slidesaurus Docusaurus plugin")
  .version(pkg.version, "-v, --version")
  .option("--id <pluginId>", "Plugin instance ID (multi-instance support)", "default");

// ── slidesaurus new <name> ────────────────────────────────────────────────────
program
  .command("new [name]")
  .description("Scaffold a new Slidev presentation")
  .option("-c, --category <category>", "Category sub-folder")
  .option("-t, --theme <theme>", "Slidev theme to use")
  .option("--template <template>", "Template: basic | tutorial | talk", "basic")
  .option("--force", "Overwrite if the file already exists")
  .action(async (name: string | undefined, cmdOpts: Record<string, unknown>) => {
    const parent = program.opts<{ id: string }>();
    await runNew(name, {
      category: cmdOpts.category as string | undefined,
      theme: cmdOpts.theme as string | undefined,
      template: cmdOpts.template as string | undefined,
      force: Boolean(cmdOpts.force),
      pluginId: parent.id,
    });
  });

// ── slidesaurus list ──────────────────────────────────────────────────────────
program
  .command("list")
  .description("List all discovered presentations")
  .option("--json", "Output as JSON (machine-readable)")
  .action(async (cmdOpts: Record<string, unknown>) => {
    const parent = program.opts<{ id: string }>();
    await runList({ json: Boolean(cmdOpts.json), pluginId: parent.id });
  });

// ── slidesaurus doctor ────────────────────────────────────────────────────────
program
  .command("doctor")
  .description("Diagnose configuration, themes, ports, and cache health")
  .action(async () => {
    const parent = program.opts<{ id: string }>();
    await runDoctor({ pluginId: parent.id });
  });

// ── slidesaurus cache <sub-command> ───────────────────────────────────────────
const cacheCmd = program
  .command("cache")
  .description("Manage the incremental build cache");

cacheCmd
  .command("clear")
  .description("Clear the build cache (all presentations or a specific one)")
  .option("--id <presentationId>", "Clear cache for a single presentation")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (cmdOpts: Record<string, unknown>) => {
    const parent = program.opts<{ id: string }>();
    await runCacheClear({
      id: cmdOpts.id as string | undefined,
      yes: Boolean(cmdOpts.yes),
      pluginId: parent.id,
    });
  });

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
