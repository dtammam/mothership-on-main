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
        // Cross-file globals (js/*.js loaded via <script> tags in dependency order)
        // constants.js
        SYNC_KEY: "readonly",
        SYNC_CORE_KEY: "readonly",
        SYNC_INDEX_KEY: "readonly",
        SYNC_LINKS_PREFIX: "readonly",
        SYNC_QUOTES_PREFIX: "readonly",
        SYNC_BACKGROUNDS_PREFIX: "readonly",
        SYNC_TEST_KEY: "readonly",
        LOCAL_ASSETS_KEY: "readonly",
        LEGACY_KEY: "readonly",
        SYNC_META_KEY: "readonly",
        FAVICON_CACHE_KEY: "readonly",
        BACKGROUND_THUMBS_KEY: "readonly",
        DEFAULT_LINK_SECTION: "readonly",
        NEW_SECTION_OPTION: "readonly",
        SYNC_CHUNK_CHAR_TARGET: "readonly",
        SYNC_TOTAL_QUOTA_BYTES: "readonly",
        SYNC_PER_ITEM_LIMIT: "readonly",
        SYNC_VERSION: "readonly",
        V2_META_KEY: "readonly",
        V2_CHUNK_PREFIX: "readonly",
        V2_TMP_META_KEY: "readonly",
        V2_TMP_CHUNK_PREFIX: "readonly",
        fallbackConfig: "readonly",
        // utils.js
        hashString: "readonly",
        padChunkIndex: "readonly",
        chunkStringBySize: "readonly",
        buildV2ChunkKeys: "readonly",
        calculatePayloadBytes: "readonly",
        isDataUrl: "readonly",
        ensureLinkIds: "readonly",
        createId: "readonly",
        timeAgo: "readonly",
        rand: "readonly",
        shuffleArray: "readonly",
        boostColor: "readonly",
        safeParseUrl: "readonly",
        blobToDataUrl: "readonly",
        fileToDataUrl: "readonly",
        createImageThumbnail: "readonly",
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
    // constants.js declares globals consumed by other js/*.js files
    files: ["js/constants.js", "js/utils.js"],
    rules: {
      "no-unused-vars": "off",
      "no-redeclare": "off",
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
