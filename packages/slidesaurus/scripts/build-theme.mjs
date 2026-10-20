/**
 * Compiles the theme components (theme/**\/*.ts[x]) to plain ES modules in
 * lib/theme/ and copies CSS modules alongside them.
 *
 * Docusaurus does not transpile TypeScript/JSX coming from node_modules, so the
 * published plugin must point `getThemePath()` at compiled JavaScript. The raw
 * TSX sources stay in theme/ and are exposed via `getTypeScriptThemePath()`
 * for `docusaurus swizzle --typescript`.
 *
 * Run automatically by rollup.config.mjs (also in watch mode), or standalone
 * with `node scripts/build-theme.mjs`.
 *
 * Each file is transpiled in isolation (no type-checking — run
 * `pnpm typecheck`, which also checks theme/). Type-only imports are erased, so the output
 * never references src/.
 *
 * TypeScript 7 ships no JS compiler API yet, so `transpileModule` comes from
 * the TS 6 compatibility package `@typescript/typescript6`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "@typescript/typescript6";

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(pkgDir, "theme");
const outDir = path.join(pkgDir, "lib", "theme");

/** @type {import("@typescript/typescript6").CompilerOptions} */
const compilerOptions = {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.ReactJSX,
  isolatedModules: true,
  esModuleInterop: true,
  sourceMap: false,
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** Absolute paths of every file under theme/ (used for Rollup watch mode). */
export function listThemeFiles() {
  return walk(srcDir);
}

/** Rebuild lib/theme from theme/. Throws on syntax errors. */
export function buildTheme() {
  fs.rmSync(outDir, { recursive: true, force: true });

  let compiled = 0;
  let copied = 0;
  for (const file of walk(srcDir)) {
    const rel = path.relative(srcDir, file);
    if (file.endsWith(".d.ts")) continue;

    if (/\.tsx?$/.test(file)) {
      const { outputText, diagnostics } = ts.transpileModule(
        fs.readFileSync(file, "utf8"),
        { compilerOptions, fileName: file, reportDiagnostics: true },
      );
      if (diagnostics?.length) {
        const host = {
          getCanonicalFileName: (f) => f,
          getCurrentDirectory: () => pkgDir,
          getNewLine: () => "\n",
        };
        throw new Error(ts.formatDiagnostics(diagnostics, host));
      }
      const target = path.join(outDir, rel.replace(/\.tsx?$/, ".js"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, outputText);
      compiled++;
    } else if (file.endsWith(".css")) {
      const target = path.join(outDir, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(file, target);
      copied++;
    }
  }

  return { compiled, copied };
}

function logResult({ compiled, copied }) {
  console.log(`theme: ${compiled} module(s) compiled, ${copied} stylesheet(s) copied → lib/theme`);
}

/** Rollup plugin: rebuilds lib/theme after each build and watches theme/. */
export function themeBuildPlugin() {
  return {
    name: "slidesaurus-theme",
    buildStart() {
      for (const file of listThemeFiles()) this.addWatchFile(file);
    },
    // closeBundle runs once per build (not once per output format)
    closeBundle() {
      logResult(buildTheme());
    },
  };
}

// Allow standalone use: `node scripts/build-theme.mjs`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  logResult(buildTheme());
}
