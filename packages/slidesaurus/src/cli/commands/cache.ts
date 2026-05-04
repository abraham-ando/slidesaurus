import path from "node:path";
import fs from "node:fs";
import prompts from "prompts";
import pc from "picocolors";
import { cliLogger } from "../output";
const { ok, fail, info, warn } = cliLogger;
import {
  getSlidevCacheDir,
  getSlidevBuildOutputDir,
  loadHashManifest,
  saveHashManifest,
} from "../../fileSystem";

interface CacheClearOptions {
  id?: string;     // presentationId to target
  yes?: boolean;   // skip confirmation
  pluginId: string;
}

export async function runCacheClear(opts: CacheClearOptions): Promise<void> {
  const cwd = process.cwd();
  const cacheDir = getSlidevCacheDir(cwd, opts.pluginId);

  if (!fs.existsSync(cacheDir)) {
    info(`Cache is already empty (${path.relative(cwd, cacheDir)})`);
    return;
  }

  // ── Targeted clear ────────────────────────────────────────────────────────
  if (opts.id) {
    const presentationId = opts.id;
    const outputDir = path.join(getSlidevBuildOutputDir(cwd, opts.pluginId), presentationId);

    if (!fs.existsSync(outputDir)) {
      warn(`No cached output found for "${presentationId}"`);
      return;
    }

    if (!opts.yes) {
      const { confirmed } = await prompts({
        type: "confirm",
        name: "confirmed",
        message: `Remove cache for "${pc.cyan(presentationId)}"?`,
        initial: false,
      }, { onCancel: () => process.exit(0) });

      if (!confirmed) { info("Aborted."); return; }
    }

    try {
      fs.rmSync(outputDir, { recursive: true, force: true });

      // Remove from hash manifest
      const manifest = loadHashManifest(cacheDir);
      delete manifest[presentationId];
      saveHashManifest(cacheDir, manifest);

      ok(`Cache cleared for "${pc.cyan(presentationId)}"`);
    } catch (err) {
      fail(`Failed to clear cache: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    return;
  }

  // ── Full clear ────────────────────────────────────────────────────────────
  const manifest = loadHashManifest(cacheDir);
  const entryCount = Object.keys(manifest).length;
  const displayPath = path.relative(cwd, cacheDir);

  if (!opts.yes) {
    const { confirmed } = await prompts({
      type: "confirm",
      name: "confirmed",
      message: `Remove all cached builds in ${pc.cyan(displayPath)}${entryCount > 0 ? ` (${entryCount} presentation(s))` : ""}?`,
      initial: false,
    }, { onCancel: () => process.exit(0) });

    if (!confirmed) { info("Aborted."); return; }
  }

  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    ok(`Cache cleared — ${pc.dim(displayPath)}`);
  } catch (err) {
    fail(`Failed to clear cache: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
