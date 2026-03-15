// Entry point: global mutable state, initialization, and public API exports.
// Loaded last — depends on all other modules.

/* eslint-disable prefer-const -- these are reassigned in other modules (concatenated at runtime) */
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
/* eslint-enable prefer-const */

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

    // Reveal page now that user config is rendered (prevents FOUC).
    document.body.classList.remove("loading");

    // Show extension name and version from manifest (indicates prod vs QA build).
    renderVersionLabel();

    // Show "What's New" dialog if the user hasn't seen this version yet.
    checkWhatsNew();
}

// Reads manifest.json and populates the version label in the settings footer.
async function renderVersionLabel() {
    try {
        const res = await fetch("manifest.json");
        const manifest = await res.json();
        const label = document.getElementById("version-label");
        if (label && manifest.name && manifest.version) {
            label.textContent = `${manifest.name} v${manifest.version} `;

            const whatsNewLink = document.createElement("button");
            whatsNewLink.className = "whats-new-btn";
            whatsNewLink.type = "button";
            whatsNewLink.textContent = "(See what's new)";
            whatsNewLink.addEventListener("click", openWhatsNew);
            label.appendChild(whatsNewLink);
        }
    } catch (error) {
        console.error("Failed to load manifest for version label", error);
    }
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
