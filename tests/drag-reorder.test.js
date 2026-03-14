import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";
import { createElement, buildTemplate } from "./helpers/dom-mock.js";

const env = loadScript({ useDomMock: true });
const g = env.globals;
const doc = env.document;

// Creates a mock element with a bounding rect for drag target testing.
function createItemWithRect(tag, top, height) {
    const el = createElement(tag);
    el._rect = { top, height, left: 0, width: 100, bottom: top + height, right: 100 };
    return el;
}

// Registers all DOM elements needed for init() and setupSettings() to run.
function setupFullDOM() {
    // Main page elements renderAll needs
    doc._createRegisteredElement("div", "sections-container");
    doc._createRegisteredElement("div", "title");
    doc._createRegisteredElement("div", "subtitle");
    doc._createRegisteredElement("div", "quotes-title");
    doc._createRegisteredElement("select", "search-engine");
    doc._createRegisteredElement("input", "search-input");
    doc._createRegisteredElement("form", "search-form");
    doc._createRegisteredElement("div", "text-container");

    // Settings panel elements setupSettings needs
    doc._createRegisteredElement("button", "settings-toggle");
    doc._createRegisteredElement("button", "rearrange-toggle");
    const panel = doc._createRegisteredElement("div", "settings-panel");
    doc._createRegisteredElement("button", "settings-save");
    doc._createRegisteredElement("button", "settings-save-bottom");
    doc._createRegisteredElement("button", "settings-cancel");
    doc._createRegisteredElement("button", "settings-cancel-bottom");
    doc._createRegisteredElement("button", "add-link");
    doc._createRegisteredElement("button", "add-section");
    doc._createRegisteredElement("input", "new-section-name");
    doc._createRegisteredElement("button", "add-background-url");
    doc._createRegisteredElement("select", "background-mode");
    doc._createRegisteredElement("button", "add-engine");
    doc._createRegisteredElement("input", "background-upload");
    doc._createRegisteredElement("span", "background-upload-name");
    doc._createRegisteredElement("input", "quotes-upload");
    doc._createRegisteredElement("span", "quotes-upload-name");
    doc._createRegisteredElement("button", "export-config");
    doc._createRegisteredElement("input", "import-config");
    doc._createRegisteredElement("span", "import-config-name");
    doc._createRegisteredElement("select", "import-config-mode");
    doc._createRegisteredElement("button", "reset-config");
    doc._createRegisteredElement("div", "links-editor");
    doc._createRegisteredElement("div", "engines-editor");
    doc._createRegisteredElement("input", "layout-resizable");
    doc._createRegisteredElement("input", "layout-max-columns");
    doc._createRegisteredElement("input", "layout-min-card-width");
    doc._createRegisteredElement("input", "layout-page-width");
    doc._createRegisteredElement("input", "visibility-search");
    doc._createRegisteredElement("input", "visibility-quotes");
    doc._createRegisteredElement("input", "visibility-links");
    doc._createRegisteredElement("input", "privacy-auto-fetch-favicons");
    doc._createRegisteredElement("select", "default-engine");

    // Editor elements
    doc._createRegisteredElement("textarea", "quotes-editor");
    doc._createRegisteredElement("input", "branding-title");
    doc._createRegisteredElement("input", "branding-subtitle");
    doc._createRegisteredElement("input", "branding-quotes-title");

    // Templates
    doc._registerElement(
        "link-row-template",
        buildTemplate("link-row-template", {
            tag: "div",
            className: "editor-row link-row",
            dataset: { linkRow: "true" },
            children: [
                { tag: "button", className: "link-row-handle", type: "button" },
                { tag: "img", className: "icon-preview" },
                { tag: "label", children: [{ tag: "input", dataset: { field: "name" } }] },
                { tag: "label", children: [{ tag: "input", dataset: { field: "url" } }] },
                {
                    tag: "label",
                    children: [
                        { tag: "select", dataset: { field: "section" } },
                        { tag: "input", dataset: { field: "sectionCustom" } }
                    ]
                },
                { tag: "label", children: [{ tag: "input", dataset: { field: "icon" } }] },
                { tag: "button", dataset: { action: "remove-link" } }
            ]
        })
    );

    doc._registerElement(
        "background-row-template",
        buildTemplate("background-row-template", {
            tag: "div",
            className: "editor-row background-row",
            dataset: { backgroundRow: "true" },
            children: [
                { tag: "img", className: "thumb-preview" },
                { tag: "label", children: [{ tag: "input", dataset: { field: "background" } }] },
                { tag: "button", dataset: { action: "remove-background" } }
            ]
        })
    );

    doc._registerElement(
        "engine-row-template",
        buildTemplate("engine-row-template", {
            tag: "div",
            className: "editor-row engine-row",
            dataset: { engineRow: "true" },
            children: [
                { tag: "button", className: "engine-row-handle", type: "button" },
                { tag: "label", children: [{ tag: "input", dataset: { field: "id" } }] },
                { tag: "label", children: [{ tag: "input", dataset: { field: "label" } }] },
                { tag: "label", children: [{ tag: "input", dataset: { field: "url" } }] },
                { tag: "label", children: [{ tag: "input", dataset: { field: "queryParam" } }] },
                { tag: "button", dataset: { action: "remove-engine" } }
            ]
        })
    );

    return panel;
}

beforeEach(() => {
    env.reset();
});

describe("findReorderTarget", () => {
    it("returns the closest element above the pointer", () => {
        const container = createElement("div");
        const item1 = createItemWithRect("div", 0, 40);
        item1.dataset.item = "true";
        const item2 = createItemWithRect("div", 50, 40);
        item2.dataset.item = "true";
        const item3 = createItemWithRect("div", 100, 40);
        item3.dataset.item = "true";
        container.appendChild(item1);
        container.appendChild(item2);
        container.appendChild(item3);

        // pointerY = 95 — item3 center (120) is above: offset = 95-120 = -25 (candidate)
        const target = g.findReorderTarget(container, "[data-item]", 95, null);
        expect(target).toBe(item3);
    });

    it("returns null when no candidates are above the pointer", () => {
        const container = createElement("div");
        const item1 = createItemWithRect("div", 0, 40);
        item1.dataset.item = "true";
        container.appendChild(item1);

        // pointerY = 200 — well below item1 center (20)
        const target = g.findReorderTarget(container, "[data-item]", 200, null);
        expect(target).toBeNull();
    });

    it("skips the dragging item", () => {
        const container = createElement("div");
        const item1 = createItemWithRect("div", 0, 40);
        item1.dataset.item = "true";
        const dragging = createItemWithRect("div", 50, 40);
        dragging.dataset.item = "true";
        container.appendChild(item1);
        container.appendChild(dragging);

        // pointerY = 10 — item1 center is 20, offset = -10 (candidate); dragging skipped
        const target = g.findReorderTarget(container, "[data-item]", 10, dragging);
        expect(target).toBe(item1);
    });

    it("handles single element", () => {
        const container = createElement("div");
        const item1 = createItemWithRect("div", 0, 40);
        item1.dataset.item = "true";
        container.appendChild(item1);

        // pointerY = 10, item center = 20, offset = -10 (candidate)
        const target = g.findReorderTarget(container, "[data-item]", 10, null);
        expect(target).toBe(item1);
    });

    it("handles empty container", () => {
        const container = createElement("div");
        const target = g.findReorderTarget(container, "[data-item]", 50, null);
        expect(target).toBeNull();
    });

    it("returns closest above when multiple are above pointer", () => {
        const container = createElement("div");
        const item1 = createItemWithRect("div", 100, 40);
        item1.dataset.item = "true";
        const item2 = createItemWithRect("div", 200, 40);
        item2.dataset.item = "true";
        container.appendChild(item1);
        container.appendChild(item2);

        // pointerY = 50: item1 center=120 offset=-70, item2 center=220 offset=-170
        // item1 is closer (offset > closestOffset)
        const target = g.findReorderTarget(container, "[data-item]", 50, null);
        expect(target).toBe(item1);
    });
});

describe("setRearrangeMode", () => {
    it("toggles isRearranging and CSS classes when enabled", async () => {
        setupFullDOM();
        await g.init();

        g.setRearrangeMode(true);

        const panel = doc.getElementById("settings-panel");
        expect(panel.classList.contains("rearrange")).toBe(true);
        expect(doc.body.classList.contains("rearrange-mode")).toBe(true);
    });

    it("removes rearrange classes when disabled", async () => {
        setupFullDOM();
        await g.init();

        g.setRearrangeMode(true);
        g.setRearrangeMode(false);

        const panel = doc.getElementById("settings-panel");
        expect(panel.classList.contains("rearrange")).toBe(false);
        expect(doc.body.classList.contains("rearrange-mode")).toBe(false);
    });

    it("sets toggle text to 'Finish' when enabled", async () => {
        setupFullDOM();
        await g.init();

        g.setRearrangeMode(true);

        const toggle = doc.getElementById("rearrange-toggle");
        expect(toggle.textContent).toBe("Finish");
    });

    it("sets toggle text to 'Rearrange' when disabled", async () => {
        setupFullDOM();
        await g.init();

        g.setRearrangeMode(true);
        g.setRearrangeMode(false);

        const toggle = doc.getElementById("rearrange-toggle");
        expect(toggle.textContent).toBe("Rearrange");
    });
});

describe("updateLinkRowDragState", () => {
    it("sets draggable true on link rows when rearranging", async () => {
        setupFullDOM();
        await g.init();

        // Add some link rows to the editor
        const editor = doc.getElementById("links-editor");
        const row1 = createElement("div");
        row1.dataset.linkRow = "true";
        editor.appendChild(row1);

        g.setRearrangeMode(true);
        g.updateLinkRowDragState();

        expect(row1.draggable).toBe(true);
    });

    it("sets draggable false on link rows when not rearranging", async () => {
        setupFullDOM();
        await g.init();

        const editor = doc.getElementById("links-editor");
        const row1 = createElement("div");
        row1.dataset.linkRow = "true";
        row1.draggable = true;
        editor.appendChild(row1);

        g.setRearrangeMode(false);
        g.updateLinkRowDragState();

        expect(row1.draggable).toBe(false);
    });
});

describe("updateEngineRowDragState", () => {
    it("sets draggable and aria-disabled on engine rows", async () => {
        setupFullDOM();
        await g.init();

        const editor = doc.getElementById("engines-editor");
        const row = createElement("div");
        row.dataset.engineRow = "true";
        const handle = createElement("button");
        handle.className = "engine-row-handle";
        row.appendChild(handle);
        editor.appendChild(row);

        // canRearrangeEditor returns false (settings panel not open)
        g.updateEngineRowDragState();

        expect(row.draggable).toBe(false);
        expect(handle.getAttribute("aria-disabled")).toBe("true");
    });
});

describe("updateMainDragState", () => {
    it("sets draggable on link cards, sections, and handles when rearranging", async () => {
        setupFullDOM();
        await g.init();
        g.setRearrangeMode(true);

        // Add elements after setRearrangeMode (renderAll clears the container)
        const container = doc.getElementById("sections-container");
        const card = createElement("a");
        card.className = "link-card";
        container.appendChild(card);

        const section = createElement("div");
        section.className = "section";
        container.appendChild(section);

        const handle = createElement("button");
        handle.className = "section-handle";
        container.appendChild(handle);

        // Call updateMainDragState directly to apply current state
        g.updateMainDragState();

        expect(card.draggable).toBe(true);
        expect(section.draggable).toBe(true);
        expect(handle.draggable).toBe(true);
    });

    it("clears draggable when not rearranging", async () => {
        setupFullDOM();
        await g.init();

        const container = doc.getElementById("sections-container");
        const card = createElement("a");
        card.className = "link-card";
        card.draggable = true;
        container.appendChild(card);

        g.setRearrangeMode(false);

        expect(card.draggable).toBe(false);
    });
});

describe("FOUC prevention", () => {
    it("init() removes the loading class from body", async () => {
        setupFullDOM();
        doc.body.classList.add("loading");

        expect(doc.body.classList.contains("loading")).toBe(true);
        await g.init();
        expect(doc.body.classList.contains("loading")).toBe(false);
    });
});
