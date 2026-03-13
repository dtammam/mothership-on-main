/*
    Mothership on Main Interactivity
    Config-driven controls for links, quotes, backgrounds, and search.
    Author: Dean Tammam
    Date: 4/20/2023
*/

// Constants loaded from js/constants.js
// Utilities loaded from js/utils.js
// Storage loaded from js/storage.js
// Customize panel loaded from js/customize.js

let activeConfig = null;
let faviconCache = {};
let backgroundThumbs = {};
let isRearranging = false;
let lastRenderLinks = [];
let gridObserver = null;
let currentDragType = "";
let currentDragSection = null;
let backgroundPreviewObserver = null;
let backgroundPreviewPanel = null;
let canRearrangeEditor = () => false;

if (!window.__MSOM_DISABLE_UI__) {
    document.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => {
            console.error("Failed to initialize", error);
        });
    });
}

async function init() {
    const [config, cache, thumbs] = await Promise.all([
        loadConfig(),
        storageLocal.get(FAVICON_CACHE_KEY),
        storageLocal.get(BACKGROUND_THUMBS_KEY)
    ]);
    activeConfig = config;
    faviconCache = cache[FAVICON_CACHE_KEY] || {};
    backgroundThumbs = thumbs[BACKGROUND_THUMBS_KEY] || {};

    renderAll(activeConfig);
    setupSettings();
    refreshSyncStatus();
    setupGridObserver();
}

window.mothershipDebug = {
    runSyncQuotaTest
};

window.msomStorage = {
    loadConfig,
    loadV2SyncConfig,
    saveSyncConfig: saveSyncConfigV2,
    splitConfig,
    mergeConfig,
    mergeLocalAssets,
    getConfigSizeBytes,
    clearSyncStorage,
    setSimulatorEnabled(enabled, faultFn) {
        window.__MSOM_USE_SYNC_SIM__ = Boolean(enabled);
        window.__MSOM_SYNC_SIM_FAULT__ = typeof faultFn === "function" ? faultFn : null;
    }
};
