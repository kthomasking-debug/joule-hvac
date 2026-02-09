import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import importPlugin from "eslint-plugin-import";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "android/**"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: { import: importPlugin },
    settings: {
      "import/resolver": {
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      },
    },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^[A-Z_]", caughtErrorsIgnorePattern: "^[A-Z_]" }],
      "import/no-unresolved": "error",
    },
  },
  // Config files - avoid import/no-unresolved on ESLint and tooling configs
  {
    files: ["eslint.config.js", "vite.config.js", "scripts/**", ".husky/**"],
    rules: {
      "import/no-unresolved": "off",
    },
    languageOptions: { globals: globals.node },
  },
  // Node.js/CLI scripts (scripts folder)
  {
    files: ["scripts/**"],
    languageOptions: { globals: globals.node },
  },
  // Test files run in a test environment (jest/vitest)
  {
    files: ["**/*.test.{js,jsx}", "**/__tests__/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        describe: true,
        it: true,
        expect: true,
        beforeEach: true,
        afterEach: true,
        vi: true,
        global: true,
        test: true,
      },
    },
  },
  // Top-level or helper test scripts that run under Node (non-Jest files)
  {
    files: ["test-*.js", "test-*.cjs", "test-*.mjs"],
    languageOptions: { globals: globals.node },
  },
]);
