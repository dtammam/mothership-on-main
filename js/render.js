// All main-page rendering: sections, quotes, backgrounds, branding,
// search, layout, visibility, favicons, and gradients.

function renderAll(config) {
    renderBranding(config.branding);
    renderSearch(config.search);
    renderQuote(config.quotes);
    renderBackground(config);
    renderSections(config);
    updatePageLayout(config.layout);
    applyVisibility(config.visibility);
    updateGridColumns(config.layout);
}

function applyVisibility(visibility) {
    const normalized = {
        search: visibility?.search !== false,
        quotes: visibility?.quotes !== false,
        links: visibility?.links !== false
    };
    const searchForm = document.getElementById("search-form");
    const quoteSection = document.querySelector(".quote");
    const linksSection = document.getElementById("sections-container");
    if (searchForm) {
        searchForm.hidden = !normalized.search;
    }
    if (quoteSection) {
        quoteSection.hidden = !normalized.quotes;
    }
    if (linksSection) {
        linksSection.hidden = !normalized.links;
    }
}

function updatePageLayout(layout) {
    const isResizable = Boolean(layout?.resizable);
    const pageWidth = isResizable ? Math.min(100, Math.max(60, Number(layout?.pageWidth) || 72)) : 72;
    const pageWidthPx = isResizable ? 9999 : 1200;
    document.documentElement.style.setProperty("--page-width-vw", `${pageWidth}vw`);
    document.documentElement.style.setProperty("--page-width-px", `${pageWidthPx}px`);
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
        document.body.classList.remove("background-blur");
        renderImageBackground(config.backgrounds, false);
        return;
    }
    if (mode === "images_blur") {
        document.body.classList.remove("background-image");
        document.body.classList.add("background-blur");
        renderImageBackground(config.backgrounds, true);
        return;
    }
    document.body.classList.remove("background-image");
    document.body.classList.remove("background-blur");
    document.body.style.backgroundImage = "";
    document.body.style.setProperty("--background-image", "none");
    applyGradientMode(mode);
}

function renderImageBackground(backgrounds, useBlur) {
    if (!backgrounds.length) {
        document.body.style.backgroundImage = "";
        document.body.style.setProperty("--background-image", "none");
        return;
    }
    const random = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    if (useBlur) {
        document.body.style.backgroundImage = "";
        document.body.style.setProperty("--background-image", `url("${random}")`);
        return;
    }
    document.body.style.setProperty("--background-image", "none");
    document.body.style.backgroundImage = `url("${random}")`;
}

function renderSections(config) {
    const container = document.getElementById("sections-container");
    container.innerHTML = "";

    const sections = deriveSections(config.links, config.sections);
    const collapsedSections = new Set(Array.isArray(config.collapsedSections) ? config.collapsedSections : []);
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
        const isCollapsed = collapsedSections.has(section);
        sectionEl.dataset.collapsed = isCollapsed ? "true" : "false";
        sectionEl.classList.toggle("is-collapsed", isCollapsed);
        sectionEl.draggable = isRearranging;

        const header = document.createElement("div");
        header.className = "section-header";
        header.dataset.drag = "section";
        const heading = document.createElement("h2");
        heading.textContent = section;

        const headerActions = document.createElement("div");
        headerActions.className = "section-header-actions";
        const collapse = document.createElement("button");
        collapse.type = "button";
        collapse.className = "section-collapse";
        collapse.dataset.action = "toggle-section-collapse";
        collapse.dataset.section = section;
        collapse.textContent = isCollapsed ? "Expand" : "Collapse";

        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "section-handle";
        handle.dataset.drag = "section";
        handle.draggable = isRearranging;
        handle.textContent = "Drag to reorder";

        headerActions.appendChild(collapse);
        headerActions.appendChild(handle);
        header.appendChild(heading);
        header.appendChild(headerActions);
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

async function resolveFavicon(link) {
    if (link.iconOverride) {
        return link.iconOverride;
    }
    const autoFetchFavicons = activeConfig?.privacy?.autoFetchFavicons !== false;
    const url = safeParseUrl(link.url);
    if (!url) {
        return autoFetchFavicons ? "" : "images/icon.png";
    }
    const host = url.hostname.toLowerCase();
    if (faviconCache[host]) {
        return faviconCache[host];
    }
    if (!autoFetchFavicons) {
        return "images/icon.png";
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
    } catch (_error) {
        return null;
    }
}

function updateGridColumns(layout) {
    const isResizable = Boolean(layout?.resizable);
    const maxColumns = isResizable ? Math.min(10, Math.max(1, layout?.maxColumns || 4)) : 4;
    const minCardWidth = isResizable ? Math.max(120, layout?.minCardWidth || 180) : 180;
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

function applyGradientMode(mode) {
    if (mode === "gradient_signature") {
        applySignatureGradient();
        return;
    }
    if (mode === "gradient_dynamic") {
        applyDynamicGradient();
        return;
    }
    if (mode === "gradient_soda") {
        applySodaGradient();
        return;
    }
    if (mode === "gradient_github_dark") {
        applyGithubDarkGradient();
        return;
    }
    if (mode === "gradient_azure") {
        applyAzureGradient();
        return;
    }
    if (mode === "gradient_dracula") {
        applyDraculaGradient();
        return;
    }
    if (mode === "gradient_synthwave") {
        applySynthwaveGradient();
        return;
    }
    if (mode === "gradient_daylight") {
        applyDaylightGradient();
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

function applySodaGradient() {
    const palette = [
        [116, 255, 216],
        [94, 215, 255],
        [255, 120, 164],
        [255, 212, 88]
    ];
    setAuraPalette(palette);
}

function applyGithubDarkGradient() {
    const palette = [
        [13, 17, 23],
        [22, 27, 34],
        [48, 54, 61],
        [88, 96, 105]
    ];
    setAuraPalette(palette);
}

function applyAzureGradient() {
    const palette = [
        [0, 120, 212],
        [0, 91, 172],
        [80, 188, 255],
        [0, 183, 255]
    ];
    setAuraPalette(palette);
}

function applyDraculaGradient() {
    const palette = [
        [40, 42, 54],
        [68, 71, 90],
        [189, 147, 249],
        [255, 121, 198]
    ];
    setAuraPalette(palette);
}

function applySynthwaveGradient() {
    const palette = [
        [255, 98, 196],
        [138, 99, 255],
        [79, 230, 255],
        [255, 197, 109]
    ];
    setAuraPalette(palette);
}

function applyDaylightGradient() {
    const palette = [
        [255, 241, 198],
        [255, 214, 170],
        [255, 170, 204],
        [186, 233, 255]
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
    const boosted = filtered.map((color) => boostColor(color, 0.3));
    const unique = shuffleArray(boosted).slice(0, 4);
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
