import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import dts from "rollup-plugin-dts";

/** Node built-ins — always external regardless of build target. */
const NODE_BUILTINS = [
  /^node:/,
  /^(path|fs|os|crypto|child_process|url|stream|events|util|assert|buffer)$/,
];

/**
 * Packages that must NOT be bundled for the Docusaurus plugin — they are
 * resolved at runtime by the consumer (Docusaurus, Node.js built-ins, declared
 * peer/runtime deps).
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

// Keep backward-compat alias
const EXTERNALS = PLUGIN_EXTERNALS;

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
        compilerOptions: { ...TS_OVERRIDES, declaration: false, declarationMap: false },
        exclude: ["src/__tests__/**"],
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
        file: "lib/index.js",
        format: "esm",
        sourcemap: true,
      },
    ],
    external: EXTERNALS,
    plugins: [
      // Resolve node_modules (prefer Node built-ins)
      resolve({ preferBuiltins: true }),
      // Convert CJS modules (gray-matter, js-yaml) to ESM for Rollup
      commonjs(),
      // Inline package.json fields used in constants.ts
      json({ compact: true }),
      typescript({
        tsconfig: "./tsconfig.json",
        compilerOptions: TS_OVERRIDES,
        exclude: ["src/__tests__/**"],
      }),
    ],
  },

  // ── Pass 2: Bundled type declarations (.d.ts) ───────────────────────────
  {
    input: "src/index.ts",
    output: {
      file: "lib/index.d.ts",
      format: "esm",
    },
    external: EXTERNALS,
    plugins: [
      json({ compact: true }),
      dts({ tsconfig: "./tsconfig.json" }),
    ],
  },
];

export default config;
