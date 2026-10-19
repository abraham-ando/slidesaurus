// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/lib/**",
      "**/build/**",
      "**/.docusaurus/**",
      "**/.turbo/**",
      ".claude/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // React theme components (plugin theme + swizzled overrides in the apps).
    files: ["packages/slidesaurus/theme/**/*.{ts,tsx}", "apps/*/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["**/__tests__/**", "**/features/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Must stay last: disables stylistic rules that Prettier owns.
  prettier,
);
