import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import dts from "rollup-plugin-dts";
import { themeBuildPlugin } from "./scripts/build-theme.mjs";

/** Node built-ins — always external regardless of build target. */
const NODE_BUILTINS = [
  /^node:/,
  /^(path|fs|os|crypto|child_process|url|stream|events|util|assert|buffer)$/,
];

/**
 * Packages that must NOT be bundled for the Docusaurus plugin — they are
 * resolved at runtime by the consumer (Docusaurus, Node.js built-ins, declared
 * peer/runtime deps). Every entry here must be listed in package.json
 * `dependencies` or `peerDependencies`.
 *
 * p-limit is deliberately NOT external: v7 is ESM-only and `require()` of ESM
 * is unavailable before Node 20.19, so it is inlined (and kept in devDependencies).
 */
const PLUGIN_EXTERNALS = [
  ...NODE_BUILTINS,
  // Docusaurus ecosystem — always present in the host project
  /^@docusaurus\//,
  // Runtime dependencies shipped separately
  "gray-matter",
  "js-yaml",
];

/**
 * CLI externals — runtime deps that will be in node_modules when installed.
 * @docusaurus/logger is BUNDLED (not listed here) because it may not be
 * available in all CLI contexts (e.g. global install).
 */
const CLI_EXTERNALS = [
  ...NODE_BUILTINS,
  "gray-matter",
  "js-yaml",
  "commander",
  "prompts",
  "picocolors",
  // Docusaurus runtime — not used in CLI execution
  /^@docusaurus\/core/,
  /^@docusaurus\/types/,
  /^@docusaurus\/utils/,
  /^@docusaurus\/preset/,
  "react",
  "react-dom",
];

/**
 * The ESM bundle has no CommonJS `__dirname`; derive it from import.meta.url so
 * `getThemePath()` resolves the same directory (lib/) in both formats.
 */
const ESM_DIRNAME_SHIM = [
  'import { fileURLToPath as __slidesaurusFileURLToPath } from "node:url";',
  'import { dirname as __slidesaurusDirname } from "node:path";',
  "const __dirname = __slidesaurusDirname(__slidesaurusFileURLToPath(import.meta.url));",
].join("\n");

/** TypeScript compiler overrides for Rollup (override tsconfig.json) */
const TS_OVERRIDES = {
  module: "ESNext",
  moduleResolution: "bundler",
  // Declarations are handled by the dts pass below
  declaration: false,
  declarationMap: false,
  sourceMap: true,
};

/** @type {import('rollup').RollupOptions[]} */
const config = [
  // ── Pass 0: CLI binary ─────────────────────────────────────────────────
  {
    input: "src/cli/index.ts",
    output: {
      file: "lib/cli.cjs",
      format: "cjs",
      banner: "#!/usr/bin/env node",
      sourcemap: true,
      exports: "auto",
      interop: "auto",
    },
    external: CLI_EXTERNALS,
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      json({ compact: true }),
      typescript({
        tsconfig: "./tsconfig.json",
        compilerOptions: TS_OVERRIDES,
      }),
    ],
  },

  // ── Pass 1: JavaScript bundles (CJS + ESM) ─────────────────────────────
  {
    input: "src/index.ts",
    output: [
      {
        file: "lib/index.cjs",
        format: "cjs",
        sourcemap: true,
        exports: "named",
        // Generate proper interop wrappers so that default imports of external
        // CJS modules (e.g. @docusaurus/logger whose API lives on .default)
        // are correctly resolved at runtime.
        interop: "auto",
      },
      {
        file: "lib/index.mjs",
        format: "esm",
        sourcemap: true,
        intro: ESM_DIRNAME_SHIM,
      },
    ],
    external: PLUGIN_EXTERNALS,
    plugins: [
      // Resolve node_modules (prefer Node built-ins)
      resolve({ preferBuiltins: true }),
      // Convert inlined CJS modules to ESM for Rollup
      commonjs(),
      // Inline package.json fields used in constants.ts
      json({ compact: true }),
      typescript({
        tsconfig: "./tsconfig.json",
        compilerOptions: TS_OVERRIDES,
      }),
      // Compile theme/ (TSX) → lib/theme (JS + CSS modules) for getThemePath()
      themeBuildPlugin(),
    ],
  },

  // ── Pass 2: Bundled type declarations (.d.cts for require, .d.mts for import)
  {
    input: "src/index.ts",
    output: [
      { file: "lib/index.d.cts", format: "esm" },
      { file: "lib/index.d.mts", format: "esm" },
    ],
    external: PLUGIN_EXTERNALS,
    plugins: [
      json({ compact: true }),
      dts({ tsconfig: "./tsconfig.json" }),
    ],
  },
];

export default config;
