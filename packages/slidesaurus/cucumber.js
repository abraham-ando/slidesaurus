// Use the Cucumber-specific tsconfig so ts-node includes both src/ and features/
// and has transpileOnly:true to skip ambient declaration issues (e.g. js-yaml).
process.env.TS_NODE_PROJECT = require("path").join(__dirname, "tsconfig.cucumber.json");

module.exports = {
  default: {
    requireModule: ["ts-node/register"],
    require: ["features/step_definitions/**/*.ts"],
    paths: ["features/**/*.feature"],
    format: ["progress-bar", "summary"],
  },
};
