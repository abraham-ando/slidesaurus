import path from "node:path";
import fs from "node:fs";
import prompts from "prompts";
import pc from "picocolors";
import { cliLogger } from "../output";
const { ok, fail, info, warn } = cliLogger;
import { getSlidevCacheDir, validatePluginId } from "../../infrastructure/fs/fileSystem";
import { getSlidevBuildOutputDir } from "../../infrastructure/fs/outputManager";
import { loadHashManifest, saveHashManifest } from "../../infrastructure/fs/hashManifest";

interface CacheClearOptions {
  presentation?: string; // presentationId to target (CLI: --presentation)
  yes?: boolean;   // skip confirmation
  pluginId: string;
}

export async function runCacheClear(opts: CacheClearOptions): Promise<void> {
  const cwd = process.cwd();

  // Validate pluginId and presentationId before using them as path components
  try { validatePluginId(opts.pluginId); } catch {
    fail(`Invalid --id "${opts.pluginId}": must contain only letters, digits, underscores and dashes.`);
    process.exit(1);
  }

  const cacheDir = getSlidevCacheDir(cwd, opts.pluginId);

  if (!fs.existsSync(cacheDir)) {
    info(`Cache is already empty (${path.relative(cwd, cacheDir)})`);
    return;
  }

  // ── Targeted clear ────────────────────────────────────────────────────────
  // `!== undefined` (not truthiness): an empty --presentation must be rejected,
  // never silently turned into a full clear.
  if (opts.presentation !== undefined) {
    const presentationId = opts.presentation.trim();
    const outputRoot = getSlidevBuildOutputDir(cwd, opts.pluginId);
    const outputDir = path.join(outputRoot, presentationId);
    // Strict guard: the target must be a proper descendant of output/. An empty id,
    // "." or "a/.." resolves to the root itself (rel === "") and would wipe every
    // cached presentation; ".." and absolute paths escape the root.
    const rel = path.relative(outputRoot, outputDir);
    if (
      presentationId === "" ||
      rel === "" ||
      rel === ".." ||
      rel.startsWith(`..${path.sep}`) ||
      path.isAbsolute(rel)
    ) {
      fail(`Invalid --presentation "${opts.presentation}": must name a single presentation inside the cache (no empty value, ".", or "..").`);
      process.exit(1);
    }

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
      }, { onCancel: () => process.exit(130) });

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
    }, { onCancel: () => process.exit(130) });

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
