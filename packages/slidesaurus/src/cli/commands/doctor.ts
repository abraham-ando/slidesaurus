import path from "node:path";
import fs from "node:fs";
import pc from "picocolors";
import { loadPluginOptions, resolveOptions, findConfigFile } from "../config";
import { cliLogger } from "../output";
const { ok, fail, warn, heading, info } = cliLogger;
import { scanPresentations } from "../../application/scanner";
import {
  checkPackageAvailable,
  resolveThemePackageName,
  resolveAddonPackageName,
} from "../../infrastructure/packages/packageResolver";
import { getSlidevCacheDir } from "../../infrastructure/fs/fileSystem";
import { loadHashManifest } from "../../infrastructure/fs/hashManifest";
import { hasCachedOutput } from "../../infrastructure/fs/outputManager";
import { checkSlidevInstalled } from "../../application/builder";

interface DoctorOptions {
  pluginId: string;
}

/** Minimum supported Node.js version (major.minor). */
const MIN_NODE = { major: 22, minor: 12 };

export function isSupportedNodeVersion(version: string): boolean {
  const [major, minor] = version.split(".").map((n) => parseInt(n, 10));
  if (Number.isNaN(major)) return false;
  return (
    major > MIN_NODE.major ||
    (major === MIN_NODE.major && (minor ?? 0) >= MIN_NODE.minor)
  );
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
  report(
    configFile !== null,
    "docusaurus.config found",
    configFile ? path.relative(cwd, configFile) : "Not found",
  );

  const { options: pluginOpts, pluginFound } = loadPluginOptions(
    cwd,
    opts.pluginId,
  );
  report(
    pluginFound,
    `slidesaurus plugin found (id="${opts.pluginId}")`,
    pluginFound ? undefined : `Add slidesaurus to plugins in docusaurus.config`,
  );

  const options = resolveOptions(pluginOpts, opts.pluginId);

  // ── Check 2: slidev directory exists ──────────────────────────────────────
  const slidevDir = path.resolve(cwd, options.path);
  const dirExists =
    fs.existsSync(slidevDir) && fs.statSync(slidevDir).isDirectory();
  report(dirExists, `Slidev directory exists`, path.relative(cwd, slidevDir));

  // ── Check 3: Slidev CLI installed ─────────────────────────────────────────
  const slidevInstalled = checkSlidevInstalled(cwd);
  report(
    slidevInstalled,
    "@slidev/cli installed",
    slidevInstalled ? undefined : "Run: pnpm add @slidev/cli",
  );

  // ── Check 4: Themes and addons resolvable ─────────────────────────────────
  if (dirExists) {
    try {
      const result = await scanPresentations(options, {
        siteDir: cwd,
        baseUrl: "/",
      });
      const { presentations } = result;

      // Themes are resolved with the same function as the build (packageResolver),
      // so doctor and `slidev build` agree on official vs community package names.
      const checkTheme = (theme: string, label: string) => {
        const resolved = resolveThemePackageName(theme, cwd);
        const check = checkPackageAvailable(resolved, cwd);
        report(
          check.installed,
          `${label} "${theme}" installed`,
          check.installed ? undefined : check.error,
        );
      };

      // Check global theme
      const globalTheme = options.theme;
      if (globalTheme) checkTheme(globalTheme, "Global theme");

      // Check per-presentation themes
      const perSlideThemes = [
        ...new Set(
          presentations
            .map((p) => p.theme)
            .filter((t): t is string => Boolean(t)),
        ),
      ];
      for (const t of perSlideThemes) {
        if (t === globalTheme) continue;
        checkTheme(t, "Per-slide theme");
      }

      // Check addons
      const allAddons = [
        ...new Set([
          ...(Array.isArray(options.addons) ? options.addons : []),
          ...presentations.flatMap((p) => p.addons ?? []),
        ]),
      ];
      for (const addon of allAddons) {
        const addonName = resolveAddonPackageName(addon);
        const check = checkPackageAvailable(addonName, cwd);
        report(
          check.installed,
          `Addon "${addon}" installed`,
          check.installed ? undefined : `Run: pnpm add ${addonName}`,
        );
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
      try {
        return !hasCachedOutput(cacheDir, id);
      } catch {
        return false;
      }
    });
    report(
      orphans.length === 0,
      `Cache manifest coherent (${ids.length} entries)`,
      orphans.length > 0
        ? `${orphans.length} orphan(s): ${orphans.join(", ")}`
        : undefined,
    );
  } else {
    info(`Cache directory not yet created (${path.relative(cwd, cacheDir)})`);
  }

  // ── Check 6: Node.js version ──────────────────────────────────────────────
  report(
    isSupportedNodeVersion(process.versions.node),
    `Node.js version ≥ ${MIN_NODE.major}.${MIN_NODE.minor}`,
    `v${process.versions.node}`,
  );

  // ── Check 7: Playwright (required for thumbnails and export) ─────────────
  // `slidev export` loads `playwright-chromium`, not the `playwright` package.
  let playwrightOk: boolean;
  try {
    require.resolve("playwright-chromium", { paths: [cwd] });
    playwrightOk = true;
  } catch {
    playwrightOk = false;
  }
  if (!playwrightOk) {
    info(
      `playwright-chromium not found — thumbnail and export generation will be skipped (optional: pnpm add -D playwright-chromium)`,
    );
  } else {
    ok("playwright-chromium installed (thumbnails/exports)");
    passed++;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log();
  if (failed === 0) {
    console.log(pc.green(`✔ All ${passed} checks passed.`));
  } else {
    console.log(
      pc.yellow(`${passed} passed`) + "  " + pc.red(`${failed} failed`),
    );
    process.exit(1);
  }
}
