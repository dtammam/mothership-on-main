// In-memory chrome.storage.sync mock with quota enforcement.
// Mirrors real Chrome sync storage limits for accurate testing.

const SYNC_PER_ITEM_LIMIT = 8192;
const SYNC_TOTAL_QUOTA_BYTES = 102400;

export function createChromeStorageMock() {
    const syncStore = new Map();
    const localStore = new Map();

    function itemBytes(key, value) {
        return key.length + JSON.stringify(value ?? null).length;
    }

    function totalBytes(store) {
        let total = 0;
        for (const [key, value] of store) {
            total += itemBytes(key, value);
        }
        return total;
    }

    const sync = {
        get(keys, callback) {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result = {};
            for (const key of keyList) {
                if (syncStore.has(key)) {
                    result[key] = structuredClone(syncStore.get(key));
                }
            }
            callback(result);
        },
        set(data, callback) {
            // Check per-item limits
            for (const [key, value] of Object.entries(data)) {
                if (itemBytes(key, value) > SYNC_PER_ITEM_LIMIT) {
                    if (chrome.runtime) {
                        chrome.runtime.lastError = { message: "QUOTA_BYTES_PER_ITEM quota exceeded" };
                    }
                    callback();
                    if (chrome.runtime) chrome.runtime.lastError = null;
                    return;
                }
            }

            // Check total quota
            const pending = new Map(syncStore);
            for (const [key, value] of Object.entries(data)) {
                pending.set(key, value);
            }
            if (totalBytes(pending) > SYNC_TOTAL_QUOTA_BYTES) {
                if (chrome.runtime) {
                    chrome.runtime.lastError = { message: "QUOTA_BYTES quota exceeded" };
                }
                callback();
                if (chrome.runtime) chrome.runtime.lastError = null;
                return;
            }

            for (const [key, value] of Object.entries(data)) {
                syncStore.set(key, structuredClone(value));
            }
            callback();
        },
        remove(keys, callback) {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const key of keyList) {
                syncStore.delete(key);
            }
            callback();
        },
        clear() {
            syncStore.clear();
        }
    };

    const local = {
        get(keys, callback) {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const result = {};
            for (const key of keyList) {
                if (localStore.has(key)) {
                    result[key] = structuredClone(localStore.get(key));
                }
            }
            callback(result);
        },
        set(data, callback) {
            for (const [key, value] of Object.entries(data)) {
                localStore.set(key, structuredClone(value));
            }
            callback();
        },
        remove(keys, callback) {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const key of keyList) {
                localStore.delete(key);
            }
            callback();
        },
        clear() {
            localStore.clear();
        }
    };

    const chrome = {
        storage: { sync, local },
        runtime: { lastError: null }
    };

    return {
        chrome,
        _syncStore: syncStore,
        _localStore: localStore,
        reset() {
            syncStore.clear();
            localStore.clear();
        }
    };
}
