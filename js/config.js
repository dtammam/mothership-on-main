// Config manipulation: merge, split, local assets, normalization, and collection.

// Merges user override into defaults while preserving shapes.
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
            resizable:
                typeof override.layout?.resizable === "boolean"
                    ? override.layout.resizable
                    : Boolean(base.layout?.resizable ?? false),
            maxColumns: Number.isFinite(override.layout?.maxColumns)
                ? override.layout.maxColumns
                : base.layout.maxColumns,
            minCardWidth: Number.isFinite(override.layout?.minCardWidth)
                ? override.layout.minCardWidth
                : base.layout.minCardWidth,
            pageWidth: Number.isFinite(override.layout?.pageWidth) ? override.layout.pageWidth : base.layout.pageWidth
        },
        visibility: {
            search:
                typeof override.visibility?.search === "boolean"
                    ? override.visibility.search
                    : Boolean(base.visibility?.search ?? true),
            quotes:
                typeof override.visibility?.quotes === "boolean"
                    ? override.visibility.quotes
                    : Boolean(base.visibility?.quotes ?? true),
            links:
                typeof override.visibility?.links === "boolean"
                    ? override.visibility.links
                    : Boolean(base.visibility?.links ?? true)
        },
        privacy: {
            autoFetchFavicons:
                typeof override.privacy?.autoFetchFavicons === "boolean"
                    ? override.privacy.autoFetchFavicons
                    : Boolean(base.privacy?.autoFetchFavicons ?? true)
        },
        collapsedSections: Array.isArray(override.collapsedSections)
            ? [
                  ...new Set(
                      override.collapsedSections.filter((name) => typeof name === "string" && name.trim().length > 0)
                  )
              ]
            : Array.isArray(base.collapsedSections)
              ? [
                    ...new Set(
                        base.collapsedSections.filter((name) => typeof name === "string" && name.trim().length > 0)
                    )
                ]
              : [],
        hiddenSections: Array.isArray(override.hiddenSections)
            ? [...new Set(override.hiddenSections.filter((name) => typeof name === "string" && name.trim().length > 0))]
            : Array.isArray(base.hiddenSections)
              ? [...new Set(base.hiddenSections.filter((name) => typeof name === "string" && name.trim().length > 0))]
              : [],
        search: {
            defaultEngine: override.search?.defaultEngine || base.search.defaultEngine,
            engines: Array.isArray(override.search?.engines) ? override.search.engines : base.search.engines
        }
    };
}

// Applies local assets (data URIs) to a synced config.
function applyLocalAssets(config, localAssets) {
    const assets = localAssets || {};
    const backgroundUploads = Array.isArray(assets.backgroundUploads) ? assets.backgroundUploads : [];
    const linkIcons = assets.linkIcons || {};
    const linksWithIds = ensureLinkIds(config.links || []);
    const links = linksWithIds.map((link) => {
        const override = isDataUrl(link.iconOverride) ? "" : link.iconOverride || "";
        const localOverride = linkIcons[link.id];
        return { ...link, iconOverride: localOverride || override };
    });
    return {
        ...config,
        links,
        backgrounds: [...(config.backgrounds || []), ...backgroundUploads]
    };
}

// Splits config into sync-safe data and local-only assets (data URIs).
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

// Merges two local-asset blobs (uploads + icon overrides).
function mergeLocalAssets(base = {}, incoming = {}) {
    return {
        backgroundUploads: [...(base.backgroundUploads || []), ...(incoming.backgroundUploads || [])],
        linkIcons: { ...(base.linkIcons || {}), ...(incoming.linkIcons || {}) }
    };
}

function normalizeQuotesImport(payload) {
    if (Array.isArray(payload)) {
        return payload
            .filter((line) => typeof line === "string")
            .map((line) => line.trim())
            .filter(Boolean);
    }
    if (typeof payload === "string") {
        return payload
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
    }
    if (Array.isArray(payload?.quotes)) {
        return payload.quotes
            .filter((line) => typeof line === "string")
            .map((line) => line.trim())
            .filter(Boolean);
    }
    if (typeof payload?.quotes === "string") {
        return payload.quotes
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
    }
    return [];
}

// Parses a Chromium bookmark HTML export (Netscape Bookmark File Format).
// Returns { ok, sections, links } on success or { ok, error } on failure.
function parseChromiumBookmarks(html) {
    if (!html || typeof html !== "string") {
        return { ok: false, error: "Invalid bookmark file: expected HTML string" };
    }
    if (!html.includes("<!DOCTYPE NETSCAPE-Bookmark-file-1>") && !html.includes("<DL>")) {
        return { ok: false, error: "Not a valid Netscape bookmark file" };
    }
    const sections = [];
    const links = [];
    const sectionSeen = new Set();
    const NAME_MAX = 100;

    // Use DOMParser to walk the bookmark <DL> tree.
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    function walkDL(dl, sectionName) {
        if (!dl) {
            return;
        }
        const items = dl.children;
        for (let i = 0; i < items.length; i++) {
            const dt = items[i];
            if (dt.tagName !== "DT") {
                continue;
            }
            const heading = dt.querySelector(":scope > H3");
            if (heading) {
                // Folder — the next sibling DL holds its children.
                const folderName = (heading.textContent || "").trim().slice(0, NAME_MAX) || DEFAULT_LINK_SECTION;
                if (!sectionSeen.has(folderName)) {
                    sectionSeen.add(folderName);
                    sections.push(folderName);
                }
                const childDL = dt.querySelector(":scope > DL");
                walkDL(childDL, folderName);
                continue;
            }
            const anchor = dt.querySelector(":scope > A");
            if (anchor && anchor.href) {
                const url = anchor.href.trim();
                if (!url || url === "about:blank") {
                    continue;
                }
                const name = (anchor.textContent || url).trim().slice(0, NAME_MAX);
                const section = sectionName || DEFAULT_LINK_SECTION;
                if (!sectionSeen.has(section)) {
                    sectionSeen.add(section);
                    sections.push(section);
                }
                links.push({
                    id: createId(),
                    name,
                    url,
                    section,
                    iconOverride: ""
                });
            }
        }
    }

    // The top-level <DL> contains the bookmark roots.
    const topDL = doc.querySelector("DL");
    walkDL(topDL, null);

    if (!links.length) {
        return { ok: false, error: "No bookmarks found in file" };
    }

    // Deduplicate links by URL within each section.
    const seen = new Set();
    const dedupedLinks = links.filter((link) => {
        const key = `${link.section}|${link.url}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });

    return { ok: true, sections, links: dedupedLinks };
}

// Previews a bookmark import by merging into existing config without side effects.
// Returns { projectedConfig, stats } with byte estimates for quota checking.
function previewBookmarkImport(existingConfig, parsedBookmarks) {
    const config = structuredClone(existingConfig);
    const existingUrls = new Set((config.links || []).map((link) => link.url));
    let skippedDuplicates = 0;
    const newLinks = [];
    parsedBookmarks.links.forEach((link) => {
        if (existingUrls.has(link.url)) {
            skippedDuplicates++;
            return;
        }
        existingUrls.add(link.url);
        newLinks.push(link);
    });

    config.links = [...(config.links || []), ...newLinks];

    // Merge sections preserving existing order.
    const existingSections = new Set(config.sections || []);
    const newSections = [];
    parsedBookmarks.sections.forEach((section) => {
        if (!existingSections.has(section)) {
            existingSections.add(section);
            newSections.push(section);
        }
    });
    config.sections = [...(config.sections || []), ...newSections];

    const currentEstimate = estimateSyncUsage(existingConfig);
    const projectedEstimate = estimateSyncUsage(config);

    return {
        projectedConfig: config,
        stats: {
            newLinks: newLinks.length,
            newSections: newSections.length,
            currentBytes: currentEstimate.totalBytes,
            projectedBytes: projectedEstimate.totalBytes,
            quotaBytes: SYNC_TOTAL_QUOTA_BYTES,
            overQuota: projectedEstimate.totalBytes > SYNC_TOTAL_QUOTA_BYTES,
            skippedDuplicates
        }
    };
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

function collectConfigFromEditors() {
    const branding = collectBranding();
    const sections = collectSectionsFromEditor();
    const links = collectLinks();
    const backgrounds = collectBackgrounds();
    const quotes = collectQuotes();
    const search = collectSearch();
    const layout = collectLayout();
    const visibility = collectVisibility();
    const privacy = collectPrivacy();
    const backgroundMode = collectBackgroundMode();
    const nextSections = deriveSections(links, sections);
    return {
        branding,
        sections: nextSections.length ? nextSections : [DEFAULT_LINK_SECTION],
        links,
        quotes,
        backgrounds,
        backgroundMode,
        layout,
        visibility,
        privacy,
        collapsedSections: collectCollapsedSectionsFromMain(),
        hiddenSections: activeConfig?.hiddenSections || [],
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
        const section = getLinkRowSectionValue(row);
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

function collectSectionsFromEditor() {
    return Array.from(document.querySelectorAll("[data-section-block]"))
        .map((block) => block.dataset.section)
        .filter((name) => name && name.trim().length > 0);
}

function collectSectionsFromMain() {
    return Array.from(document.querySelectorAll(".section"))
        .map((section) => section.dataset.section || "")
        .filter((name) => name.length > 0);
}

function collectCollapsedSectionsFromMain() {
    return Array.from(document.querySelectorAll(".section.is-collapsed"))
        .map((section) => section.dataset.section || "")
        .filter((name) => name.length > 0);
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
    const resizableInput = document.getElementById("layout-resizable");
    const input = document.getElementById("layout-max-columns");
    const minCardWidthInput = document.getElementById("layout-min-card-width");
    const pageWidthInput = document.getElementById("layout-page-width");
    const resizable = resizableInput?.checked === true;
    if (!resizable) {
        return {
            resizable: false,
            maxColumns: 4,
            minCardWidth: 180,
            pageWidth: 72
        };
    }
    const maxColumns = Math.min(10, Math.max(2, parseInt(input.value, 10) || 4));
    const minCardWidth = Math.min(520, Math.max(120, parseInt(minCardWidthInput.value, 10) || 180));
    const pageWidth = Math.min(100, Math.max(60, parseInt(pageWidthInput.value, 10) || 72));
    return {
        resizable,
        maxColumns,
        minCardWidth,
        pageWidth
    };
}

function collectVisibility() {
    const search = document.getElementById("visibility-search")?.checked !== false;
    const quotes = document.getElementById("visibility-quotes")?.checked !== false;
    const links = document.getElementById("visibility-links")?.checked !== false;
    return { search, quotes, links };
}

function collectPrivacy() {
    const autoFetchFavicons = document.getElementById("privacy-auto-fetch-favicons")?.checked !== false;
    return { autoFetchFavicons };
}

function collectBranding() {
    const title = document.getElementById("branding-title")?.value.trim() || "Mothership on Main";
    const subtitle =
        document.getElementById("branding-subtitle")?.value.trim() || "Your favorite bookmark replacement tool";
    const quotesTitle = document.getElementById("branding-quotes-title")?.value.trim() || "Quotes";
    return { title, subtitle, quotesTitle };
}

function collectBackgroundMode() {
    const select = document.getElementById("background-mode");
    return select?.value || "gradient_signature";
}
