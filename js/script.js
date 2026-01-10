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
const BACKGROUND_THUMBS_KEY = "mothershipBackgroundThumbs";
const DEFAULT_LINK_SECTION = "Links";

const fallbackConfig = {
    branding: { title: "Mothership on Main", subtitle: "Your favorite bookmark replacement tool", quotesTitle: "Quotes" },
    sections: [DEFAULT_LINK_SECTION],
    links: [],
    quotes: [],
    backgrounds: [],
    backgroundMode: "gradient_dynamic",
    layout: { maxColumns: 4, minCardWidth: 180 },
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
let backgroundThumbs = {};
let isRearranging = false;
let lastRenderLinks = [];
let gridObserver = null;
let currentDragType = "";
let currentDragSection = null;
let backgroundPreviewObserver = null;
let backgroundPreviewPanel = null;
let canRearrangeEditor = () => false;

document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
        console.error("Failed to initialize", error);
    });
});

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
    const derivedSections = Array.isArray(override.links) ? deriveSections(override.links, []) : base.sections;
    const nextSections = Array.isArray(override.sections) ? override.sections : derivedSections;
    return {
        branding: {
            title: override.branding?.title || base.branding.title,
            subtitle: override.branding?.subtitle || base.branding.subtitle,
            quotesTitle: override.branding?.quotesTitle || base.branding.quotesTitle
        },
        sections: nextSections,
        links: Array.isArray(override.links) ? override.links : base.links,
        quotes: Array.isArray(override.quotes) ? override.quotes : base.quotes,
        backgrounds: Array.isArray(override.backgrounds) ? override.backgrounds : base.backgrounds,
        backgroundMode: override.backgroundMode || base.backgroundMode,
        layout: {
            maxColumns: Number.isFinite(override.layout?.maxColumns) ? override.layout.maxColumns : base.layout.maxColumns,
            minCardWidth: Number.isFinite(override.layout?.minCardWidth) ? override.layout.minCardWidth : base.layout.minCardWidth
        },
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
    renderBranding(config.branding);
    renderSearch(config.search);
    renderQuote(config.quotes);
    renderBackground(config);
    renderSections(config);
    updateGridColumns(config.layout);
}

function renderBranding(branding) {
    const title = document.getElementById("title");
    const subtitle = document.getElementById("subtitle");
    const quotesTitle = document.getElementById("quotes-title");
    if (title && branding?.title) {
        title.textContent = branding.title;
    }
    if (subtitle && branding?.subtitle) {
        subtitle.textContent = branding.subtitle;
    }
    if (quotesTitle && branding?.quotesTitle) {
        quotesTitle.textContent = branding.quotesTitle;
    }
    if (branding?.title) {
        document.title = branding.title;
    }
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

function renderBackground(config) {
    const mode = config.backgroundMode || "images";
    if (mode === "images") {
        document.body.classList.add("background-image");
        renderImageBackground(config.backgrounds);
        return;
    }
    document.body.classList.remove("background-image");
    document.body.style.backgroundImage = "";
    applyGradientMode(mode);
}

function renderImageBackground(backgrounds) {
    if (!backgrounds.length) {
        document.body.style.backgroundImage = "";
        return;
    }
    const random = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    document.body.style.backgroundImage = `url("${random}")`;
}

function renderSections(config) {
    const container = document.getElementById("sections-container");
    container.innerHTML = "";

    const sections = deriveSections(config.links, config.sections);
    lastRenderLinks = ensureLinkIds(config.links || []);
    const linksBySection = new Map();
    sections.forEach((section) => linksBySection.set(section, []));
    lastRenderLinks.forEach((link) => {
        const section = link.section || DEFAULT_LINK_SECTION;
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
        sectionEl.dataset.section = section;
        sectionEl.draggable = isRearranging;

        const header = document.createElement("div");
        header.className = "section-header";
        header.dataset.drag = "section";
        const heading = document.createElement("h2");
        heading.textContent = section;
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "section-handle";
        handle.dataset.drag = "section";
        handle.draggable = isRearranging;
        handle.textContent = "Drag to reorder";
        header.appendChild(heading);
        header.appendChild(handle);
        sectionEl.appendChild(header);

        const grid = document.createElement("div");
        grid.className = "links-grid";
        grid.dataset.section = section;

        links.forEach((link) => {
            const card = document.createElement("a");
            card.className = "link-card";
            card.href = link.url;
            card.target = "_self";
            card.dataset.linkId = link.id;
            card.dataset.section = section;
            card.draggable = isRearranging;

            const icon = document.createElement("img");
            icon.alt = "";
            icon.src = "images/icon.png";

            const label = document.createElement("span");
            label.textContent = link.name || link.url;

            card.appendChild(icon);
            card.appendChild(label);
            if (isRearranging) {
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "link-remove";
                remove.dataset.action = "remove-link-card";
                remove.textContent = "X";
                card.appendChild(remove);
            }
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
        const section = link.section || DEFAULT_LINK_SECTION;
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
            if (activeConfig?.backgroundMode === "gradient_dynamic") {
                applyDynamicGradient();
            }
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
    const rearrangeToggle = document.getElementById("rearrange-toggle");
    const settingsPanel = document.getElementById("settings-panel");
    const settingsSave = document.getElementById("settings-save");
    const settingsSaveBottom = document.getElementById("settings-save-bottom");
    const settingsCancel = document.getElementById("settings-cancel");
    const settingsCancelBottom = document.getElementById("settings-cancel-bottom");
    const addLink = document.getElementById("add-link");
    const addSection = document.getElementById("add-section");
    const newSectionName = document.getElementById("new-section-name");
    const addBackgroundUrl = document.getElementById("add-background-url");
    const backgroundMode = document.getElementById("background-mode");
    const addEngine = document.getElementById("add-engine");
    const backgroundUpload = document.getElementById("background-upload");
    const backgroundUploadName = document.getElementById("background-upload-name");
    const quotesUpload = document.getElementById("quotes-upload");
    const quotesUploadName = document.getElementById("quotes-upload-name");
    const searchUpload = document.getElementById("search-upload");
    const searchUploadName = document.getElementById("search-upload-name");
    const exportConfig = document.getElementById("export-config");
    const importConfig = document.getElementById("import-config");
    const importConfigName = document.getElementById("import-config-name");
    const resetConfig = document.getElementById("reset-config");
    const linksEditor = document.getElementById("links-editor");
    const sectionsContainer = document.getElementById("sections-container");
    const layoutMaxColumns = document.getElementById("layout-max-columns");
    const settingsNav = document.querySelector(".settings-nav");

    setupSettingsNav(settingsPanel, settingsNav);
    canRearrangeEditor = () => settingsPanel.classList.contains("open");

    const saveConfig = async (closePanel) => {
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
        if (closePanel) {
            settingsPanel.classList.remove("open");
            settingsPanel.setAttribute("aria-hidden", "true");
        }
    };

    settingsToggle.addEventListener("click", () => {
        if (settingsPanel.classList.contains("open")) {
            settingsPanel.classList.remove("open");
            settingsPanel.setAttribute("aria-hidden", "true");
            setRearrangeMode(false);
            updateLinkRowDragState();
            return;
        }
        setRearrangeMode(false);
        renderSettings(activeConfig);
        settingsPanel.classList.add("open");
        settingsPanel.setAttribute("aria-hidden", "false");
        updateLinkRowDragState();
    });

    rearrangeToggle.addEventListener("click", async () => {
        if (!isRearranging) {
            setRearrangeMode(true);
            return;
        }
        await persistActiveConfig();
        setRearrangeMode(false);
    });

    if (settingsCancel) {
        settingsCancel.addEventListener("click", () => {
            settingsPanel.classList.remove("open");
            settingsPanel.setAttribute("aria-hidden", "true");
            setRearrangeMode(false);
            updateLinkRowDragState();
        });
    }

    settingsCancelBottom.addEventListener("click", () => {
        settingsPanel.classList.remove("open");
        settingsPanel.setAttribute("aria-hidden", "true");
        setRearrangeMode(false);
        updateLinkRowDragState();
    });

    if (settingsSave) {
        settingsSave.addEventListener("click", async () => {
            await saveConfig(true);
            setRearrangeMode(false);
        });
    }

    settingsSaveBottom.addEventListener("click", async () => {
        await saveConfig(true);
        setRearrangeMode(false);
    });

    settingsPanel.addEventListener("click", (event) => {
        const action = event.target.dataset.action;
        if (!action) {
            return;
        }
        if (action === "quick-add-link") {
            const row = addLinkRow();
            const section = document.getElementById("settings-links");
            section?.scrollIntoView({ block: "start" });
            row?.querySelector('[data-field="name"]')?.focus();
        }
        if (action === "quick-add-section") {
            const sectionName = window.prompt("New category name");
            if (!sectionName) {
                return;
            }
            ensureLinksSection(sectionName);
            const section = document.querySelector(`[data-section-block][data-section="${sectionName}"]`);
            section?.scrollIntoView({ block: "start" });
        }
        if (action === "quick-add-engine") {
            addEngineRow({ id: "", label: "", url: "", queryParam: "q" });
            refreshDefaultEngineOptions();
            const section = document.getElementById("settings-search");
            section?.scrollIntoView({ block: "start" });
            const lastEngine = document.querySelector("#engines-editor [data-engine-row]:last-child");
            lastEngine?.querySelector('[data-field="id"]')?.focus();
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
        if (action === "remove-section") {
            event.target.closest("[data-section-block]")?.remove();
        }
    });

    addLink.addEventListener("click", () => addLinkRow());
    addSection.addEventListener("click", () => {
        const name = newSectionName.value.trim();
        if (!name) {
            return;
        }
        ensureLinksSection(name);
        newSectionName.value = "";
    });
    addBackgroundUrl.addEventListener("click", () => addBackgroundRow(""));
    addEngine.addEventListener("click", () => {
        addEngineRow({ id: "", label: "", url: "", queryParam: "q" });
        refreshDefaultEngineOptions();
    });

        backgroundUpload.addEventListener("change", async (event) => {
            const files = Array.from(event.target.files || []);
            updateFileLabel(backgroundUploadName, files, "No files selected");
            for (const file of files) {
                const dataUrl = await fileToDataUrl(file);
                addBackgroundRow(dataUrl);
                storeBackgroundThumb(dataUrl);
            }
            event.target.value = "";
        });

    quotesUpload.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        updateFileLabel(quotesUploadName, [file], "No file selected");
        const text = await file.text();
        const textarea = document.getElementById("quotes-editor");
        textarea.value = text.trim();
        event.target.value = "";
    });

    searchUpload.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        updateFileLabel(searchUploadName, [file], "No file selected");
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
        updateFileLabel(importConfigName, [file], "No file selected");
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
        const confirmed = window.confirm("Reset all settings to defaults? This cannot be undone.");
        if (!confirmed) {
            return;
        }
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
        setRearrangeMode(false);
    });

    settingsPanel.addEventListener("change", (event) => {
        if (event.target.dataset.field === "icon") {
            handleIconUpload(event.target);
        }
        if (event.target.closest("#engines-editor")) {
            refreshDefaultEngineOptions();
        }
    });

    layoutMaxColumns.addEventListener("change", () => {
        const nextLayout = collectLayout();
        activeConfig = { ...activeConfig, layout: nextLayout };
        updateGridColumns(activeConfig.layout);
    });

    backgroundMode.addEventListener("change", () => {
        activeConfig = { ...activeConfig, backgroundMode: backgroundMode.value };
        renderBackground(activeConfig);
    });

    linksEditor.addEventListener("dragstart", (event) => {
        if (!isRearranging && !canRearrangeEditor()) {
            return;
        }
        const row = event.target.closest("[data-link-row]");
        if (!row) {
            return;
        }
        row.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", row.dataset.linkId || "");
    });

    linksEditor.addEventListener("dragend", (event) => {
        const row = event.target.closest("[data-link-row]");
        if (row) {
            row.classList.remove("dragging");
        }
    });

    linksEditor.addEventListener("dragover", (event) => {
        if (!isRearranging && !canRearrangeEditor()) {
            return;
        }
        const list = event.target.closest("[data-section-list]");
        if (!list) {
            return;
        }
        event.preventDefault();
        const row = event.target.closest("[data-link-row]");
        const dragging = linksEditor.querySelector(".link-row.dragging");
        if (row && dragging && row !== dragging && list.contains(row)) {
            list.insertBefore(dragging, row);
        }
    });

    linksEditor.addEventListener("drop", (event) => {
        if (!isRearranging && !canRearrangeEditor()) {
            return;
        }
        const list = event.target.closest("[data-section-list]");
        if (!list) {
            return;
        }
        event.preventDefault();
        const dragging = linksEditor.querySelector(".link-row.dragging");
        if (dragging && !list.contains(dragging)) {
            list.appendChild(dragging);
        }
        if (dragging) {
            const section = list.dataset.section;
            const sectionInput = dragging.querySelector('[data-field="section"]');
            if (sectionInput) {
                sectionInput.value = section;
            }
        }
    });

    sectionsContainer.addEventListener("dragstart", (event) => {
        if (!isRearranging) {
            return;
        }
        const handle = event.target.closest("[data-drag=\"section\"]");
        const card = event.target.closest(".link-card");
        if (handle && !card) {
            const sectionEl = handle.closest(".section");
            if (!sectionEl) {
                return;
            }
            sectionEl.classList.add("dragging");
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", sectionEl.dataset.section || "");
            event.dataTransfer.setData("mothership-drag", "section");
            currentDragType = "section";
            currentDragSection = sectionEl;
            return;
        }
        if (!card) {
            return;
        }
        card.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.dataset.linkId || "");
        event.dataTransfer.setData("mothership-drag", "link");
        currentDragType = "link";
        currentDragSection = null;
    });

    sectionsContainer.addEventListener("dragend", (event) => {
        const sectionEl = event.target.closest(".section");
        if (sectionEl) {
            sectionEl.classList.remove("dragging");
        }
        const card = event.target.closest(".link-card");
        if (card) {
            card.classList.remove("dragging");
        }
        currentDragType = "";
        currentDragSection = null;
    });

    sectionsContainer.addEventListener("dragover", (event) => {
        if (!isRearranging) {
            return;
        }
        const dragType = event.dataTransfer.getData("mothership-drag") || currentDragType;
        if (dragType === "section") {
            const sectionEl = event.target.closest(".section");
            const draggingSection = currentDragSection || sectionsContainer.querySelector(".section.dragging");
            if (sectionEl && draggingSection && sectionEl !== draggingSection) {
                event.preventDefault();
                sectionsContainer.insertBefore(draggingSection, sectionEl);
            }
            return;
        }
        const grid = event.target.closest(".links-grid");
        if (!grid) {
            return;
        }
        event.preventDefault();
        const card = event.target.closest(".link-card");
        const dragging = sectionsContainer.querySelector(".link-card.dragging");
        if (card && dragging && card !== dragging && grid.contains(card)) {
            grid.insertBefore(dragging, card);
        }
    });

    sectionsContainer.addEventListener("drop", (event) => {
        if (!isRearranging) {
            return;
        }
        const dragType = event.dataTransfer.getData("mothership-drag") || currentDragType;
        if (dragType === "section") {
            event.preventDefault();
            return;
        }
        const grid = event.target.closest(".links-grid");
        if (!grid) {
            return;
        }
        event.preventDefault();
        const dragging = sectionsContainer.querySelector(".link-card.dragging");
        if (dragging && !grid.contains(dragging)) {
            grid.appendChild(dragging);
        }
        if (dragging) {
            dragging.dataset.section = grid.dataset.section || dragging.dataset.section;
        }
    });

    sectionsContainer.addEventListener("click", (event) => {
        const action = event.target.dataset.action;
        if (isRearranging && event.target.closest(".link-card")) {
            event.preventDefault();
        }
        if (action === "remove-link-card") {
            event.preventDefault();
            const card = event.target.closest(".link-card");
            const grid = card?.closest(".links-grid");
            const section = card?.closest(".section");
            card?.remove();
            if (grid && grid.querySelectorAll(".link-card").length === 0) {
                section?.remove();
            }
        }
    });
}

function setupSettingsNav(panel, nav) {
    if (!panel || !nav) {
        return;
    }
    const links = Array.from(nav.querySelectorAll("a[href^=\"#settings-\"]"));
    const sections = links
        .map((link) => document.querySelector(link.getAttribute("href")))
        .filter(Boolean);

    if (!links.length || !sections.length) {
        return;
    }

    const updateOffset = () => {
        const topbar = panel.querySelector(".settings-topbar");
        const offset = (topbar ? topbar.offsetHeight : nav.offsetHeight) + 16;
        panel.style.setProperty("--settings-nav-offset", `${offset}px`);
    };

    const setActive = (id) => {
        links.forEach((link) => {
            const isActive = link.getAttribute("href") === `#${id}`;
            link.classList.toggle("is-active", isActive);
        });
    };

    const updateActiveFromScroll = () => {
        const topbar = panel.querySelector(".settings-topbar");
        const offset = (topbar ? topbar.offsetHeight : nav.offsetHeight) + 8;
        const panelRect = panel.getBoundingClientRect();
        let activeId = sections[0].id;
        let smallestDistance = Number.POSITIVE_INFINITY;
        sections.forEach((section) => {
            const sectionRect = section.getBoundingClientRect();
            const distance = Math.abs(sectionRect.top - panelRect.top - offset);
            if (distance < smallestDistance) {
                smallestDistance = distance;
                activeId = section.id;
            }
        });
        setActive(activeId);
    };

    let scrollRaf = null;
    panel.addEventListener("scroll", () => {
        if (scrollRaf) {
            return;
        }
        scrollRaf = requestAnimationFrame(() => {
            scrollRaf = null;
            updateActiveFromScroll();
        });
    });

    links.forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            const target = document.querySelector(link.getAttribute("href"));
            if (!target) {
                return;
            }
            const topbar = panel.querySelector(".settings-topbar");
            const offset = (topbar ? topbar.offsetHeight : nav.offsetHeight) + 12;
            panel.scrollTo({
                top: Math.max(0, target.offsetTop - offset),
                behavior: "smooth"
            });
            setActive(target.id);
        });
    });

    updateOffset();
    updateActiveFromScroll();
    window.addEventListener("resize", () => {
        updateOffset();
        updateActiveFromScroll();
    });
}

function renderSettings(config) {
    renderLinksEditor(config.links, config.sections);
    renderBackgroundsEditor(config.backgrounds);
    renderQuotesEditor(config.quotes);
    renderSearchEditor(config.search);
    renderLayoutEditor(config.layout);
    renderBrandingEditor(config.branding);
    renderBackgroundModeEditor(config.backgroundMode);
}

function renderLinksEditor(links, sectionsOverride) {
    const container = document.getElementById("links-editor");
    const template = document.getElementById("link-row-template");
    container.innerHTML = "";
    const sections = deriveSections(links, sectionsOverride || []);
    const sectionBlocks = new Map();

    const ensureSection = (sectionName) => {
        if (sectionBlocks.has(sectionName)) {
            return sectionBlocks.get(sectionName);
        }
        const list = createLinksSection(sectionName, container);
        sectionBlocks.set(sectionName, list);
        return list;
    };

    if (!sections.length) {
        sections.push(DEFAULT_LINK_SECTION);
    }

    sections.forEach((section) => ensureSection(section));

    links.forEach((link) => {
        const row = template.content.firstElementChild.cloneNode(true);
        row.dataset.linkId = link.id || createId();
        row.dataset.iconOverride = link.iconOverride || "";
        row.querySelector('[data-field="name"]').value = link.name || "";
        row.querySelector('[data-field="url"]').value = link.url || "";
        row.querySelector('[data-field="section"]').value = link.section || DEFAULT_LINK_SECTION;
        const preview = row.querySelector(".icon-preview");
        preview.src = link.iconOverride || "images/icon.png";
        row.draggable = isRearranging;
        const sectionName = link.section || DEFAULT_LINK_SECTION;
        const list = ensureSection(sectionName);
        list.appendChild(row);
    });
    if (!links.length) {
        addLinkRow(DEFAULT_LINK_SECTION);
    }
    updateLinkRowDragState();
}

function getDefaultLinkSectionFromMain() {
    const firstSection = document.querySelector("#sections-container .section");
    return firstSection?.dataset.section || DEFAULT_LINK_SECTION;
}

function ensureLinksSection(sectionName) {
    const container = document.getElementById("links-editor");
    const existing = container.querySelector(`[data-section-block][data-section="${sectionName}"]`);
    if (existing) {
        return;
    }
    createLinksSection(sectionName, container);
}

function createLinksSection(sectionName, container) {
    const sectionEl = document.createElement("div");
    sectionEl.className = "links-section";
    sectionEl.dataset.section = sectionName;
    sectionEl.dataset.sectionBlock = "true";
    const header = document.createElement("div");
    header.className = "links-section-header";
    const heading = document.createElement("h4");
    heading.textContent = sectionName;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost-button section-remove";
    remove.dataset.action = "remove-section";
    remove.textContent = "X";
    const list = document.createElement("div");
    list.className = "section-list";
    list.dataset.sectionList = "true";
    list.dataset.section = sectionName;
    header.appendChild(heading);
    header.appendChild(remove);
    sectionEl.appendChild(header);
    sectionEl.appendChild(list);
    container.appendChild(sectionEl);
    return list;
}

function renderBackgroundsEditor(backgrounds) {
    const container = document.getElementById("backgrounds-editor");
    const template = document.getElementById("background-row-template");
    container.innerHTML = "";
    backgrounds.forEach((background) => addBackgroundRow(background, container, template));
    if (!backgrounds.length) {
        addBackgroundRow("", container, template);
    }
    ensureBackgroundPreviewObserver(document.getElementById("settings-panel"));
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

function renderBackgroundModeEditor(mode) {
    const select = document.getElementById("background-mode");
    if (!select) {
        return;
    }
    select.value = mode || "gradient_signature";
}
function renderBrandingEditor(branding) {
    const title = document.getElementById("branding-title");
    const subtitle = document.getElementById("branding-subtitle");
    const quotesTitle = document.getElementById("branding-quotes-title");
    if (title) {
        title.value = branding?.title || "";
    }
    if (subtitle) {
        subtitle.value = branding?.subtitle || "";
    }
    if (quotesTitle) {
        quotesTitle.value = branding?.quotesTitle || "";
    }
}
function renderLayoutEditor(layout) {
    const input = document.getElementById("layout-max-columns");
    const value = Number.isFinite(layout?.maxColumns) ? layout.maxColumns : 4;
    input.value = value;
}

function addLinkRow(sectionName) {
    const container = document.getElementById("links-editor");
    const template = document.getElementById("link-row-template");
    const resolvedSection = sectionName || getDefaultLinkSectionFromMain();
    ensureLinksSection(resolvedSection);
    const targetList =
        container.querySelector(`[data-section-list][data-section="${resolvedSection}"]`) ||
        container.querySelector("[data-section-list]");
    const row = template.content.firstElementChild.cloneNode(true);
    row.dataset.linkId = createId();
    row.dataset.iconOverride = "";
    row.querySelector(".icon-preview").src = "images/icon.png";
    row.querySelector('[data-field="section"]').value = resolvedSection;
    row.draggable = isRearranging || canRearrangeEditor();
    if (targetList) {
        targetList.prepend(row);
        row.scrollIntoView({ block: "nearest" });
    } else {
        container.appendChild(row);
    }
    updateLinkRowDragState();
    return row;
}

function addBackgroundRow(value, containerOverride, templateOverride) {
    const container = containerOverride || document.getElementById("backgrounds-editor");
    const template = templateOverride || document.getElementById("background-row-template");
    const row = template.content.firstElementChild.cloneNode(true);
    const input = row.querySelector('[data-field="background"]');
    row.dataset.backgroundValue = value || "";
    input.value = value || "";
    const preview = row.querySelector(".thumb-preview");
    container.appendChild(row);
    queueBackgroundPreview(preview, value);
}

function ensureBackgroundPreviewObserver(panel) {
    if (!panel || typeof IntersectionObserver === "undefined") {
        return null;
    }
    if (backgroundPreviewObserver && backgroundPreviewPanel === panel) {
        return backgroundPreviewObserver;
    }
    if (backgroundPreviewObserver) {
        backgroundPreviewObserver.disconnect();
    }
    backgroundPreviewPanel = panel;
    backgroundPreviewObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }
                const img = entry.target;
                const src = img.dataset.src;
                if (src) {
                    img.src = src;
                    img.removeAttribute("data-src");
                    if (isDataUrl(src)) {
                        storeBackgroundThumb(src).then((thumb) => {
                            if (thumb) {
                                img.src = thumb;
                            }
                        });
                    }
                }
                backgroundPreviewObserver.unobserve(img);
            });
        },
        { root: panel, rootMargin: "200px 0px" }
    );
    return backgroundPreviewObserver;
}

function queueBackgroundPreview(preview, value) {
    if (!preview) {
        return;
    }
    if (!value) {
        preview.src = "images/icon.png";
        preview.removeAttribute("data-src");
        return;
    }
    const thumb = getBackgroundThumb(value);
    if (thumb) {
        preview.src = thumb;
        preview.removeAttribute("data-src");
        return;
    }
    preview.src = "images/icon.png";
    preview.dataset.src = value;
    const panel = document.getElementById("settings-panel");
    const observer = ensureBackgroundPreviewObserver(panel);
    if (!observer) {
        preview.src = value;
        preview.removeAttribute("data-src");
        return;
    }
    observer.observe(preview);
}

function getBackgroundThumb(value) {
    if (!isDataUrl(value)) {
        return "";
    }
    const key = getBackgroundThumbKey(value);
    return backgroundThumbs[key] || "";
}

function getBackgroundThumbKey(value) {
    return `bg_${hashString(value)}`;
}

async function storeBackgroundThumb(value) {
    if (!isDataUrl(value)) {
        return "";
    }
    const key = getBackgroundThumbKey(value);
    if (backgroundThumbs[key]) {
        return backgroundThumbs[key];
    }
    const thumb = await createImageThumbnail(value);
    if (!thumb) {
        return "";
    }
    backgroundThumbs = { ...backgroundThumbs, [key]: thumb };
    await storageLocal.set({ [BACKGROUND_THUMBS_KEY]: backgroundThumbs });
    return thumb;
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
    const branding = collectBranding();
    const sections = collectSectionsFromEditor();
    const links = collectLinks();
    const backgrounds = collectBackgrounds();
    const quotes = collectQuotes();
    const search = collectSearch();
    const layout = collectLayout();
    const backgroundMode = collectBackgroundMode();
    return {
        branding,
        sections: sections.length ? sections : deriveSections(links, []),
        links,
        quotes,
        backgrounds,
        backgroundMode,
        layout,
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
            section: section || DEFAULT_LINK_SECTION,
            iconOverride
        });
    });
    return links;
}

function setRearrangeMode(enabled) {
    isRearranging = enabled;
    const panel = document.getElementById("settings-panel");
    if (panel) {
        panel.classList.toggle("rearrange", enabled);
    }
    document.body.classList.toggle("rearrange-mode", enabled);
    const toggle = document.getElementById("rearrange-toggle");
    if (toggle) {
        toggle.textContent = enabled ? "Finish" : "Rearrange";
    }
    if (enabled) {
        renderAll(activeConfig);
    }
    updateLinkRowDragState();
    updateMainDragState();
    if (!enabled) {
        renderAll(activeConfig);
    }
}

function updateLinkRowDragState() {
    const allowDrag = isRearranging || canRearrangeEditor();
    document.querySelectorAll("[data-link-row]").forEach((row) => {
        row.draggable = allowDrag;
    });
}

function updateMainDragState() {
    document.querySelectorAll(".link-card").forEach((card) => {
        card.draggable = isRearranging;
    });
    document.querySelectorAll(".section").forEach((section) => {
        section.draggable = isRearranging;
    });
    document.querySelectorAll(".section-handle").forEach((handle) => {
        handle.draggable = isRearranging;
    });
}

function updateGridColumns(layout) {
    const maxColumns = Math.min(4, Math.max(1, layout?.maxColumns || 4));
    const minCardWidth = Math.max(160, layout?.minCardWidth || 180);
    document.querySelectorAll(".links-grid").forEach((grid) => {
        const width = grid.clientWidth || 0;
        const computed = width ? Math.max(1, Math.floor(width / minCardWidth)) : maxColumns;
        const columns = Math.min(maxColumns, computed);
        grid.style.setProperty("--columns", columns);
        grid.style.setProperty("--min-card-width", `${minCardWidth}px`);
    });
}

function setupGridObserver() {
    const container = document.getElementById("sections-container");
    if (!container || typeof ResizeObserver === "undefined") {
        window.addEventListener("resize", () => updateGridColumns(activeConfig?.layout));
        return;
    }
    if (gridObserver) {
        gridObserver.disconnect();
    }
    gridObserver = new ResizeObserver(() => {
        updateGridColumns(activeConfig?.layout);
    });
    gridObserver.observe(container);
}

async function persistActiveConfig() {
    const nextLinks = collectLinksFromMain();
    if (nextLinks.length) {
        activeConfig = {
            ...activeConfig,
            links: nextLinks,
            sections: collectSectionsFromMain()
        };
    }
    const { syncConfig, localAssets } = splitConfig(activeConfig);
    const syncResult = await setSyncConfig(syncConfig);
    await storageLocal.set({ [LOCAL_ASSETS_KEY]: localAssets });
    if (syncResult.ok) {
        await storageLocal.set({ [SYNC_META_KEY]: { lastSyncAt: Date.now() } });
        refreshSyncStatus();
    } else {
        setSyncStatus(`Sync: ${syncResult.error || "error"}`, "warn");
    }
}

function collectLinksFromMain() {
    const links = [];
    const grids = document.querySelectorAll(".links-grid");
    grids.forEach((grid) => {
        const section = grid.dataset.section || DEFAULT_LINK_SECTION;
        grid.querySelectorAll(".link-card").forEach((card) => {
            const link = lastRenderLinks.find((item) => item.id === card.dataset.linkId);
            if (link) {
                links.push({ ...link, section });
            }
        });
    });
    return links;
}

function collectSectionsFromMain() {
    return Array.from(document.querySelectorAll(".section"))
        .map((section) => section.dataset.section || "")
        .filter((name) => name.length > 0);
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

function collectLayout() {
    const input = document.getElementById("layout-max-columns");
    const maxColumns = Math.min(4, Math.max(2, parseInt(input.value, 10) || 4));
    return {
        maxColumns,
        minCardWidth: activeConfig?.layout?.minCardWidth || 180
    };
}

function collectBackgroundMode() {
    const select = document.getElementById("background-mode");
    return select?.value || "gradient_signature";
}
function updateFileLabel(labelEl, files, emptyLabel) {
    if (!labelEl) {
        return;
    }
    if (!files || files.length === 0) {
        labelEl.textContent = emptyLabel;
        return;
    }
    if (files.length === 1) {
        labelEl.textContent = files[0].name;
        return;
    }
    labelEl.textContent = `${files.length} files selected`;
}

function applyGradientMode(mode) {
    if (mode === "gradient_signature") {
        applySignatureGradient();
        return;
    }
    if (mode === "gradient_dynamic") {
        applyDynamicGradient();
        return;
    }
    applySignatureGradient();
}

function applySignatureGradient() {
    const palette = [
        [255, 138, 61],
        [79, 172, 254],
        [255, 200, 124],
        [137, 247, 254]
    ];
    setAuraPalette(palette);
}

async function applyDynamicGradient() {
    const sources = collectFaviconSources();
    if (!sources.length) {
        applySignatureGradient();
        return;
    }
    const colors = await Promise.all(sources.slice(0, 6).map((src) => sampleDominantColor(src)));
    const filtered = colors.filter(Boolean);
    if (!filtered.length) {
        applySignatureGradient();
        return;
    }
    const unique = shuffleArray(filtered).slice(0, 4);
    setAuraPalette(unique);
}

function collectFaviconSources() {
    const sources = [];
    if (faviconCache) {
        Object.values(faviconCache).forEach((value) => {
            if (isDataUrl(value)) {
                sources.push(value);
            }
        });
    }
    if (activeConfig?.links) {
        activeConfig.links.forEach((link) => {
            if (isDataUrl(link.iconOverride)) {
                sources.push(link.iconOverride);
            }
        });
    }
    return sources;
}

function setAuraPalette(colors) {
    const root = document.documentElement;
    const positions = [
        [rand(12, 28), rand(8, 18)],
        [rand(68, 88), rand(8, 22)],
        [rand(10, 30), rand(62, 78)],
        [rand(70, 88), rand(68, 88)]
    ];
    const slots = 4;
    for (let i = 0; i < slots; i += 1) {
        const color = colors[i] || colors[colors.length - 1];
        if (!color) {
            continue;
        }
        root.style.setProperty(`--aura-${i + 1}`, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.24)`);
        root.style.setProperty(`--aura-x${i + 1}`, `${positions[i][0]}%`);
        root.style.setProperty(`--aura-y${i + 1}`, `${positions[i][1]}%`);
    }
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sampleDominantColor(source) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const size = 24;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;
            let r = 0;
            let g = 0;
            let b = 0;
            let count = 0;
            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3];
                if (alpha < 100) {
                    continue;
                }
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                count += 1;
            }
            if (!count) {
                resolve(null);
                return;
            }
            resolve([Math.round(r / count), Math.round(g / count), Math.round(b / count)]);
        };
        img.onerror = () => resolve(null);
        img.src = source;
    });
}

function shuffleArray(list) {
    const array = [...list];
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function collectSectionsFromEditor() {
    return Array.from(document.querySelectorAll("[data-section-block]"))
        .map((block) => block.dataset.section)
        .filter((name) => name && name.trim().length > 0);
}

function collectBranding() {
    const title = document.getElementById("branding-title")?.value.trim() || "Mothership on Main";
    const subtitle =
        document.getElementById("branding-subtitle")?.value.trim() || "Your favorite bookmark replacement tool";
    const quotesTitle = document.getElementById("branding-quotes-title")?.value.trim() || "Quotes";
    return { title, subtitle, quotesTitle };
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
        setSyncStatus(`Sync: on - ${timeAgo(lastSyncAt)}`, "on");
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

function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
}

function createImageThumbnail(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const maxWidth = 240;
            const maxHeight = 160;
            const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
            const width = Math.round(img.width * ratio);
            const height = Math.round(img.height * ratio);
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                resolve("");
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        img.onerror = () => resolve("");
        img.src = dataUrl;
    });
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
