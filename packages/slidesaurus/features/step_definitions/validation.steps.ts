import { Given, When, Then, Before } from "@cucumber/cucumber";
import assert from "node:assert";
import type { PluginOptions } from "../../src/domain/types";

interface ValidationWorld {
  options: Record<string, unknown>;
  result: PluginOptions | null;
  error: Error | null;
}

const world: ValidationWorld = {
  options: {},
  result: null,
  error: null,
};

Before(function () {
  world.options = {};
  world.result = null;
  world.error = null;
});

Given("default plugin options", function () {
  world.options = {};
});

Given(
  "plugin options:",
  function (dataTable: {
    hashes: () => Array<{ option: string; value: string }>;
  }) {
    for (const row of dataTable.hashes()) {
      const num = Number(row.value);
      world.options[row.option] = Number.isNaN(num) ? row.value : num;
    }
  },
);

When("the options are validated", function () {
  const { validateOptions } = require("../../src/index");
  try {
    world.result = validateOptions({
      options: world.options,
      validate: () => ({}),
    });
    world.error = null;
  } catch (err) {
    world.error = err instanceof Error ? err : new Error(String(err));
    world.result = null;
  }
});

Then("validation should succeed", function () {
  assert.strictEqual(
    world.error,
    null,
    `Expected validation to succeed but got: ${world.error?.message}`,
  );
  assert.ok(world.result, "Validation result is null");
});

Then(
  "validation should fail with message containing {string}",
  function (substring: string) {
    assert.ok(world.error, "Expected validation to fail but it succeeded");
    assert.ok(
      world.error.message.includes(substring),
      `Expected error message to contain "${substring}" but got: "${world.error.message}"`,
    );
  },
);

Then("the path option should be {string}", function (expected: string) {
  assert.ok(world.result, "Validation result is null");
  assert.strictEqual(world.result.path, expected);
});
