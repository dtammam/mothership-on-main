(() => {
    const logEl = document.getElementById("log");
    const backendPill = document.getElementById("backend-pill");
    const targetInput = document.getElementById("target-kb");
    const importInput = document.getElementById("import-config");
    const sizeReadout = document.getElementById("size-readout");
    const autoClearToggle = document.getElementById("auto-clear");
    const shrinkButton = document.getElementById("shrink-fit");

    function log(message, data) {
        const time = new Date().toLocaleTimeString();
        const lines = [`[${time}] ${message}`];
        if (data !== undefined) {
            lines.push(JSON.stringify(data, null, 2));
        }
        logEl.textContent = `${lines.join("\n")}\n\n${logEl.textContent}`;
    }

    function updateBackendPill() {
        const sim = Boolean(window.__MSOM_USE_SYNC_SIM__);
        backendPill.textContent = `Backend: ${sim ? "simulator" : "real sync"}`;
        backendPill.style.background = sim ? "#e5efff" : "#d1f2d0";
        backendPill.style.color = sim ? "#0f6cbd" : "#0a5c0a";
    }

    function buildConfig(targetKb) {
        const config = structuredClone(fallbackConfig);
        const targetBytes = Math.max(4, targetKb) * 1024;
        const pad = "https://example.com/".padEnd(40, "x");
        while (msomStorage.getConfigSizeBytes(config) < targetBytes) {
            const n = config.links.length + 1;
            config.links.push({
                section: "Links",
                name: `Example ${n}`,
                url: `${pad}${n}?q=${"y".repeat(32)}`
            });
            if (n % 3 === 0) {
                config.quotes.push(`Quote ${n} ${"z".repeat(64)}`);
            }
            if (n % 5 === 0) {
                config.backgrounds.push(`https://picsum.photos/seed/${n}/1600/900`);
            }
            if (config.links.length > 2000) {
                break; // safety guard
            }
        }
        // Trim back if we overshot the target by a lot
        while (msomStorage.getConfigSizeBytes(config) > targetBytes && config.links.length > 0) {
            const removed = config.links.pop();
            if (config.quotes.length > fallbackConfig.quotes.length && config.quotes.length % 3 === 0) {
                config.quotes.pop();
            }
            if (config.backgrounds.length > fallbackConfig.backgrounds.length && config.backgrounds.length % 5 === 0) {
                config.backgrounds.pop();
            }
            // minor guard to avoid infinite loops
            if (!removed) {
                break;
            }
        }
        return config;
    }

    function estimatePayload(syncConfig) {
        const serialized = JSON.stringify(syncConfig ?? {});
        const chunks = chunkStringBySize(serialized, SYNC_CHUNK_CHAR_TARGET);
        const meta = {
            version: SYNC_VERSION,
            chunkCount: chunks.length,
            updatedAt: new Date().toISOString(),
            checksum: hashString(serialized)
        };
        const items = [];
        items.push([V2_META_KEY, meta]);
        chunks.forEach((chunk, i) => {
            const key = `${V2_CHUNK_PREFIX}${padChunkIndex(i)}`;
            items.push([key, chunk]);
        });
        const perItem = items.map(([key, value]) => key.length + JSON.stringify(value ?? null).length);
        const totalBytes = perItem.reduce((a, b) => a + b, 0);
        return {
            configBytes: serialized.length,
            chunkCount: chunks.length,
            maxItemBytes: Math.max(...perItem),
            totalBytes
        };
    }

    function renderEstimate(syncConfig) {
        if (!syncConfig) {
            sizeReadout.textContent = "(no data yet)";
            return;
        }
        const est = estimatePayload(syncConfig);
        sizeReadout.textContent =
            `config JSON bytes: ${est.configBytes}\n` +
            `chunk count: ${est.chunkCount}\n` +
            `largest item bytes: ${est.maxItemBytes} (limit ~8192)\n` +
            `total bytes written: ${est.totalBytes} (limit ~102400)\n` +
            `headroom: ${Math.max(0, 102400 - est.totalBytes)} bytes`;
    }

    function shrinkToQuota(syncConfig, maxBytes = 102400) {
        const cfg = structuredClone(syncConfig || {});
        let est = estimatePayload(cfg);
        let removed = { links: 0, quotes: 0, backgrounds: 0 };
        while (est.totalBytes > maxBytes) {
            if ((cfg.backgrounds || []).length) {
                cfg.backgrounds.pop();
                removed.backgrounds += 1;
            } else if ((cfg.quotes || []).length) {
                cfg.quotes.pop();
                removed.quotes += 1;
            } else if ((cfg.links || []).length) {
                cfg.links.pop();
                removed.links += 1;
            } else {
                break;
            }
            est = estimatePayload(cfg);
        }
        return { cfg, est, removed };
    }

    async function saveAndLoad(config) {
        const { syncConfig, localAssets } = splitConfig(config);
        const preflightBytes = msomStorage.getConfigSizeBytes(syncConfig);
        const saveResult = await msomStorage.saveSyncConfig(syncConfig);
        if (!saveResult.ok) {
            log("Save failed", { error: saveResult.error, sizeBytes: preflightBytes });
            return;
        }
        const loaded = await msomStorage.loadV2SyncConfig();
        log("Save+load complete", {
            status: loaded.status,
            chunks: saveResult.meta?.chunkCount,
            sizeBytes: preflightBytes,
            checksum: saveResult.meta?.checksum,
            loadedConfigSize: loaded.config ? msomStorage.getConfigSizeBytes(loaded.config) : 0,
            localAssets
        });
    }

    document.getElementById("toggle-backend").addEventListener("click", () => {
        window.__MSOM_USE_SYNC_SIM__ = !window.__MSOM_USE_SYNC_SIM__;
        updateBackendPill();
        log("Toggled backend", { simulator: window.__MSOM_USE_SYNC_SIM__ });
    });

    document.getElementById("save-small").addEventListener("click", async () => {
        const cfg = structuredClone(fallbackConfig);
        renderEstimate(cfg);
        await maybeAutoClear();
        await saveAndLoad(cfg);
    });

    document.getElementById("save-target").addEventListener("click", async () => {
        const kb = parseInt(targetInput.value, 10) || 90;
        const config = buildConfig(kb);
        renderEstimate(config);
        await maybeAutoClear();
        await saveAndLoad(config);
    });

    document.getElementById("import-and-save").addEventListener("click", async () => {
        if (!importInput.files || !importInput.files.length) {
            log("Select a config JSON file first.");
            return;
        }
        try {
            const raw = await importInput.files[0].text();
            const parsed = JSON.parse(raw);
            const { syncConfig, localAssets } = splitConfig(parsed);
            await storageLocal.set({ [LOCAL_ASSETS_KEY]: localAssets });
            renderEstimate(syncConfig);
            await maybeAutoClear();
            await saveAndLoad(syncConfig);
        } catch (error) {
            log("Import failed", { error: error?.message || String(error) });
        }
    });

    shrinkButton.addEventListener("click", async () => {
        if (!importInput.files || !importInput.files.length) {
            log("Select a config JSON file first.");
            return;
        }
        try {
            const raw = await importInput.files[0].text();
            const parsed = JSON.parse(raw);
            const { syncConfig, localAssets } = splitConfig(parsed);
            const shrink = shrinkToQuota(syncConfig);
            renderEstimate(shrink.cfg);
            log("Auto-shrink report", { removed: shrink.removed, finalEstimate: shrink.est });
            await storageLocal.set({ [LOCAL_ASSETS_KEY]: localAssets });
            await maybeAutoClear();
            await saveAndLoad(shrink.cfg);
        } catch (error) {
            log("Import/shrink failed", { error: error?.message || String(error) });
        }
    });

    document.getElementById("migrate-legacy").addEventListener("click", async () => {
        const config = buildConfig(24);
        const { syncConfig } = splitConfig(config);
        await storageSync.set({ [SYNC_KEY]: syncConfig });
        const loaded = await loadConfig();
        log("Migration attempted from legacy single key", {
            loadedSize: msomStorage.getConfigSizeBytes(loaded),
            simulator: window.__MSOM_USE_SYNC_SIM__
        });
    });

    document.getElementById("corrupt-chunk").addEventListener("click", async () => {
        if (!window.__MSOM_USE_SYNC_SIM__) {
            log("Corrupt chunk is simulator-only. Toggle to simulator first.");
            return;
        }
        const config = buildConfig(32);
        const { syncConfig } = splitConfig(config);
        const saveResult = await msomStorage.saveSyncConfig(syncConfig);
        if (!saveResult.ok) {
            log("Save failed, cannot corrupt", saveResult);
            return;
        }
        const missingKey = `${V2_CHUNK_PREFIX}${padChunkIndex(0)}`;
        await storageSync.remove(missingKey);
        const loaded = await msomStorage.loadV2SyncConfig();
        log("Corruption check", { status: loaded.status, reason: loaded.reason, missingKey });
    });

    document.getElementById("clear-storage").addEventListener("click", async () => {
        await clearSyncStorage();
        log("Cleared sync storage keys (v2 + legacy)");
    });

    document.getElementById("export-sync").addEventListener("click", async () => {
        const base = await storageSync.get([V2_META_KEY, V2_TMP_META_KEY, SYNC_KEY, SYNC_CORE_KEY, SYNC_INDEX_KEY]);
        const meta = base[V2_META_KEY];
        const tmpMeta = base[V2_TMP_META_KEY];
        const payload = { meta, tmpMeta, legacy: {} };
        if (base[SYNC_KEY]) payload.legacy[SYNC_KEY] = base[SYNC_KEY];
        if (base[SYNC_CORE_KEY]) payload.legacy[SYNC_CORE_KEY] = base[SYNC_CORE_KEY];
        if (base[SYNC_INDEX_KEY]) payload.legacy[SYNC_INDEX_KEY] = base[SYNC_INDEX_KEY];

        const chunkKeys = [];
        if (meta?.chunkCount > 0) {
            chunkKeys.push(...buildV2ChunkKeys(meta.chunkCount));
        }
        if (tmpMeta?.chunkCount > 0) {
            chunkKeys.push(...buildV2ChunkKeys(tmpMeta.chunkCount, V2_TMP_CHUNK_PREFIX));
        }
        if (chunkKeys.length) {
            const chunks = await storageSync.get(chunkKeys);
            payload.chunks = chunks;
        }

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "mothership-sync-export.json";
        a.click();
        URL.revokeObjectURL(url);
        log("Exported sync state", {
            hasMeta: Boolean(meta),
            hasTmpMeta: Boolean(tmpMeta),
            chunkCount: meta?.chunkCount || 0,
            legacyKeys: Object.keys(payload.legacy)
        });
    });

    updateBackendPill();
    log("Harness ready (simulator on by default)");

    async function maybeAutoClear() {
        if (autoClearToggle?.checked) {
            await clearSyncStorage();
            log("Auto-cleared storage before write");
        }
    }
})();
