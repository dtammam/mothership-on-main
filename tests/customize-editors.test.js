import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";
import { buildTemplate } from "./helpers/dom-mock.js";

const env = loadScript({ useDomMock: true });
const g = env.globals;
const doc = env.document;

// Builds the link-row-template matching index.html structure.
function buildLinkRowTemplate() {
    return buildTemplate("link-row-template", {
        tag: "div",
        className: "editor-row link-row",
        dataset: { linkRow: "true" },
        children: [
            { tag: "button", className: "link-row-handle", type: "button" },
            { tag: "img", className: "icon-preview" },
            { tag: "label", className: "field field-name", children: [{ tag: "input", dataset: { field: "name" } }] },
            { tag: "label", className: "field field-url", children: [{ tag: "input", dataset: { field: "url" } }] },
            {
                tag: "label",
                className: "field field-section",
                children: [
                    { tag: "select", dataset: { field: "section" } },
                    { tag: "input", dataset: { field: "sectionCustom" } }
                ]
            },
            {
                tag: "label",
                className: "field field-icon",
                children: [{ tag: "input", dataset: { field: "icon" } }]
            },
            { tag: "button", dataset: { action: "remove-link" }, className: "link-row-remove" }
        ]
    });
}

// Builds the background-row-template matching index.html structure.
function buildBackgroundRowTemplate() {
    return buildTemplate("background-row-template", {
        tag: "div",
        className: "editor-row background-row",
        dataset: { backgroundRow: "true" },
        children: [
            { tag: "img", className: "thumb-preview" },
            { tag: "label", className: "field", children: [{ tag: "input", dataset: { field: "background" } }] },
            { tag: "button", dataset: { action: "remove-background" } }
        ]
    });
}

// Builds the engine-row-template matching index.html structure.
function buildEngineRowTemplate() {
    return buildTemplate("engine-row-template", {
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
    });
}

// Registers all DOM elements the customize editors depend on.
function setupEditorDOM() {
    doc._createRegisteredElement("div", "links-editor");
    doc._createRegisteredElement("div", "backgrounds-editor");
    doc._createRegisteredElement("textarea", "quotes-editor");
    doc._createRegisteredElement("div", "engines-editor");
    doc._createRegisteredElement("select", "default-engine");
    doc._createRegisteredElement("select", "background-mode");
    doc._createRegisteredElement("input", "branding-title");
    doc._createRegisteredElement("input", "branding-subtitle");
    doc._createRegisteredElement("input", "branding-quotes-title");
    doc._createRegisteredElement("input", "layout-resizable");
    doc._createRegisteredElement("input", "layout-max-columns");
    doc._createRegisteredElement("input", "layout-min-card-width");
    doc._createRegisteredElement("input", "layout-page-width");
    doc._createRegisteredElement("input", "visibility-search");
    doc._createRegisteredElement("input", "visibility-quotes");
    doc._createRegisteredElement("input", "visibility-links");
    doc._createRegisteredElement("input", "privacy-auto-fetch-favicons");
    doc._createRegisteredElement("div", "sections-container");
    doc._createRegisteredElement("div", "settings-panel");

    doc._registerElement("link-row-template", buildLinkRowTemplate());
    doc._registerElement("background-row-template", buildBackgroundRowTemplate());
    doc._registerElement("engine-row-template", buildEngineRowTemplate());
}

function makeConfig(overrides = {}) {
    return {
        branding: { title: "Test", subtitle: "Sub", quotesTitle: "Q" },
        sections: ["Links"],
        links: [],
        quotes: [],
        backgrounds: [],
        backgroundMode: "gradient_signature",
        layout: { resizable: false, maxColumns: 4, minCardWidth: 180, pageWidth: 72 },
        visibility: { search: true, quotes: true, links: true },
        privacy: { autoFetchFavicons: true },
        collapsedSections: [],
        search: { defaultEngine: "google", engines: [] },
        ...overrides
    };
}

beforeEach(() => {
    env.reset();
});

describe("renderSettings", () => {
    it("calls all sub-renderers and populates editor DOM", () => {
        setupEditorDOM();
        const config = makeConfig({
            links: [{ id: "l1", name: "Example", url: "https://example.com", section: "Links" }],
            quotes: ["Hello world"],
            branding: { title: "My Title", subtitle: "My Sub", quotesTitle: "My Quotes" },
            backgroundMode: "gradient_soda"
        });

        g.renderSettings(config);

        // Links editor populated
        const linksEditor = doc.getElementById("links-editor");
        expect(linksEditor.querySelectorAll("[data-link-row]").length).toBe(1);

        // Quotes editor populated
        const quotesEditor = doc.getElementById("quotes-editor");
        expect(quotesEditor.value).toBe("Hello world");

        // Branding populated
        expect(doc.getElementById("branding-title").value).toBe("My Title");
        expect(doc.getElementById("branding-subtitle").value).toBe("My Sub");
        expect(doc.getElementById("branding-quotes-title").value).toBe("My Quotes");

        // Background mode populated
        expect(doc.getElementById("background-mode").value).toBe("gradient_soda");
    });
});

describe("renderLinksEditor", () => {
    it("populates rows with correct field values", () => {
        setupEditorDOM();
        const links = [
            { id: "l1", name: "Link One", url: "https://one.com", section: "Work" },
            { id: "l2", name: "Link Two", url: "https://two.com", section: "Personal" }
        ];

        g.renderLinksEditor(links, ["Work", "Personal"]);

        const editor = doc.getElementById("links-editor");
        const rows = editor.querySelectorAll("[data-link-row]");
        expect(rows.length).toBe(2);
        expect(rows[0].querySelector('[data-field="name"]').value).toBe("Link One");
        expect(rows[0].querySelector('[data-field="url"]').value).toBe("https://one.com");
        expect(rows[1].querySelector('[data-field="name"]').value).toBe("Link Two");
        expect(rows[1].querySelector('[data-field="url"]').value).toBe("https://two.com");
    });

    it("creates section blocks for each section", () => {
        setupEditorDOM();
        const links = [
            { id: "l1", name: "A", url: "https://a.com", section: "Work" },
            { id: "l2", name: "B", url: "https://b.com", section: "Personal" }
        ];

        g.renderLinksEditor(links, ["Work", "Personal"]);

        const editor = doc.getElementById("links-editor");
        const sections = editor.querySelectorAll("[data-section-block]");
        expect(sections.length).toBe(2);
        expect(sections[0].dataset.section).toBe("Work");
        expect(sections[1].dataset.section).toBe("Personal");
    });

    it("adds a default row when links array is empty", () => {
        setupEditorDOM();
        g.renderLinksEditor([], []);

        const editor = doc.getElementById("links-editor");
        const rows = editor.querySelectorAll("[data-link-row]");
        expect(rows.length).toBe(1);
    });

    it("sets iconOverride data and preview src", () => {
        setupEditorDOM();
        const links = [
            {
                id: "l1",
                name: "Icon",
                url: "https://icon.com",
                section: "Links",
                iconOverride: "data:image/png;base64,abc"
            }
        ];

        g.renderLinksEditor(links, ["Links"]);

        const editor = doc.getElementById("links-editor");
        const row = editor.querySelector("[data-link-row]");
        expect(row.dataset.iconOverride).toBe("data:image/png;base64,abc");
        const preview = row.querySelector(".icon-preview");
        expect(preview.src).toBe("data:image/png;base64,abc");
    });

    it("uses default icon when no iconOverride", () => {
        setupEditorDOM();
        g.renderLinksEditor([{ id: "l1", name: "No Icon", url: "https://noicon.com", section: "Links" }], ["Links"]);

        const editor = doc.getElementById("links-editor");
        const preview = editor.querySelector(".icon-preview");
        expect(preview.src).toBe("images/icon.png");
    });

    it("clears previous content before re-rendering", () => {
        setupEditorDOM();
        g.renderLinksEditor([{ id: "l1", name: "First", url: "https://first.com" }], []);
        g.renderLinksEditor([{ id: "l2", name: "Second", url: "https://second.com" }], []);

        const editor = doc.getElementById("links-editor");
        const rows = editor.querySelectorAll("[data-link-row]");
        expect(rows.length).toBe(1);
        expect(rows[0].querySelector('[data-field="name"]').value).toBe("Second");
    });
});

describe("renderBackgroundsEditor", () => {
    it("populates rows from backgrounds array", () => {
        setupEditorDOM();
        g.renderBackgroundsEditor(["https://img1.com/bg.jpg", "https://img2.com/bg.jpg"]);

        const editor = doc.getElementById("backgrounds-editor");
        const rows = editor.querySelectorAll("[data-background-row]");
        expect(rows.length).toBe(2);
        expect(rows[0].querySelector('[data-field="background"]').value).toBe("https://img1.com/bg.jpg");
        expect(rows[1].querySelector('[data-field="background"]').value).toBe("https://img2.com/bg.jpg");
    });

    it("adds default empty row when backgrounds is empty", () => {
        setupEditorDOM();
        g.renderBackgroundsEditor([]);

        const editor = doc.getElementById("backgrounds-editor");
        const rows = editor.querySelectorAll("[data-background-row]");
        expect(rows.length).toBe(1);
        expect(rows[0].querySelector('[data-field="background"]').value).toBe("");
    });

    it("clears previous content before re-rendering", () => {
        setupEditorDOM();
        g.renderBackgroundsEditor(["https://first.com"]);
        g.renderBackgroundsEditor(["https://second.com", "https://third.com"]);

        const editor = doc.getElementById("backgrounds-editor");
        const rows = editor.querySelectorAll("[data-background-row]");
        expect(rows.length).toBe(2);
    });
});

describe("renderQuotesEditor", () => {
    it("joins quotes with newlines in textarea", () => {
        setupEditorDOM();
        g.renderQuotesEditor(["Quote one", "Quote two", "Quote three"]);

        const textarea = doc.getElementById("quotes-editor");
        expect(textarea.value).toBe("Quote one\nQuote two\nQuote three");
    });

    it("handles empty quotes array", () => {
        setupEditorDOM();
        g.renderQuotesEditor([]);

        const textarea = doc.getElementById("quotes-editor");
        expect(textarea.value).toBe("");
    });

    it("handles single quote", () => {
        setupEditorDOM();
        g.renderQuotesEditor(["Only one"]);

        const textarea = doc.getElementById("quotes-editor");
        expect(textarea.value).toBe("Only one");
    });
});

describe("renderLayoutEditor", () => {
    it("populates layout inputs from config", () => {
        setupEditorDOM();
        g.renderLayoutEditor({ resizable: true, maxColumns: 6, minCardWidth: 200, pageWidth: 80 });

        expect(doc.getElementById("layout-resizable").checked).toBe(true);
        expect(doc.getElementById("layout-max-columns").value).toBe("6");
        expect(doc.getElementById("layout-min-card-width").value).toBe("200");
        expect(doc.getElementById("layout-page-width").value).toBe("80");
    });

    it("uses defaults when resizable is false", () => {
        setupEditorDOM();
        g.renderLayoutEditor({ resizable: false });

        expect(doc.getElementById("layout-resizable").checked).toBe(false);
        expect(doc.getElementById("layout-max-columns").value).toBe("4");
        expect(doc.getElementById("layout-min-card-width").value).toBe("180");
        expect(doc.getElementById("layout-page-width").value).toBe("72");
    });

    it("uses defaults when layout is undefined", () => {
        setupEditorDOM();
        g.renderLayoutEditor(undefined);

        expect(doc.getElementById("layout-resizable").checked).toBe(false);
        expect(doc.getElementById("layout-max-columns").value).toBe("4");
    });
});

describe("updateLayoutControlState", () => {
    it("disables controls when not resizable", () => {
        setupEditorDOM();
        g.updateLayoutControlState({ resizable: false });

        expect(doc.getElementById("layout-max-columns").disabled).toBe(true);
        expect(doc.getElementById("layout-min-card-width").disabled).toBe(true);
        expect(doc.getElementById("layout-page-width").disabled).toBe(true);
    });

    it("enables controls when resizable", () => {
        setupEditorDOM();
        g.updateLayoutControlState({ resizable: true });

        expect(doc.getElementById("layout-max-columns").disabled).toBe(false);
        expect(doc.getElementById("layout-min-card-width").disabled).toBe(false);
        expect(doc.getElementById("layout-page-width").disabled).toBe(false);
    });
});

describe("renderVisibilityEditor", () => {
    it("reflects config values in checkboxes", () => {
        setupEditorDOM();
        g.renderVisibilityEditor({ search: false, quotes: true, links: false });

        expect(doc.getElementById("visibility-search").checked).toBe(false);
        expect(doc.getElementById("visibility-quotes").checked).toBe(true);
        expect(doc.getElementById("visibility-links").checked).toBe(false);
    });

    it("defaults to true when visibility properties are undefined", () => {
        setupEditorDOM();
        g.renderVisibilityEditor({});

        expect(doc.getElementById("visibility-search").checked).toBe(true);
        expect(doc.getElementById("visibility-quotes").checked).toBe(true);
        expect(doc.getElementById("visibility-links").checked).toBe(true);
    });

    it("defaults to true when visibility is undefined", () => {
        setupEditorDOM();
        g.renderVisibilityEditor(undefined);

        expect(doc.getElementById("visibility-search").checked).toBe(true);
    });
});

describe("renderPrivacyEditor", () => {
    it("reflects autoFetchFavicons in checkbox", () => {
        setupEditorDOM();
        g.renderPrivacyEditor({ autoFetchFavicons: false });

        expect(doc.getElementById("privacy-auto-fetch-favicons").checked).toBe(false);
    });

    it("defaults to true when undefined", () => {
        setupEditorDOM();
        g.renderPrivacyEditor({});

        expect(doc.getElementById("privacy-auto-fetch-favicons").checked).toBe(true);
    });

    it("defaults to true when privacy is undefined", () => {
        setupEditorDOM();
        g.renderPrivacyEditor(undefined);

        expect(doc.getElementById("privacy-auto-fetch-favicons").checked).toBe(true);
    });
});

describe("renderBrandingEditor", () => {
    it("populates title, subtitle, and quotesTitle inputs", () => {
        setupEditorDOM();
        g.renderBrandingEditor({ title: "My Page", subtitle: "Hello", quotesTitle: "Wisdom" });

        expect(doc.getElementById("branding-title").value).toBe("My Page");
        expect(doc.getElementById("branding-subtitle").value).toBe("Hello");
        expect(doc.getElementById("branding-quotes-title").value).toBe("Wisdom");
    });

    it("uses empty strings when branding fields are missing", () => {
        setupEditorDOM();
        g.renderBrandingEditor({});

        expect(doc.getElementById("branding-title").value).toBe("");
        expect(doc.getElementById("branding-subtitle").value).toBe("");
        expect(doc.getElementById("branding-quotes-title").value).toBe("");
    });

    it("handles undefined branding gracefully", () => {
        setupEditorDOM();
        g.renderBrandingEditor(undefined);

        expect(doc.getElementById("branding-title").value).toBe("");
    });
});

describe("renderBackgroundModeEditor", () => {
    it("sets select value to match config", () => {
        setupEditorDOM();
        g.renderBackgroundModeEditor("gradient_soda");

        expect(doc.getElementById("background-mode").value).toBe("gradient_soda");
    });

    it("defaults to gradient_signature when mode is falsy", () => {
        setupEditorDOM();
        g.renderBackgroundModeEditor(undefined);

        expect(doc.getElementById("background-mode").value).toBe("gradient_signature");
    });
});

describe("createLinksSection", () => {
    it("builds DOM structure with header, heading, remove button, and list", () => {
        setupEditorDOM();
        const container = doc.getElementById("links-editor");
        const list = g.createLinksSection("Work", container);

        expect(container.children.length).toBe(1);
        const sectionEl = container.children[0];
        expect(sectionEl.className).toContain("links-section");
        expect(sectionEl.dataset.section).toBe("Work");
        expect(sectionEl.dataset.sectionBlock).toBe("true");

        // Header with h4 and remove button
        const header = sectionEl.querySelector(".links-section-header");
        expect(header).not.toBeNull();
        const heading = header.querySelector("h4");
        expect(heading.textContent).toBe("Work");
        const removeBtn = header.querySelector(".section-remove");
        expect(removeBtn).not.toBeNull();
        expect(removeBtn.dataset.action).toBe("remove-section");

        // Section list
        expect(list.dataset.sectionList).toBe("true");
        expect(list.dataset.section).toBe("Work");
    });
});

describe("ensureLinksSection", () => {
    it("creates a new section when one does not exist", () => {
        setupEditorDOM();
        const container = doc.getElementById("links-editor");

        const list = g.ensureLinksSection("NewSection");
        expect(list).not.toBeNull();
        expect(container.querySelectorAll("[data-section-block]").length).toBe(1);
    });

    it("returns existing section list when section already exists", () => {
        setupEditorDOM();
        const container = doc.getElementById("links-editor");

        const list1 = g.ensureLinksSection("Existing");
        const list2 = g.ensureLinksSection("Existing");
        expect(list1).toBe(list2);
        expect(container.querySelectorAll("[data-section-block]").length).toBe(1);
    });
});

describe("link section management", () => {
    it("refreshLinkSectionChoices populates dropdowns with section names", () => {
        setupEditorDOM();
        g.renderLinksEditor([{ id: "l1", name: "A", url: "https://a.com", section: "Work" }], ["Work", "Personal"]);

        // Each link row should have a section select with Work, Personal, and New...
        const editor = doc.getElementById("links-editor");
        const row = editor.querySelector("[data-link-row]");
        const select = row.querySelector('[data-field="section"]');
        expect(select.children.length).toBe(3); // Work, Personal, New...
        expect(select.children[0].value).toBe("Work");
        expect(select.children[1].value).toBe("Personal");
        expect(select.children[2].value).toBe("__new__");
        expect(select.children[2].textContent).toBe("New...");
    });

    it("getLinkRowSectionValue returns the selected section", () => {
        setupEditorDOM();
        g.renderLinksEditor([{ id: "l1", name: "A", url: "https://a.com", section: "Work" }], ["Work"]);

        const editor = doc.getElementById("links-editor");
        const row = editor.querySelector("[data-link-row]");
        const value = g.getLinkRowSectionValue(row);
        expect(value).toBe("Work");
    });

    it("setLinkRowSectionValue updates the select value", () => {
        setupEditorDOM();
        g.renderLinksEditor([{ id: "l1", name: "A", url: "https://a.com", section: "Work" }], ["Work", "Personal"]);

        const editor = doc.getElementById("links-editor");
        const row = editor.querySelector("[data-link-row]");
        g.setLinkRowSectionValue(row, "Personal");

        const select = row.querySelector('[data-field="section"]');
        expect(select.value).toBe("Personal");
    });

    it("setLinkRowSectionValue shows custom input for unknown section", () => {
        setupEditorDOM();
        g.renderLinksEditor([{ id: "l1", name: "A", url: "https://a.com", section: "Work" }], ["Work"]);

        const editor = doc.getElementById("links-editor");
        const row = editor.querySelector("[data-link-row]");
        g.setLinkRowSectionValue(row, "Brand New");

        const select = row.querySelector('[data-field="section"]');
        expect(select.value).toBe("__new__");
        const customInput = row.querySelector('[data-field="sectionCustom"]');
        expect(customInput.value).toBe("Brand New");
        expect(customInput.hidden).toBe(false);
    });

    it("setLinkRowSectionValue defaults to Links when section is empty", () => {
        setupEditorDOM();
        g.renderLinksEditor([{ id: "l1", name: "A", url: "https://a.com", section: "Links" }], ["Links"]);

        const editor = doc.getElementById("links-editor");
        const row = editor.querySelector("[data-link-row]");
        g.setLinkRowSectionValue(row, "");

        const select = row.querySelector('[data-field="section"]');
        expect(select.value).toBe("Links");
    });
});
