import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import pc from "picocolors";
import { loadPluginOptions, resolveOptions, findConfigFile } from "../config";
import { cliLogger } from "../output";
const { ok, fail, warn, heading, info } = cliLogger;
import { scanPresentations } from "../../scanner";
import { isPackageInstalled, checkPackageAvailable } from "../../packageResolver";
import { getSlidevCacheDir, loadHashManifest, hasCachedOutput } from "../../fileSystem";
import { checkSlidevInstalled } from "../../builder";

interface DoctorOptions {
  pluginId: string;
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, timeout: 300 }, (res) => {
      res.resume();
      resolve(false); // port in use
    });
    req.on("error", () => resolve(true)); // port free
    req.on("timeout", () => { req.destroy(); resolve(true); });
  });
}

export async function runDoctor(opts: DoctorOptions): Promise<void> {
  const cwd = process.cwd();
  let passed = 0;
  let failed = 0;

  const report = (pass: boolean, label: string, detail?: string) => {
    if (pass) {
      ok(`${label}${detail ? pc.dim(" — " + detail) : ""}`);
      passed++;
    } else {
      fail(`${label}${detail ? " — " + pc.yellow(detail) : ""}`);
      failed++;
    }
  };

  heading("slidesaurus doctor");
  console.log();

  // ── Check 1: docusaurus.config.ts parsable + plugin loaded ────────────────
  const configFile = findConfigFile(cwd);
  report(configFile !== null, "docusaurus.config found", configFile ? path.relative(cwd, configFile) : "Not found");

  const { options: pluginOpts, pluginFound } = loadPluginOptions(cwd, opts.pluginId);
  report(
    pluginFound,
    `slidesaurus plugin found (id="${opts.pluginId}")`,
    pluginFound ? undefined : `Add slidesaurus to plugins in docusaurus.config`,
  );

  const options = resolveOptions(pluginOpts, opts.pluginId);

  // ── Check 2: slidev directory exists ──────────────────────────────────────
  const slidevDir = path.resolve(cwd, options.path);
  const dirExists = fs.existsSync(slidevDir) && fs.statSync(slidevDir).isDirectory();
  report(dirExists, `Slidev directory exists`, path.relative(cwd, slidevDir));

  // ── Check 3: Slidev CLI installed ─────────────────────────────────────────
  const slidevInstalled = checkSlidevInstalled(cwd);
  report(slidevInstalled, "@slidev/cli installed", slidevInstalled ? undefined : "Run: pnpm add @slidev/cli");

  // ── Check 4: Themes and addons resolvable ─────────────────────────────────
  let presentations: Awaited<ReturnType<typeof scanPresentations>>["presentations"] = [];
  if (dirExists) {
    try {
      const result = await scanPresentations(
        options as Parameters<typeof scanPresentations>[0],
        { siteDir: cwd, baseUrl: "/" },
      );
      presentations = result.presentations;

      // Check global theme
      const globalTheme = options.theme;
      if (globalTheme) {
        const themeCheck = checkPackageAvailable(
          globalTheme.startsWith("@") || globalTheme.startsWith("slidev-theme-")
            ? globalTheme
            : `@slidev/theme-${globalTheme}`,
          cwd,
        );
        report(themeCheck.installed, `Global theme "${globalTheme}" installed`, themeCheck.error);
      }

      // Check per-presentation themes
      const perSlideThemes = [...new Set(presentations.map((p) => p.theme).filter(Boolean))];
      for (const t of perSlideThemes) {
        if (t === globalTheme) continue;
        const check = checkPackageAvailable(
          t!.startsWith("@") || t!.startsWith("slidev-theme-") ? t! : `@slidev/theme-${t!}`,
          cwd,
        );
        report(check.installed, `Per-slide theme "${t}" installed`, check.error);
      }

      // Check addons
      const allAddons = [...new Set([
        ...(Array.isArray(options.addons) ? options.addons : []),
        ...presentations.flatMap((p) => p.addons ?? []),
      ])];
      for (const addon of allAddons) {
        const addonName = addon.startsWith("@") || addon.startsWith("slidev-addon-")
          ? addon
          : `slidev-addon-${addon}`;
        const check = isPackageInstalled(addonName, cwd);
        report(check, `Addon "${addon}" installed`, check ? undefined : `Run: pnpm add ${addonName}`);
      }
    } catch {
      warn("Could not scan presentations — skipping theme/addon checks");
    }
  }

  // ── Check 5: Cache health ─────────────────────────────────────────────────
  const cacheDir = getSlidevCacheDir(cwd, opts.pluginId);
  if (fs.existsSync(cacheDir)) {
    const manifest = loadHashManifest(cacheDir);
    const ids = Object.keys(manifest);
    // hasCachedOutput throws on path traversal — ignore malformed entries defensively
    const orphans = ids.filter((id) => {
      try { return !hasCachedOutput(cacheDir, id); } catch { return false; }
    });
    report(
      orphans.length === 0,
      `Cache manifest coherent (${ids.length} entries)`,
      orphans.length > 0 ? `${orphans.length} orphan(s): ${orphans.join(", ")}` : undefined,
    );
  } else {
    info(`Cache directory not yet created (${path.relative(cwd, cacheDir)})`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log();
  if (failed === 0) {
    console.log(pc.green(`✔ All ${passed} checks passed.`));
  } else {
    console.log(pc.yellow(`${passed} passed`) + "  " + pc.red(`${failed} failed`));
    process.exit(1);
  }
}
