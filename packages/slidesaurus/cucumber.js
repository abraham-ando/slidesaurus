// Step definitions are TypeScript, loaded as CommonJS through tsx/cjs (esbuild —
// no type-checking, no dependency on the TypeScript compiler API). tsx reads the
// Cucumber-specific tsconfig, which covers both src/ and features/.
process.env.TSX_TSCONFIG_PATH = require("path").join(
  __dirname,
  "tsconfig.cucumber.json",
);

module.exports = {
  default: {
    requireModule: ["tsx/cjs"],
    require: ["features/step_definitions/**/*.ts"],
    paths: ["features/**/*.feature"],
    format: ["progress-bar", "summary"],
  },
};
