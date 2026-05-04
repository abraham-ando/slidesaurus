import pc from "picocolors";
import { PluginLogger } from "../logger";

/**
 * Terminal logger for the slidesaurus CLI.
 * Extends PluginLogger and overrides the common methods with picocolors output
 * suited to a standalone binary (symbols + colors instead of Docusaurus format).
 * CLI-only methods (ok, fail, heading, dim, fatal) are added on top.
 */
export class CliLogger extends PluginLogger {
  override info(msg: string): void {
    console.log(`${pc.blue("ℹ")} ${msg}`);
  }

  override warn(msg: string): void {
    console.log(`${pc.yellow("⚠")} ${msg}`);
  }

  override error(msg: string): void {
    console.error(`${pc.red("✖")} ${pc.bold("Error:")} ${msg}`);
  }

  override success(msg: string): void {
    console.log(`\n${pc.green("✔")} ${pc.bold(msg)}`);
  }

  ok(msg: string): void {
    console.log(`${pc.green("✓")} ${msg}`);
  }

  fail(msg: string): void {
    console.log(`${pc.red("✗")} ${msg}`);
  }

  heading(msg: string): void {
    console.log(`\n${pc.bold(pc.cyan(msg))}`);
  }

  dim(msg: string): void {
    console.log(pc.dim(msg));
  }

  fatal(msg: string, code = 1): never {
    this.error(msg);
    process.exit(code);
  }
}

/** Singleton used by all CLI commands. */
export const cliLogger = new CliLogger();
