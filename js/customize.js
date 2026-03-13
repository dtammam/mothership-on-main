// Settings/customize panel: setup, editors, drag/reorder, import/export,
// file handling, and link section management.

function findReorderTarget(container, itemSelector, pointerY, draggingItem) {
    const candidates = Array.from(container.querySelectorAll(itemSelector)).filter((item) => item !== draggingItem);
    let closest = null;
    let closestOffset = Number.NEGATIVE_INFINITY;
    candidates.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const offset = pointerY - (rect.top + rect.height / 2);
        if (offset < 0 && offset > closestOffset) {
            closestOffset = offset;
            closest = item;
        }
    });
    return closest;
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
    const exportConfig = document.getElementById("export-config");
    const importConfig = document.getElementById("import-config");
    const importConfigName = document.getElementById("import-config-name");
    const importConfigMode = document.getElementById("import-config-mode");
    const resetConfig = document.getElementById("reset-config");
    const linksEditor = document.getElementById("links-editor");
    const enginesEditor = document.getElementById("engines-editor");
    const sectionsContainer = document.getElementById("sections-container");
    const layoutResizable = document.getElementById("layout-resizable");
    const layoutMaxColumns = document.getElementById("layout-max-columns");
    const layoutMinCardWidth = document.getElementById("layout-min-card-width");
    const layoutPageWidth = document.getElementById("layout-page-width");
    const visibilitySearch = document.getElementById("visibility-search");
    const visibilityQuotes = document.getElementById("visibility-quotes");
    const visibilityLinks = document.getElementById("visibility-links");
    const autoFetchFavicons = document.getElementById("privacy-auto-fetch-favicons");
    const settingsNav = document.querySelector(".settings-nav");
    const quickSectionForm = document.querySelector("[data-nav-popover]");
    const quickSectionInput = document.getElementById("quick-section-name");

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
            updateSyncUsage(activeConfig);
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
            updateEngineRowDragState();
            return;
        }
        setRearrangeMode(false);
        renderSettings(activeConfig);
        settingsPanel.classList.add("open");
        settingsPanel.setAttribute("aria-hidden", "false");
        updateLinkRowDragState();
        updateEngineRowDragState();
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
            updateEngineRowDragState();
        });
    }

    settingsCancelBottom.addEventListener("click", () => {
        settingsPanel.classList.remove("open");
        settingsPanel.setAttribute("aria-hidden", "true");
        setRearrangeMode(false);
        updateLinkRowDragState();
        updateEngineRowDragState();
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
            if (quickSectionForm) {
                quickSectionForm.classList.toggle("is-open");
            }
            quickSectionInput?.focus({ preventScroll: true });
        }
        if (action === "quick-cancel-section") {
            if (!quickSectionForm) {
                return;
            }
            quickSectionForm.classList.remove("is-open");
            if (quickSectionInput) {
                quickSectionInput.value = "";
            }
        }
        if (action === "quick-add-engine") {
            addEngineRow({ id: "", label: "", url: "", queryParam: "q" });
            refreshDefaultEngineOptions();
            updateEngineRowDragState();
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
            updateEngineRowDragState();
        }
        if (action === "remove-section") {
            event.target.closest("[data-section-block]")?.remove();
            refreshLinkSectionChoices();
        }
    });

    if (quickSectionForm && quickSectionInput) {
        quickSectionForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const sectionName = quickSectionInput.value.trim();
            if (!sectionName) {
                return;
            }
            ensureLinksSection(sectionName);
            refreshLinkSectionChoices(sectionName);
            const section = document.querySelector(`[data-section-block][data-section="${sectionName}"]`);
            section?.scrollIntoView({ block: "start" });
            quickSectionInput.value = "";
            quickSectionForm.classList.remove("is-open");
        });
    }

    document.addEventListener("keydown", async (event) => {
        if (event.key !== "Escape") {
            return;
        }
        if (quickSectionForm?.classList.contains("is-open")) {
            quickSectionForm.classList.remove("is-open");
            if (quickSectionInput) {
                quickSectionInput.value = "";
            }
            return;
        }
        if (settingsPanel.classList.contains("open")) {
            settingsPanel.classList.remove("open");
            settingsPanel.setAttribute("aria-hidden", "true");
            setRearrangeMode(false);
            updateLinkRowDragState();
            updateEngineRowDragState();
            return;
        }
        if (isRearranging) {
            setRearrangeMode(false);
        }
    });

    addLink.addEventListener("click", () => addLinkRow());
    addSection.addEventListener("click", () => {
        const name = newSectionName.value.trim();
        if (!name) {
            return;
        }
        ensureLinksSection(name);
        refreshLinkSectionChoices(name);
        newSectionName.value = "";
    });
    addBackgroundUrl.addEventListener("click", () => addBackgroundRow(""));
    addEngine.addEventListener("click", () => {
        addEngineRow({ id: "", label: "", url: "", queryParam: "q" });
        refreshDefaultEngineOptions();
        updateEngineRowDragState();
    });

    backgroundUpload.addEventListener("change", async (event) => {
        const files = Array.from(event.target.files || []);
        updateFileLabel(backgroundUploadName, files, "No files selected");
        for (const file of files) {
            const dataUrl = await fileToDataUrl(file);
            addBackgroundRow(dataUrl);
            storeBackgroundThumb(dataUrl);
        }
        if (files.length) {
            backgroundMode.value = "images";
            activeConfig = { ...activeConfig, backgroundMode: "images" };
            renderBackground(activeConfig);
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

    exportConfig.addEventListener("click", () => {
        const config = collectConfigFromEditors();
        const data = JSON.stringify(config, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        const title = (config.branding?.title || "mothership")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "");
        const timestamp = new Date().toISOString().replace(/[:T]/g, "-").replace(/\..+/, "");
        anchor.download = `${title || "mothership"}-${timestamp}.json`;
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
            const baseConfig = collectConfigFromEditors();
            const mode = importConfigMode?.value || "all";
            if (mode === "quotes") {
                const quotes = normalizeQuotesImport(payload);
                renderSettings(mergeConfig(baseConfig, { quotes }));
                return;
            }
            if (mode === "search") {
                const search =
                    payload.search ||
                    (payload.engines ? payload : Array.isArray(payload) ? { engines: payload } : null);
                if (!search) {
                    console.error("Invalid search config");
                    return;
                }
                renderSettings(mergeConfig(baseConfig, { search }));
                return;
            }
            if (mode === "links") {
                const links = Array.isArray(payload.links) ? payload.links : Array.isArray(payload) ? payload : [];
                const sections = Array.isArray(payload.sections) ? payload.sections : [];
                const update = { links };
                if (sections.length) {
                    update.sections = sections;
                }
                renderSettings(mergeConfig(baseConfig, update));
                return;
            }
            renderSettings(mergeConfig(baseConfig, payload));
        } catch (_error) {
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
        await clearSyncStorage();
        await Promise.all([storageLocal.remove([LOCAL_ASSETS_KEY, FAVICON_CACHE_KEY, SYNC_META_KEY])]);
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
        if (event.target.dataset.field === "section") {
            handleLinkSectionSelection(event.target);
        }
        if (event.target.dataset.field === "sectionCustom") {
            finalizeCustomLinkSection(event.target);
        }
        if (event.target.closest("#engines-editor")) {
            refreshDefaultEngineOptions();
        }
    });

    linksEditor.addEventListener("keydown", (event) => {
        if (event.target.dataset.field === "sectionCustom" && event.key === "Enter") {
            event.preventDefault();
            finalizeCustomLinkSection(event.target);
        }
    });

    const previewLayout = () => {
        const nextLayout = collectLayout();
        activeConfig = { ...activeConfig, layout: nextLayout };
        updateLayoutControlState(nextLayout);
        updatePageLayout(activeConfig.layout);
        updateGridColumns(activeConfig.layout);
    };

    const previewVisibility = () => {
        const visibility = collectVisibility();
        activeConfig = { ...activeConfig, visibility };
        applyVisibility(activeConfig.visibility);
    };

    const previewPrivacy = () => {
        const privacy = collectPrivacy();
        activeConfig = { ...activeConfig, privacy };
        renderSections(activeConfig);
        updateGridColumns(activeConfig.layout);
    };

    layoutResizable.addEventListener("change", previewLayout);
    layoutMaxColumns.addEventListener("change", previewLayout);
    layoutMinCardWidth.addEventListener("change", previewLayout);
    layoutPageWidth.addEventListener("change", previewLayout);
    visibilitySearch.addEventListener("change", previewVisibility);
    visibilityQuotes.addEventListener("change", previewVisibility);
    visibilityLinks.addEventListener("change", previewVisibility);
    autoFetchFavicons.addEventListener("change", previewPrivacy);

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
            setLinkRowSectionValue(dragging, section);
        }
    });

    enginesEditor.addEventListener("dragstart", (event) => {
        if (!canRearrangeEditor()) {
            return;
        }
        const row = event.target.closest("[data-engine-row]");
        if (!row) {
            return;
        }
        row.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", row.querySelector('[data-field="id"]')?.value || "");
    });

    enginesEditor.addEventListener("dragend", (event) => {
        const row = event.target.closest("[data-engine-row]");
        if (row) {
            row.classList.remove("dragging");
        }
    });

    enginesEditor.addEventListener("dragover", (event) => {
        if (!canRearrangeEditor()) {
            return;
        }
        const container = event.currentTarget;
        const dragging = container.querySelector(".engine-row.dragging");
        if (!dragging) {
            return;
        }
        event.preventDefault();
        const target = findReorderTarget(container, "[data-engine-row]", event.clientY, dragging);
        if (!target) {
            container.appendChild(dragging);
            return;
        }
        container.insertBefore(dragging, target);
    });

    enginesEditor.addEventListener("drop", (event) => {
        if (!canRearrangeEditor()) {
            return;
        }
        event.preventDefault();
        const container = event.currentTarget;
        const dragging = container.querySelector(".engine-row.dragging");
        if (dragging && !container.contains(dragging)) {
            container.appendChild(dragging);
        }
    });

    sectionsContainer.addEventListener("dragstart", (event) => {
        if (!isRearranging) {
            return;
        }
        const handle = event.target.closest('[data-drag="section"]');
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
        if (action === "toggle-section-collapse") {
            if (!isRearranging) {
                return;
            }
            event.preventDefault();
            const sectionName = event.target.dataset.section || event.target.closest(".section")?.dataset.section;
            if (!sectionName) {
                return;
            }
            toggleSectionCollapsed(sectionName);
            return;
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
    const links = Array.from(nav.querySelectorAll('a[href^="#settings-"]'));
    const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);

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
    renderVisibilityEditor(config.visibility);
    renderPrivacyEditor(config.privacy);
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
        const sectionName = (link.section || DEFAULT_LINK_SECTION).trim() || DEFAULT_LINK_SECTION;
        row.dataset.sectionValue = sectionName;
        const preview = row.querySelector(".icon-preview");
        preview.src = link.iconOverride || "images/icon.png";
        row.draggable = isRearranging;
        const list = ensureSection(sectionName);
        list.appendChild(row);
    });

    refreshLinkSectionChoices();
    container.querySelectorAll("[data-link-row]").forEach((row) => {
        if (row.dataset.sectionValue) {
            setLinkRowSectionValue(row, row.dataset.sectionValue);
            delete row.dataset.sectionValue;
        }
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
        return existing.querySelector("[data-section-list]");
    }
    return createLinksSection(sectionName, container);
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

function refreshLinkSectionChoices() {
    const sectionNames = collectSectionsFromEditor();
    if (!sectionNames.length) {
        ensureLinksSection(DEFAULT_LINK_SECTION);
        sectionNames.push(DEFAULT_LINK_SECTION);
    }

    document.querySelectorAll("[data-link-row]").forEach((row) => {
        const select = row.querySelector('[data-field="section"]');
        const customInput = row.querySelector('[data-field="sectionCustom"]');
        if (!select) {
            return;
        }
        const currentValue = getLinkRowSectionValue(row) || row.dataset.sectionValue || DEFAULT_LINK_SECTION;
        select.innerHTML = "";
        sectionNames.forEach((name) => {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
        const newOption = document.createElement("option");
        newOption.value = NEW_SECTION_OPTION;
        newOption.textContent = "New...";
        select.appendChild(newOption);

        if (sectionNames.includes(currentValue)) {
            select.value = currentValue;
            if (customInput) {
                customInput.value = "";
                customInput.hidden = true;
            }
            return;
        }

        select.value = NEW_SECTION_OPTION;
        if (customInput) {
            customInput.value = currentValue;
            customInput.hidden = false;
        }
    });
}

function getLinkRowSectionValue(row) {
    const select = row.querySelector('[data-field="section"]');
    const customInput = row.querySelector('[data-field="sectionCustom"]');
    if (!select) {
        return DEFAULT_LINK_SECTION;
    }
    if (select.value === NEW_SECTION_OPTION) {
        return customInput?.value.trim() || "";
    }
    return select.value.trim();
}

function setLinkRowSectionValue(row, sectionName) {
    const resolvedSection = (sectionName || "").trim() || DEFAULT_LINK_SECTION;
    const select = row.querySelector('[data-field="section"]');
    const customInput = row.querySelector('[data-field="sectionCustom"]');
    if (!select) {
        return;
    }
    const options = Array.from(select.options).map((option) => option.value);
    if (options.includes(resolvedSection)) {
        select.value = resolvedSection;
        if (customInput) {
            customInput.value = "";
            customInput.hidden = true;
        }
        return;
    }
    select.value = NEW_SECTION_OPTION;
    if (customInput) {
        customInput.value = resolvedSection;
        customInput.hidden = false;
    }
}

function moveLinkRowToSection(row, sectionName) {
    const resolvedSection = (sectionName || "").trim() || DEFAULT_LINK_SECTION;
    ensureLinksSection(resolvedSection);
    refreshLinkSectionChoices();
    const targetList = document.querySelector(`[data-section-list][data-section="${resolvedSection}"]`);
    if (targetList && row.parentElement !== targetList) {
        targetList.appendChild(row);
    }
    setLinkRowSectionValue(row, resolvedSection);
}

function handleLinkSectionSelection(selectInput) {
    const row = selectInput.closest("[data-link-row]");
    if (!row) {
        return;
    }
    if (selectInput.value === NEW_SECTION_OPTION) {
        const customInput = row.querySelector('[data-field="sectionCustom"]');
        if (customInput) {
            customInput.hidden = false;
            customInput.focus();
        }
        return;
    }
    moveLinkRowToSection(row, selectInput.value);
}

function finalizeCustomLinkSection(customInput) {
    const row = customInput.closest("[data-link-row]");
    if (!row) {
        return;
    }
    const nextSection = customInput.value.trim();
    if (!nextSection) {
        return;
    }
    moveLinkRowToSection(row, nextSection);
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
        addEngineRow(
            { id: "google", label: "Google", url: "https://www.google.com/search", queryParam: "q" },
            container,
            template
        );
    }
    refreshDefaultEngineOptions(search.defaultEngine);
    updateEngineRowDragState();
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
    const resizableInput = document.getElementById("layout-resizable");
    const maxColumnsInput = document.getElementById("layout-max-columns");
    const minCardWidthInput = document.getElementById("layout-min-card-width");
    const pageWidthInput = document.getElementById("layout-page-width");
    const isResizable = Boolean(layout?.resizable);
    const defaults = { maxColumns: 4, minCardWidth: 180, pageWidth: 72 };
    resizableInput.checked = isResizable;
    const maxColumns = isResizable && Number.isFinite(layout?.maxColumns) ? layout.maxColumns : defaults.maxColumns;
    const minCardWidth =
        isResizable && Number.isFinite(layout?.minCardWidth) ? layout.minCardWidth : defaults.minCardWidth;
    const pageWidth = isResizable && Number.isFinite(layout?.pageWidth) ? layout.pageWidth : defaults.pageWidth;
    maxColumnsInput.value = maxColumns;
    minCardWidthInput.value = minCardWidth;
    pageWidthInput.value = pageWidth;
    updateLayoutControlState({ resizable: isResizable });
}

function updateLayoutControlState(layout) {
    const isResizable = Boolean(layout?.resizable);
    const maxColumnsInput = document.getElementById("layout-max-columns");
    const minCardWidthInput = document.getElementById("layout-min-card-width");
    const pageWidthInput = document.getElementById("layout-page-width");
    maxColumnsInput.disabled = !isResizable;
    minCardWidthInput.disabled = !isResizable;
    pageWidthInput.disabled = !isResizable;
}

function renderVisibilityEditor(visibility) {
    const searchInput = document.getElementById("visibility-search");
    const quotesInput = document.getElementById("visibility-quotes");
    const linksInput = document.getElementById("visibility-links");
    searchInput.checked = visibility?.search !== false;
    quotesInput.checked = visibility?.quotes !== false;
    linksInput.checked = visibility?.links !== false;
}

function renderPrivacyEditor(privacy) {
    const autoFetchFavicons = document.getElementById("privacy-auto-fetch-favicons");
    autoFetchFavicons.checked = privacy?.autoFetchFavicons !== false;
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
    row.draggable = isRearranging || canRearrangeEditor();
    if (targetList) {
        targetList.appendChild(row);
        row.scrollIntoView({ block: "nearest" });
    } else {
        container.appendChild(row);
    }
    refreshLinkSectionChoices();
    setLinkRowSectionValue(row, resolvedSection);
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
    row.draggable = canRearrangeEditor();
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
    updateEngineRowDragState();
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

function updateEngineRowDragState() {
    const allowDrag = canRearrangeEditor();
    document.querySelectorAll("[data-engine-row]").forEach((row) => {
        row.draggable = allowDrag;
        const handle = row.querySelector(".engine-row-handle");
        if (handle) {
            handle.setAttribute("aria-disabled", allowDrag ? "false" : "true");
        }
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

async function persistActiveConfig() {
    const nextLinks = collectLinksFromMain();
    const nextSections = collectSectionsFromMain();
    const nextCollapsedSections = collectCollapsedSectionsFromMain();
    if (nextLinks.length) {
        activeConfig = {
            ...activeConfig,
            links: nextLinks,
            sections: nextSections,
            collapsedSections: nextCollapsedSections
        };
    } else {
        activeConfig = {
            ...activeConfig,
            collapsedSections: nextCollapsedSections
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

async function toggleSectionCollapsed(sectionName) {
    if (!sectionName) {
        return;
    }
    const collapsed = new Set(Array.isArray(activeConfig?.collapsedSections) ? activeConfig.collapsedSections : []);
    if (collapsed.has(sectionName)) {
        collapsed.delete(sectionName);
    } else {
        collapsed.add(sectionName);
    }
    activeConfig = {
        ...activeConfig,
        collapsedSections: Array.from(collapsed)
    };
    renderSections(activeConfig);
    applyVisibility(activeConfig.visibility);
    updateGridColumns(activeConfig.layout);
    await persistActiveConfig();
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
