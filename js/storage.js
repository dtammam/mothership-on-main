// All chrome.storage operations: sync/local wrappers, v2 chunked format,
// quota preflight, migration, simulated sync for testing.

const storageLocal = {
    async get(keys) {
        if (chrome?.storage?.local) {
            return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
        }
        const result = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
            const raw = localStorage.getItem(key);
            result[key] = raw ? JSON.parse(raw) : undefined;
        }
        return result;
    },
    async set(data) {
        if (chrome?.storage?.local) {
            return new Promise((resolve) => chrome.storage.local.set(data, resolve));
        }
        Object.entries(data).forEach(([key, value]) => {
            localStorage.setItem(key, JSON.stringify(value));
        });
    },
    async remove(keys) {
        if (chrome?.storage?.local) {
            return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
        }
        for (const key of Array.isArray(keys) ? keys : [keys]) {
            localStorage.removeItem(key);
        }
    }
};

// storageSync wraps chrome.storage.sync with a simulator fallback and quota enforcement.
// In simulator mode we enforce the same per-item/total limits and allow fault injection.
const storageSync = {
    async get(keys) {
        if (!shouldUseSimSync() && chrome?.storage?.sync) {
            return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
        }
        const result = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
            const raw = getSimSyncStore().getItem(key);
            result[key] = raw ? JSON.parse(raw) : undefined;
        }
        return result;
    },
    async set(data) {
        if (!shouldUseSimSync() && chrome?.storage?.sync) {
            return new Promise((resolve, reject) => {
                chrome.storage.sync.set(data, () => {
                    const error = chrome.runtime?.lastError;
                    if (error) {
                        reject(new Error(error.message));
                        return;
                    }
                    resolve();
                });
            });
        }
        const store = getSimSyncStore();
        const nextSnapshot = store.snapshot();
        Object.entries(data).forEach(([key, value]) => {
            nextSnapshot[key] = value;
        });
        const { perItemError, totalError } = validateSimSyncSnapshot(nextSnapshot, data);
        if (perItemError) {
            throw new Error(perItemError);
        }
        if (totalError) {
            throw new Error(totalError);
        }
        applySimFault("set", data);
        Object.entries(data).forEach(([key, value]) => {
            store.setItem(key, JSON.stringify(value));
        });
    },
    async remove(keys) {
        if (!shouldUseSimSync() && chrome?.storage?.sync) {
            return new Promise((resolve, reject) => {
                chrome.storage.sync.remove(keys, () => {
                    const error = chrome.runtime?.lastError;
                    if (error) {
                        reject(new Error(error.message));
                        return;
                    }
                    resolve();
                });
            });
        }
        const store = getSimSyncStore();
        applySimFault("remove", keys);
        for (const key of Array.isArray(keys) ? keys : [keys]) {
            store.removeItem(key);
        }
    }
};

function shouldUseSimSync() {
    return Boolean(window.__MSOM_USE_SYNC_SIM__) || !chrome?.storage?.sync;
}

function getSimSyncStore() {
    const prefix = "sync:";
    return {
        getItem(key) {
            return localStorage.getItem(`${prefix}${key}`);
        },
        setItem(key, value) {
            localStorage.setItem(`${prefix}${key}`, value);
        },
        removeItem(key) {
            localStorage.removeItem(`${prefix}${key}`);
        },
        snapshot() {
            const data = {};
            for (let i = 0; i < localStorage.length; i += 1) {
                const storageKey = localStorage.key(i);
                if (storageKey && storageKey.startsWith(prefix)) {
                    const logicalKey = storageKey.slice(prefix.length);
                    const raw = localStorage.getItem(storageKey);
                    data[logicalKey] = raw ? JSON.parse(raw) : undefined;
                }
            }
            return data;
        }
    };
}

function validateSimSyncSnapshot(snapshot, _pendingPayload) {
    const keys = Object.keys(snapshot);
    const perItemError = keys.find((key) => {
        const value = snapshot[key];
        const bytes = key.length + JSON.stringify(value ?? null).length;
        return bytes > SYNC_PER_ITEM_LIMIT;
    })
        ? "QUOTA_BYTES_PER_ITEM quota exceeded (simulated)"
        : "";
    let totalBytes = 0;
    keys.forEach((key) => {
        const value = snapshot[key];
        totalBytes += key.length + JSON.stringify(value ?? null).length;
    });
    const totalError = totalBytes > SYNC_TOTAL_QUOTA_BYTES ? "QUOTA_BYTES quota exceeded (simulated)" : "";
    return { perItemError, totalError };
}

function applySimFault(operation, payload) {
    const injector = window.__MSOM_SYNC_SIM_FAULT__;
    if (typeof injector === "function") {
        const message = injector(operation, payload);
        if (typeof message === "string" && message.length) {
            throw new Error(message);
        }
    }
}

// Loads config, migrates legacy to v2, applies defaults + local assets.
async function loadConfig() {
    const defaults = await loadDefaultConfig();
    const storedLocal = await storageLocal.get(LOCAL_ASSETS_KEY);
    const existingLocalAssets = storedLocal[LOCAL_ASSETS_KEY] || {};
    const { config: syncConfig, localAssets: nextLocalAssets } = await loadSyncConfigCore(
        defaults,
        existingLocalAssets
    );
    const merged = mergeConfig(defaults, syncConfig);
    const withAssets = applyLocalAssets(merged, nextLocalAssets || existingLocalAssets);
    updateSyncUsage(withAssets);
    return withAssets;
}

// Fetches config.json; falls back to built-in defaults on error.
async function loadDefaultConfig() {
    try {
        const response = await fetch("config.json");
        if (!response.ok) {
            return fallbackConfig;
        }
        return await response.json();
    } catch (_error) {
        return fallbackConfig;
    }
}

// Prefers v2 data; otherwise migrates v1/legacy into v2 and returns config + merged assets.
async function loadSyncConfigCore(defaults, existingLocalAssets = {}) {
    // Prefer v2; migrate legacy formats if needed.
    const v2 = await loadV2SyncConfig();
    if (v2.status === "ok") {
        return { config: v2.config, localAssets: existingLocalAssets };
    }
    const storedSync = await storageSync.get([SYNC_INDEX_KEY, SYNC_CORE_KEY, SYNC_KEY]);
    const legacyLocal = await storageLocal.get(LEGACY_KEY);
    let legacyConfig = null;
    if (storedSync[SYNC_INDEX_KEY]) {
        legacyConfig = await loadChunkedSyncConfig(storedSync);
    } else if (storedSync[SYNC_KEY]) {
        legacyConfig = storedSync[SYNC_KEY];
    } else if (legacyLocal[LEGACY_KEY]) {
        legacyConfig = legacyLocal[LEGACY_KEY];
    }
    if (!legacyConfig) {
        return { config: defaults, localAssets: existingLocalAssets };
    }
    const mergedLegacy = mergeConfig(defaults, legacyConfig);
    const { syncConfig, localAssets } = splitConfig(mergedLegacy);
    const mergedAssets = mergeLocalAssets(existingLocalAssets, localAssets);
    const saveResult = await saveSyncConfigV2(syncConfig, { silent: true });
    if (saveResult.ok) {
        await Promise.all([storageLocal.set({ [LOCAL_ASSETS_KEY]: mergedAssets }), storageLocal.remove(LEGACY_KEY)]);
    }
    return { config: syncConfig, localAssets: mergedAssets };
}

// Legacy v1: rebuilds config from core/index and array chunks.
async function loadChunkedSyncConfig(storedSync) {
    const index = storedSync[SYNC_INDEX_KEY];
    const core = storedSync[SYNC_CORE_KEY] || {};
    if (!index) {
        return core;
    }
    const chunkKeys = [
        ...getChunkKeys(SYNC_LINKS_PREFIX, index.linksChunks),
        ...getChunkKeys(SYNC_QUOTES_PREFIX, index.quotesChunks),
        ...getChunkKeys(SYNC_BACKGROUNDS_PREFIX, index.backgroundsChunks)
    ];
    if (!chunkKeys.length) {
        return core;
    }
    const chunks = await storageSync.get(chunkKeys);
    return {
        ...core,
        links: collectChunks(chunks, SYNC_LINKS_PREFIX, index.linksChunks),
        quotes: collectChunks(chunks, SYNC_QUOTES_PREFIX, index.quotesChunks),
        backgrounds: collectChunks(chunks, SYNC_BACKGROUNDS_PREFIX, index.backgroundsChunks)
    };
}

// Collects chunk arrays for a given prefix and count.
function collectChunks(chunks, prefix, count) {
    if (!count) {
        return [];
    }
    const items = [];
    for (let i = 0; i < count; i += 1) {
        const key = `${prefix}_${i}`;
        const value = chunks[key];
        if (Array.isArray(value)) {
            items.push(...value);
        }
    }
    return items;
}

// Builds v1 chunk keys for a given prefix/count.
function getChunkKeys(prefix, count) {
    if (!count) {
        return [];
    }
    const keys = [];
    for (let i = 0; i < count; i += 1) {
        keys.push(`${prefix}_${i}`);
    }
    return keys;
}

function estimateSyncUsage(syncConfig) {
    // Estimator mirrors actual chunking but omits timestamps to keep values stable.
    const serialized = JSON.stringify(syncConfig ?? {});
    const chunks = chunkStringBySize(serialized, SYNC_CHUNK_CHAR_TARGET);
    const meta = {
        version: SYNC_VERSION,
        chunkCount: chunks.length,
        updatedAt: "",
        checksum: ""
    };
    const items = [[V2_META_KEY, meta]];
    chunks.forEach((chunk, index) => {
        items.push([`${V2_CHUNK_PREFIX}${padChunkIndex(index)}`, chunk]);
    });
    let totalBytes = 0;
    let maxItem = 0;
    items.forEach(([key, value]) => {
        const bytes = key.length + JSON.stringify(value ?? null).length;
        totalBytes += bytes;
        if (bytes > maxItem) {
            maxItem = bytes;
        }
    });
    return {
        configBytes: serialized.length,
        chunkCount: chunks.length,
        maxItemBytes: maxItem,
        totalBytes
    };
}

// Validates per-item and total quota; returns { ok, error, totalBytes? }.
function preflightV2Payload(payload) {
    const perItemError = Object.entries(payload).find(([key, value]) => {
        const bytes = key.length + JSON.stringify(value ?? null).length;
        return bytes > SYNC_PER_ITEM_LIMIT;
    });
    if (perItemError) {
        return { ok: false, error: "QUOTA_BYTES_PER_ITEM quota exceeded" };
    }
    const totalBytes = calculatePayloadBytes(payload);
    if (totalBytes > SYNC_TOTAL_QUOTA_BYTES) {
        return { ok: false, error: "QUOTA_BYTES quota exceeded", totalBytes };
    }
    return { ok: true, totalBytes };
}

// Returns JSON string length for a config (approx size).
function getConfigSizeBytes(config) {
    return JSON.stringify(config ?? {}).length;
}

// Reads v2 meta/chunks, cleans temp keys, validates checksum and structure.
async function loadV2SyncConfig() {
    // Detect and clean temp keys, then read v2 meta+chunks; validate chunkCount and checksum.
    const stored = await storageSync.get([V2_META_KEY, V2_TMP_META_KEY]);
    const tempMeta = stored[V2_TMP_META_KEY];
    if (tempMeta && tempMeta.chunkCount) {
        await cleanupTempV2Keys(tempMeta);
    }
    const meta = stored[V2_META_KEY];
    if (!meta) {
        return { status: "missing" };
    }
    if (meta.version !== SYNC_VERSION || !Number.isFinite(meta.chunkCount) || meta.chunkCount < 0) {
        return { status: "corrupt", reason: "invalid meta" };
    }
    if (meta.chunkCount === 0) {
        return { status: "corrupt", reason: "empty chunk set" };
    }
    const chunkKeys = buildV2ChunkKeys(meta.chunkCount);
    const chunks = await storageSync.get(chunkKeys);
    const parts = [];
    for (let i = 0; i < meta.chunkCount; i += 1) {
        const key = `${V2_CHUNK_PREFIX}${padChunkIndex(i)}`;
        const value = chunks[key];
        if (typeof value !== "string") {
            return { status: "corrupt", reason: `missing chunk ${i}` };
        }
        parts.push(value);
    }
    const serialized = parts.join("");
    if (meta.checksum && hashString(serialized) !== meta.checksum) {
        return { status: "corrupt", reason: "checksum mismatch" };
    }
    try {
        const parsed = JSON.parse(serialized);
        return { status: "ok", config: parsed, meta };
    } catch (_error) {
        return { status: "corrupt", reason: "parse error" };
    }
}

// Removes any temporary v2 keys left by an interrupted write.
async function cleanupTempV2Keys(meta) {
    const tempKeys = [V2_TMP_META_KEY, ...buildV2ChunkKeys(meta.chunkCount, V2_TMP_CHUNK_PREFIX)];
    try {
        await storageSync.remove(tempKeys);
    } catch (error) {
        console.warn("Failed to cleanup temp keys", error);
    }
}

// Saves using two-phase temp→final writes with per-item/total quota preflight.
async function saveSyncConfigV2(syncConfig, options = {}) {
    // Two-phase write: temp -> final, with quota preflight on both; legacy keys cleaned post-success.
    const _opts = { silent: false, ...options };
    const serialized = JSON.stringify(syncConfig ?? {});
    const chunks = chunkStringBySize(serialized, SYNC_CHUNK_CHAR_TARGET);
    const meta = {
        version: SYNC_VERSION,
        chunkCount: chunks.length,
        updatedAt: new Date().toISOString(),
        checksum: hashString(serialized)
    };
    const tempPayload = {
        [V2_TMP_META_KEY]: meta,
        ...chunks.reduce((acc, chunk, index) => {
            acc[`${V2_TMP_CHUNK_PREFIX}${padChunkIndex(index)}`] = chunk;
            return acc;
        }, {})
    };
    const finalPayload = {
        [V2_META_KEY]: meta,
        ...chunks.reduce((acc, chunk, index) => {
            acc[`${V2_CHUNK_PREFIX}${padChunkIndex(index)}`] = chunk;
            return acc;
        }, {})
    };

    const tempCheck = preflightV2Payload(tempPayload);
    if (!tempCheck.ok) {
        return { ok: false, error: tempCheck.error };
    }
    const finalCheck = preflightV2Payload(finalPayload);
    if (!finalCheck.ok) {
        return { ok: false, error: finalCheck.error };
    }

    const legacyIndex = (await storageSync.get(SYNC_INDEX_KEY))[SYNC_INDEX_KEY];
    const legacyChunkKeys = legacyIndex
        ? [
              ...getChunkKeys(SYNC_LINKS_PREFIX, legacyIndex.linksChunks),
              ...getChunkKeys(SYNC_QUOTES_PREFIX, legacyIndex.quotesChunks),
              ...getChunkKeys(SYNC_BACKGROUNDS_PREFIX, legacyIndex.backgroundsChunks)
          ]
        : [];

    try {
        await storageSync.set(tempPayload);
    } catch (error) {
        return { ok: false, error: error?.message || "Failed to write temp config" };
    }

    try {
        if (chrome?.storage?.sync) {
            await new Promise((resolve, reject) => {
                chrome.storage.sync.set(finalPayload, () => {
                    const err = chrome.runtime?.lastError;
                    if (err) {
                        reject(new Error(err.message));
                        return;
                    }
                    resolve();
                });
            });
        } else {
            await storageSync.set(finalPayload);
        }
    } catch (error) {
        await cleanupTempV2Keys(meta);
        return { ok: false, error: error?.message || "Failed to write final config" };
    }

    await cleanupTempV2Keys(meta);
    await storageSync.remove([SYNC_KEY, SYNC_CORE_KEY, SYNC_INDEX_KEY, ...legacyChunkKeys]);
    return { ok: true, meta };
}

// Clears v2 + legacy sync keys; used by harness/debug flows.
async function clearSyncStorage() {
    const stored = await storageSync.get([SYNC_INDEX_KEY, V2_META_KEY]);
    const legacyIndex = stored[SYNC_INDEX_KEY];
    const legacyChunks = legacyIndex
        ? [
              ...getChunkKeys(SYNC_LINKS_PREFIX, legacyIndex.linksChunks),
              ...getChunkKeys(SYNC_QUOTES_PREFIX, legacyIndex.quotesChunks),
              ...getChunkKeys(SYNC_BACKGROUNDS_PREFIX, legacyIndex.backgroundsChunks)
          ]
        : [];
    const v2Meta = stored[V2_META_KEY];
    const v2Chunks = v2Meta ? buildV2ChunkKeys(v2Meta.chunkCount || 0) : [];
    const keys = [
        SYNC_KEY,
        SYNC_CORE_KEY,
        SYNC_INDEX_KEY,
        V2_META_KEY,
        V2_TMP_META_KEY,
        SYNC_TEST_KEY,
        ...legacyChunks,
        ...v2Chunks
    ];
    if (keys.length) {
        await storageSync.remove(keys);
    }
}

// Public save wrapper used by UI; delegates to v2 save.
async function setSyncConfig(syncConfig) {
    return saveSyncConfigV2(syncConfig);
}

// Attempts to write N KB to sync (or simulator) to probe quota behavior.
async function runSyncQuotaTest(kilobytes = 12) {
    const payload = { [SYNC_TEST_KEY]: "x".repeat(Math.max(1, kilobytes) * 1024) };
    try {
        if (chrome?.storage?.sync && !shouldUseSimSync()) {
            return await new Promise((resolve) => {
                chrome.storage.sync.set(payload, () => {
                    const error = chrome.runtime?.lastError;
                    if (error) {
                        resolve({ ok: false, error: error.message });
                        return;
                    }
                    chrome.storage.sync.remove(SYNC_TEST_KEY, () => resolve({ ok: true }));
                });
            });
        }
        await storageSync.set(payload);
        await storageSync.remove(SYNC_TEST_KEY);
        return { ok: true };
    } catch (error) {
        await storageSync.remove(SYNC_TEST_KEY);
        return { ok: false, error: error?.message || "Unknown error" };
    }
}

async function refreshSyncStatus() {
    const syncAvailable = Boolean(chrome?.storage?.sync);
    if (!syncAvailable) {
        setSyncStatus("Sync: unavailable", "off");
        updateSyncUsage(activeConfig);
        return;
    }
    const meta = await storageLocal.get(SYNC_META_KEY);
    const lastSyncAt = meta[SYNC_META_KEY]?.lastSyncAt;
    if (lastSyncAt) {
        setSyncStatus(`Sync: on - ${timeAgo(lastSyncAt)}`, "on");
    } else {
        setSyncStatus("Sync: on", "on");
    }
    updateSyncUsage(activeConfig);
}

function setSyncStatus(label, tone) {
    const el = document.getElementById("sync-status");
    if (!el) {
        return;
    }
    el.textContent = label;
    el.classList.remove("on", "off", "warn");
    if (tone) {
        el.classList.add(tone);
    }
}

// Updates the settings badge with current sync usage/headroom.
function updateSyncUsage(config) {
    const badge = document.getElementById("sync-usage");
    if (!badge) {
        return;
    }
    const { syncConfig } = splitConfig(config || activeConfig || fallbackConfig);
    const usage = estimateSyncUsage(syncConfig);
    const totalKb = Math.round(usage.totalBytes / 1024);
    const headroom = Math.max(0, SYNC_TOTAL_QUOTA_BYTES - usage.totalBytes);
    const headKb = Math.floor(headroom / 1024);
    badge.textContent = `~${totalKb}KB / 100KB (free ~${headKb}KB)`;
    badge.classList.remove("warn", "crit");
    if (headroom < 8 * 1024) {
        badge.classList.add("warn");
    }
    if (headroom < 2 * 1024) {
        badge.classList.add("crit");
    }
}
