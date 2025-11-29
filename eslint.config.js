import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import importPlugin from "eslint-plugin-import";

export default [
  // Global ignores
  {
    ignores: [
      "dist/",
      "build/",
      "android/",
      "ios/",
      "node_modules/",
      "coverage/",
      ".nyc_output/",
      "*.backup.jsx",
      "*_backup.jsx",
      "tmp*.jsx",
      "*.tmp",
      "vite.config.js.timestamp-*",
      ".eslintrc.cjs",
      "src/pages/Settings.refactored.jsx",
      "src/pages/Home_backup.jsx",
      "src/setupTests.js",
      "src/test/testHelpers.js",
      "global-teardown.js",
      "global-setup.js",
    ],
  },
  // Base recommended configs
  js.configs.recommended,
  // React Hooks config
  reactHooks.configs["recommended-latest"],
  // React Refresh config
  reactRefresh.configs.vite,
  // Main file config
  {
    files: ["**/*.{js,jsx}"],
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
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
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
];
