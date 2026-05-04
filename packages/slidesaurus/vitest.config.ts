import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    root: "./src",
    include: ["**/__tests__/**/*.spec.ts"],
    testTimeout: 15000,
  },
});
