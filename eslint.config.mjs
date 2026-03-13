import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["js/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        console: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        fetch: "readonly",
        URL: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        Image: "readonly",
        HTMLElement: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        performance: "readonly",
        crypto: "readonly",
        structuredClone: "readonly",
        navigator: "readonly",
        // Chrome extension API
        chrome: "readonly",
      },
    },
    rules: {
      // Align with CONTRIBUTING.md coding standards
      "no-var": "error",
      "prefer-const": "warn",
      eqeqeq: ["error", "always"],
      "no-empty-catch": "off",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Test files and helpers use ES modules (vitest)
    files: ["tests/**/*.test.js", "tests/helpers/**/*.js"],
    languageOptions: {
      sourceType: "module",
    },
  },
  {
    ignores: ["node_modules/", "dist/", "tests/storage-harness*.js"],
  },
];
