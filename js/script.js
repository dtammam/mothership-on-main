/*
    Mothership on Main Interactivity
    Config-driven controls for links, quotes, backgrounds, and search.
    Author: Dean Tammam
    Date: 4/20/2023
*/

const SYNC_KEY = "mothershipSyncConfig";
const LOCAL_ASSETS_KEY = "mothershipLocalAssets";
const LEGACY_KEY = "mothershipConfig";
const SYNC_META_KEY = "mothershipSyncMeta";
const FAVICON_CACHE_KEY = "mothershipFaviconCache";

const fallbackConfig = {
    sections: ["Primary", "Secondary", "Tertiary"],
    links: [],
    quotes: [],
    backgrounds: [],
    search: { defaultEngine: "google", engines: [] }
};

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

const storageSync = {
    async get(keys) {
        if (chrome?.storage?.sync) {
            return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
        }
        const result = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
            const raw = localStorage.getItem(`sync:${key}`);
            result[key] = raw ? JSON.parse(raw) : undefined;
        }
        return result;
    },
    async set(data) {
        if (chrome?.storage?.sync) {
            return new Promise((resolve) => chrome.storage.sync.set(data, resolve));
        }
        Object.entries(data).forEach(([key, value]) => {
            localStorage.setItem(`sync:${key}`, JSON.stringify(value));
        });
    },
    async remove(keys) {
        if (chrome?.storage?.sync) {
            return new Promise((resolve) => chrome.storage.sync.remove(keys, resolve));
        }
        for (const key of Array.isArray(keys) ? keys : [keys]) {
            localStorage.removeItem(`sync:${key}`);
        }
    }
};

let activeConfig = null;
let faviconCache = {};

document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
        console.error("Failed to initialize", error);
    });
});

async function init() {
    const [config, cache] = await Promise.all([loadConfig(), storageLocal.get(FAVICON_CACHE_KEY)]);
    activeConfig = config;
    faviconCache = cache[FAVICON_CACHE_KEY] || {};

    renderAll(activeConfig);
    setupSettings();
    refreshSyncStatus();
}

async function loadConfig() {
    const defaults = await loadDefaultConfig();
    const [storedSync, storedLocal] = await Promise.all([
        storageSync.get(SYNC_KEY),
        storageLocal.get(LOCAL_ASSETS_KEY)
    ]);
    if (!storedSync[SYNC_KEY]) {
        const legacy = await storageLocal.get(LEGACY_KEY);
        if (legacy[LEGACY_KEY]) {
            const legacyMerged = mergeConfig(defaults, legacy[LEGACY_KEY]);
            const { syncConfig, localAssets } = splitConfig(legacyMerged);
            const syncResult = await setSyncConfig(syncConfig);
            await Promise.all([
                storageLocal.set({ [LOCAL_ASSETS_KEY]: localAssets }),
                storageLocal.remove(LEGACY_KEY)
            ]);
            if (syncResult.ok) {
                await storageLocal.set({ [SYNC_META_KEY]: { lastSyncAt: Date.now() } });
            }
            return applyLocalAssets(syncConfig, localAssets);
        }
    }
    const merged = mergeConfig(defaults, storedSync[SYNC_KEY]);
    return applyLocalAssets(merged, storedLocal[LOCAL_ASSETS_KEY]);
}

async function loadDefaultConfig() {
    try {
        const response = await fetch("config.json");
        if (!response.ok) {
            return fallbackConfig;
        }
        return await response.json();
    } catch (error) {
        return fallbackConfig;
    }
}

function mergeConfig(base, override) {
    if (!override) {
        return structuredClone(base);
    }
    return {
        sections: Array.isArray(override.sections) ? override.sections : base.sections,
        links: Array.isArray(override.links) ? override.links : base.links,
        quotes: Array.isArray(override.quotes) ? override.quotes : base.quotes,
        backgrounds: Array.isArray(override.backgrounds) ? override.backgrounds : base.backgrounds,
        search: {
            defaultEngine: override.search?.defaultEngine || base.search.defaultEngine,
            engines: Array.isArray(override.search?.engines) ? override.search.engines : base.search.engines
        }
    };
}

function applyLocalAssets(config, localAssets) {
    const assets = localAssets || {};
    const backgroundUploads = Array.isArray(assets.backgroundUploads) ? assets.backgroundUploads : [];
    const linkIcons = assets.linkIcons || {};
    const linksWithIds = ensureLinkIds(config.links || []);
    const links = linksWithIds.map((link) => {
        const override = isDataUrl(link.iconOverride) ? "" : (link.iconOverride || "");
        const localOverride = linkIcons[link.id];
        return { ...link, iconOverride: localOverride || override };
    });
    return {
        ...config,
        links,
        backgrounds: [...(config.backgrounds || []), ...backgroundUploads]
    };
}

function renderAll(config) {
    renderSearch(config.search);
    renderQuote(config.quotes);
    renderBackground(config.backgrounds);
    renderSections(config);
}

function renderSearch(search) {
    const searchForm = document.getElementById("search-form");
    const searchEngine = document.getElementById("search-engine");
    const searchInput = document.getElementById("search-input");

    searchEngine.innerHTML = "";
    search.engines.forEach((engine) => {
        const option = document.createElement("option");
        option.value = engine.id;
        option.textContent = engine.label;
        searchEngine.appendChild(option);
    });

    const initial = search.defaultEngine || search.engines[0]?.id;
    if (initial) {
        searchEngine.value = initial;
    }

    const updateSearchEngine = (engineId) => {
        const engine = search.engines.find((item) => item.id === engineId) || search.engines[0];
        if (!engine) {
            return;
        }
        searchForm.action = engine.url;
        searchInput.name = engine.queryParam || "q";
    };

    searchEngine.addEventListener("change", () => updateSearchEngine(searchEngine.value));
    updateSearchEngine(searchEngine.value);
}

function renderQuote(quotes) {
    const textContainer = document.getElementById("text-container");
    if (!quotes.length) {
        textContainer.textContent = "Add quotes from the Customize panel.";
        return;
    }
    const randomText = quotes[Math.floor(Math.random() * quotes.length)];
    textContainer.textContent = randomText;
}

function renderBackground(backgrounds) {
    if (!backgrounds.length) {
        return;
    }
    const random = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    document.body.style.backgroundImage = `url("${random}")`;
}

function renderSections(config) {
    const container = document.getElementById("sections-container");
    container.innerHTML = "";

    const sections = deriveSections(config.links, config.sections);
    const linksBySection = new Map();
    sections.forEach((section) => linksBySection.set(section, []));
    config.links.forEach((link) => {
        const section = link.section || "Links";
        if (!linksBySection.has(section)) {
            linksBySection.set(section, []);
        }
        linksBySection.get(section).push(link);
    });

    linksBySection.forEach((links, section) => {
        if (!links.length) {
            return;
        }
        const sectionEl = document.createElement("div");
        sectionEl.className = "section";

        const heading = document.createElement("h2");
        heading.textContent = section;
        sectionEl.appendChild(heading);

        const grid = document.createElement("div");
        grid.className = "links-grid";

        links.forEach((link) => {
            const card = document.createElement("a");
            card.className = "link-card";
            card.href = link.url;
            card.target = "_blank";
            card.rel = "noopener";

            const icon = document.createElement("img");
            icon.alt = "";
            icon.src = "images/icon.png";

            const label = document.createElement("span");
            label.textContent = link.name || link.url;

            card.appendChild(icon);
            card.appendChild(label);
            grid.appendChild(card);

            resolveFavicon(link).then((src) => {
                if (src) {
                    icon.src = src;
                }
            });
        });

        sectionEl.appendChild(grid);
        container.appendChild(sectionEl);
    });
}

function deriveSections(links, existingSections) {
    const ordered = [];
    const seen = new Set();
    if (Array.isArray(existingSections)) {
        existingSections.forEach((section) => {
            if (!seen.has(section)) {
                ordered.push(section);
                seen.add(section);
            }
        });
    }
    links.forEach((link) => {
        const section = link.section || "Links";
        if (!seen.has(section)) {
            ordered.push(section);
            seen.add(section);
        }
    });
    return ordered;
}

async function resolveFavicon(link) {
    if (link.iconOverride) {
        return link.iconOverride;
    }
    const url = safeParseUrl(link.url);
    if (!url) {
        return "";
    }
    const host = url.hostname.toLowerCase();
    if (faviconCache[host]) {
        return faviconCache[host];
    }

    const candidates = [`${url.origin}/favicon.ico`, `${url.origin}/favicon.png`];
    for (const candidate of candidates) {
        const dataUrl = await fetchFavicon(candidate);
        if (dataUrl) {
            faviconCache[host] = dataUrl;
            await storageLocal.set({ [FAVICON_CACHE_KEY]: faviconCache });
            return dataUrl;
        }
    }
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
}

function safeParseUrl(value) {
    try {
        return new URL(value);
    } catch (error) {
        return null;
    }
}

async function fetchFavicon(url) {
    try {
        const response = await fetch(url, { mode: "cors" });
        if (!response.ok) {
            return null;
        }
        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) {
            return null;
        }
        return await blobToDataUrl(blob);
    } catch (error) {
        return null;
    }
}

function blobToDataUrl(blob) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

function setupSettings() {
    const settingsToggle = document.getElementById("settings-toggle");
    const settingsPanel = document.getElementById("settings-panel");
    const settingsSave = document.getElementById("settings-save");
    const settingsCancel = document.getElementById("settings-cancel");
    const addLink = document.getElementById("add-link");
    const addBackgroundUrl = document.getElementById("add-background-url");
    const addEngine = document.getElementById("add-engine");
    const backgroundUpload = document.getElementById("background-upload");
    const quotesUpload = document.getElementById("quotes-upload");
    const searchUpload = document.getElementById("search-upload");
    const exportConfig = document.getElementById("export-config");
    const importConfig = document.getElementById("import-config");
    const resetConfig = document.getElementById("reset-config");

    settingsToggle.addEventListener("click", () => {
        renderSettings(activeConfig);
        settingsPanel.classList.add("open");
        settingsPanel.setAttribute("aria-hidden", "false");
    });

    settingsCancel.addEventListener("click", () => {
        settingsPanel.classList.remove("open");
        settingsPanel.setAttribute("aria-hidden", "true");
    });

    settingsSave.addEventListener("click", async () => {
        const nextConfig = collectConfigFromEditors();
        const { syncConfig, localAssets } = splitConfig(nextConfig);
        activeConfig = applyLocalAssets(syncConfig, localAssets);
        const syncResult = await setSyncConfig(syncConfig);
        await storageLocal.set({ [LOCAL_ASSETS_KEY]: localAssets });
        if (syncResult.ok) {
            await storageLocal.set({ [SYNC_META_KEY]: { lastSyncAt: Date.now() } });
            refreshSyncStatus();
        } else {
            setSyncStatus(`Sync: ${syncResult.error || "error"}`, "warn");
        }
        renderAll(activeConfig);
        settingsPanel.classList.remove("open");
        settingsPanel.setAttribute("aria-hidden", "true");
    });

    settingsPanel.addEventListener("click", (event) => {
        const action = event.target.dataset.action;
        if (!action) {
            return;
        }
        if (action === "remove-link") {
            event.target.closest("[data-link-row]")?.remove();
        }
        if (action === "remove-background") {
            event.target.closest("[data-background-row]")?.remove();
        }
        if (action === "remove-engine") {
            event.target.closest("[data-engine-row]")?.remove();
            refreshDefaultEngineOptions();
        }
    });

    addLink.addEventListener("click", () => addLinkRow());
    addBackgroundUrl.addEventListener("click", () => addBackgroundRow(""));
    addEngine.addEventListener("click", () => {
        addEngineRow({ id: "", label: "", url: "", queryParam: "q" });
        refreshDefaultEngineOptions();
    });

    backgroundUpload.addEventListener("change", async (event) => {
        const files = Array.from(event.target.files || []);
        for (const file of files) {
            const dataUrl = await fileToDataUrl(file);
            addBackgroundRow(dataUrl);
        }
        event.target.value = "";
    });

    quotesUpload.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        const text = await file.text();
        const textarea = document.getElementById("quotes-editor");
        const existing = textarea.value ? `${textarea.value}\n` : "";
        textarea.value = `${existing}${text}`.trim();
        event.target.value = "";
    });

    searchUpload.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        try {
            const payload = JSON.parse(await file.text());
            const imported = payload.engines ? payload : { engines: payload };
            renderSettings(mergeConfig(activeConfig, { search: imported }));
        } catch (error) {
            console.error("Invalid search config");
        } finally {
            event.target.value = "";
        }
    });

    exportConfig.addEventListener("click", () => {
        const data = JSON.stringify(collectConfigFromEditors(), null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "mothership-config.json";
        anchor.click();
        URL.revokeObjectURL(url);
    });

    importConfig.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        try {
            const payload = JSON.parse(await file.text());
            renderSettings(mergeConfig(activeConfig, payload));
        } catch (error) {
            console.error("Invalid config file");
        } finally {
            event.target.value = "";
        }
    });

    resetConfig.addEventListener("click", async () => {
        await Promise.all([
            storageSync.remove(SYNC_KEY),
            storageLocal.remove([LOCAL_ASSETS_KEY, FAVICON_CACHE_KEY, SYNC_META_KEY])
        ]);
        faviconCache = {};
        activeConfig = await loadConfig();
        renderAll(activeConfig);
        settingsPanel.classList.remove("open");
        settingsPanel.setAttribute("aria-hidden", "true");
        refreshSyncStatus();
    });

    settingsPanel.addEventListener("change", (event) => {
        if (event.target.dataset.field === "icon") {
            handleIconUpload(event.target);
        }
        if (event.target.closest("#engines-editor")) {
            refreshDefaultEngineOptions();
        }
    });
}

function renderSettings(config) {
    renderLinksEditor(config.links);
    renderBackgroundsEditor(config.backgrounds);
    renderQuotesEditor(config.quotes);
    renderSearchEditor(config.search);
}

function renderLinksEditor(links) {
    const container = document.getElementById("links-editor");
    const template = document.getElementById("link-row-template");
    container.innerHTML = "";
    links.forEach((link) => {
        const row = template.content.firstElementChild.cloneNode(true);
        row.dataset.linkId = link.id || createId();
        row.dataset.iconOverride = link.iconOverride || "";
        row.querySelector('[data-field="name"]').value = link.name || "";
        row.querySelector('[data-field="url"]').value = link.url || "";
        row.querySelector('[data-field="section"]').value = link.section || "";
        const preview = row.querySelector(".icon-preview");
        preview.src = link.iconOverride || "images/icon.png";
        container.appendChild(row);
    });
    if (!links.length) {
        addLinkRow();
    }
}

function renderBackgroundsEditor(backgrounds) {
    const container = document.getElementById("backgrounds-editor");
    const template = document.getElementById("background-row-template");
    container.innerHTML = "";
    backgrounds.forEach((background) => addBackgroundRow(background, container, template));
    if (!backgrounds.length) {
        addBackgroundRow("", container, template);
    }
}

function renderQuotesEditor(quotes) {
    const textarea = document.getElementById("quotes-editor");
    textarea.value = quotes.join("\n");
}

function renderSearchEditor(search) {
    const engines = Array.isArray(search.engines) ? search.engines : [];
    const container = document.getElementById("engines-editor");
    const template = document.getElementById("engine-row-template");
    container.innerHTML = "";
    engines.forEach((engine) => addEngineRow(engine, container, template));
    if (!engines.length) {
        addEngineRow({ id: "google", label: "Google", url: "https://www.google.com/search", queryParam: "q" }, container, template);
    }
    refreshDefaultEngineOptions(search.defaultEngine);
}

function addLinkRow() {
    const container = document.getElementById("links-editor");
    const template = document.getElementById("link-row-template");
    const row = template.content.firstElementChild.cloneNode(true);
    row.dataset.linkId = createId();
    row.dataset.iconOverride = "";
    row.querySelector(".icon-preview").src = "images/icon.png";
    container.appendChild(row);
}

function addBackgroundRow(value, containerOverride, templateOverride) {
    const container = containerOverride || document.getElementById("backgrounds-editor");
    const template = templateOverride || document.getElementById("background-row-template");
    const row = template.content.firstElementChild.cloneNode(true);
    const input = row.querySelector('[data-field="background"]');
    row.dataset.backgroundValue = value || "";
    input.value = value || "";
    const preview = row.querySelector(".thumb-preview");
    preview.src = value || "images/icon.png";
    container.appendChild(row);
}

function addEngineRow(engine, containerOverride, templateOverride) {
    const container = containerOverride || document.getElementById("engines-editor");
    const template = templateOverride || document.getElementById("engine-row-template");
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector('[data-field="id"]').value = engine.id || "";
    row.querySelector('[data-field="label"]').value = engine.label || "";
    row.querySelector('[data-field="url"]').value = engine.url || "";
    row.querySelector('[data-field="queryParam"]').value = engine.queryParam || "q";
    container.appendChild(row);
}

function refreshDefaultEngineOptions(selectedValue) {
    const select = document.getElementById("default-engine");
    const engineRows = document.querySelectorAll("[data-engine-row]");
    const previous = selectedValue || select.value;
    select.innerHTML = "";
    engineRows.forEach((row) => {
        const id = row.querySelector('[data-field="id"]').value.trim();
        const label = row.querySelector('[data-field="label"]').value.trim() || id;
        if (!id) {
            return;
        }
        const option = document.createElement("option");
        option.value = id;
        option.textContent = label;
        select.appendChild(option);
    });
    if (previous) {
        select.value = previous;
    }
}

function collectConfigFromEditors() {
    const links = collectLinks();
    const backgrounds = collectBackgrounds();
    const quotes = collectQuotes();
    const search = collectSearch();
    return {
        sections: deriveSections(links, activeConfig?.sections || []),
        links,
        quotes,
        backgrounds,
        search
    };
}

function collectLinks() {
    const rows = document.querySelectorAll("[data-link-row]");
    const links = [];
    rows.forEach((row) => {
        const id = row.dataset.linkId || createId();
        const name = row.querySelector('[data-field="name"]').value.trim();
        const url = row.querySelector('[data-field="url"]').value.trim();
        const section = row.querySelector('[data-field="section"]').value.trim();
        const iconOverride = row.dataset.iconOverride || "";
        if (!name && !url) {
            return;
        }
        if (!url) {
            return;
        }
        links.push({
            id,
            name: name || url,
            url,
            section: section || "Links",
            iconOverride
        });
    });
    return links;
}

function collectBackgrounds() {
    const rows = document.querySelectorAll("[data-background-row]");
    const backgrounds = [];
    rows.forEach((row) => {
        const input = row.querySelector('[data-field="background"]');
        const value = (input.value || row.dataset.backgroundValue || "").trim();
        if (value) {
            backgrounds.push(value);
        }
    });
    return backgrounds;
}

function collectQuotes() {
    const textarea = document.getElementById("quotes-editor");
    return textarea.value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

function collectSearch() {
    const rows = document.querySelectorAll("[data-engine-row]");
    const engines = [];
    rows.forEach((row) => {
        const id = row.querySelector('[data-field="id"]').value.trim();
        const label = row.querySelector('[data-field="label"]').value.trim();
        const url = row.querySelector('[data-field="url"]').value.trim();
        const queryParam = row.querySelector('[data-field="queryParam"]').value.trim() || "q";
        if (!id || !url) {
            return;
        }
        engines.push({ id, label: label || id, url, queryParam });
    });
    const defaultEngine = document.getElementById("default-engine").value || engines[0]?.id || "";
    return { defaultEngine, engines };
}

function splitConfig(config) {
    const linksWithIds = ensureLinkIds(config.links || []);
    const localAssets = {
        backgroundUploads: [],
        linkIcons: {}
    };
    const backgrounds = (config.backgrounds || []).filter((background) => {
        if (isDataUrl(background)) {
            localAssets.backgroundUploads.push(background);
            return false;
        }
        return true;
    });
    const links = linksWithIds.map((link) => {
        const next = { ...link };
        if (isDataUrl(link.iconOverride)) {
            localAssets.linkIcons[link.id] = link.iconOverride;
            next.iconOverride = "";
        }
        return next;
    });
    return {
        syncConfig: {
            ...config,
            links,
            backgrounds
        },
        localAssets
    };
}

async function setSyncConfig(syncConfig) {
    if (chrome?.storage?.sync) {
        return new Promise((resolve) => {
            chrome.storage.sync.set({ [SYNC_KEY]: syncConfig }, () => {
                const error = chrome.runtime?.lastError;
                if (error) {
                    resolve({ ok: false, error: error.message });
                    return;
                }
                resolve({ ok: true });
            });
        });
    }
    await storageSync.set({ [SYNC_KEY]: syncConfig });
    return { ok: true };
}

async function refreshSyncStatus() {
    const syncAvailable = Boolean(chrome?.storage?.sync);
    if (!syncAvailable) {
        setSyncStatus("Sync: unavailable", "off");
        return;
    }
    const meta = await storageLocal.get(SYNC_META_KEY);
    const lastSyncAt = meta[SYNC_META_KEY]?.lastSyncAt;
    if (lastSyncAt) {
        setSyncStatus(`Sync: on · ${timeAgo(lastSyncAt)}`, "on");
    } else {
        setSyncStatus("Sync: on", "on");
    }
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

function timeAgo(timestamp) {
    const delta = Date.now() - timestamp;
    if (delta < 60000) {
        return "just now";
    }
    const minutes = Math.floor(delta / 60000);
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function ensureLinkIds(links) {
    return links.map((link) => {
        if (link.id) {
            return link;
        }
        return { ...link, id: createId() };
    });
}

function createId() {
    if (crypto?.randomUUID) {
        return crypto.randomUUID();
    }
    return `link_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isDataUrl(value) {
    return typeof value === "string" && value.startsWith("data:");
}

async function handleIconUpload(input) {
    const row = input.closest("[data-link-row]");
    const file = input.files?.[0];
    if (!row || !file) {
        return;
    }
    const dataUrl = await fileToDataUrl(file);
    row.dataset.iconOverride = dataUrl;
    const preview = row.querySelector(".icon-preview");
    if (preview) {
        preview.src = dataUrl;
    }
    input.value = "";
}

function fileToDataUrl(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}
