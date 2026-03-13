// Entry point: global mutable state, initialization, and public API exports.
// Loaded last — depends on all other modules.

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

// Bootstrap the extension: load config and caches, then render.
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
