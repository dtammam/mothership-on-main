import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";
import { buildTemplate } from "./helpers/dom-mock.js";

const env = loadScript({ useDomMock: true });
const g = env.globals;
const doc = env.document;

// Registers the DOM elements renderSearch and collectSearch depend on.
function setupSearchDOM() {
    doc._createRegisteredElement("form", "search-form");
    doc._createRegisteredElement("select", "search-engine");
    doc._createRegisteredElement("input", "search-input");
}

// Registers the DOM elements collectSearch depends on (editor side).
function setupSearchEditorDOM() {
    const enginesEditor = doc._createRegisteredElement("div", "engines-editor");
    const defaultEngine = doc._createRegisteredElement("select", "default-engine");

    // Register engine-row template
    const engineTemplate = buildTemplate("engine-row-template", {
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
    doc._registerElement("engine-row-template", engineTemplate);

    return { enginesEditor, defaultEngine };
}

function makeSearchConfig(overrides = {}) {
    return {
        defaultEngine: "google",
        engines: [
            { id: "google", label: "Google", url: "https://www.google.com/search", queryParam: "q" },
            { id: "bing", label: "Bing", url: "https://www.bing.com/search", queryParam: "q" }
        ],
        ...overrides
    };
}

beforeEach(() => {
    env.reset();
});

describe("renderSearch", () => {
    describe("happy path", () => {
        it("populates search engine select with options", () => {
            setupSearchDOM();
            const search = makeSearchConfig();
            g.renderSearch(search);

            const select = doc.getElementById("search-engine");
            expect(select.children.length).toBe(2);
            expect(select.children[0].value).toBe("google");
            expect(select.children[0].textContent).toBe("Google");
            expect(select.children[1].value).toBe("bing");
            expect(select.children[1].textContent).toBe("Bing");
        });

        it("sets the default engine value on the select", () => {
            setupSearchDOM();
            g.renderSearch(makeSearchConfig({ defaultEngine: "bing" }));

            const select = doc.getElementById("search-engine");
            expect(select.value).toBe("bing");
        });

        it("sets form action to the selected engine URL", () => {
            setupSearchDOM();
            g.renderSearch(makeSearchConfig());

            const form = doc.getElementById("search-form");
            expect(form.action).toBe("https://www.google.com/search");
        });

        it("sets search input name to the engine queryParam", () => {
            setupSearchDOM();
            g.renderSearch(makeSearchConfig());

            const input = doc.getElementById("search-input");
            expect(input.name).toBe("q");
        });

        it("renders a single engine correctly", () => {
            setupSearchDOM();
            const search = {
                defaultEngine: "ddg",
                engines: [{ id: "ddg", label: "DuckDuckGo", url: "https://duckduckgo.com/", queryParam: "q" }]
            };
            g.renderSearch(search);

            const select = doc.getElementById("search-engine");
            expect(select.children.length).toBe(1);
            expect(select.children[0].value).toBe("ddg");
        });

        it("uses custom queryParam for non-standard engines", () => {
            setupSearchDOM();
            const search = {
                defaultEngine: "custom",
                engines: [{ id: "custom", label: "Custom", url: "https://example.com/search", queryParam: "query" }]
            };
            g.renderSearch(search);

            const input = doc.getElementById("search-input");
            expect(input.name).toBe("query");
        });
    });

    describe("edge cases", () => {
        it("falls back to first engine when defaultEngine is missing", () => {
            setupSearchDOM();
            const search = makeSearchConfig({ defaultEngine: undefined });
            g.renderSearch(search);

            const form = doc.getElementById("search-form");
            expect(form.action).toBe("https://www.google.com/search");
        });

        it("falls back to first engine when defaultEngine does not match any engine", () => {
            setupSearchDOM();
            const search = makeSearchConfig({ defaultEngine: "nonexistent" });
            g.renderSearch(search);

            // Select value will be set to "nonexistent" but updateSearchEngine
            // falls back to engines[0]
            const form = doc.getElementById("search-form");
            expect(form.action).toBe("https://www.google.com/search");
        });

        it("clears previous options before rendering", () => {
            setupSearchDOM();
            g.renderSearch(makeSearchConfig());
            // Render again with different engines
            g.renderSearch({
                defaultEngine: "ddg",
                engines: [{ id: "ddg", label: "DDG", url: "https://ddg.com", queryParam: "q" }]
            });

            const select = doc.getElementById("search-engine");
            expect(select.children.length).toBe(1);
            expect(select.children[0].value).toBe("ddg");
        });

        it("defaults queryParam to 'q' when engine omits it", () => {
            setupSearchDOM();
            g.renderSearch({
                defaultEngine: "bare",
                engines: [{ id: "bare", label: "Bare", url: "https://bare.com/search" }]
            });

            const input = doc.getElementById("search-input");
            expect(input.name).toBe("q");
        });

        it("renders many engines without error", () => {
            setupSearchDOM();
            const engines = Array.from({ length: 20 }, (_, i) => ({
                id: `engine-${i}`,
                label: `Engine ${i}`,
                url: `https://e${i}.com/search`,
                queryParam: "q"
            }));
            g.renderSearch({ defaultEngine: "engine-0", engines });

            const select = doc.getElementById("search-engine");
            expect(select.children.length).toBe(20);
        });
    });

    describe("error paths", () => {
        it("handles empty engines array without crashing", () => {
            setupSearchDOM();
            // renderSearch iterates engines — empty array should not throw
            g.renderSearch({ engines: [], defaultEngine: "" });

            const select = doc.getElementById("search-engine");
            expect(select.children.length).toBe(0);
        });
    });
});

describe("collectSearch", () => {
    describe("happy path", () => {
        it("collects engines from editor rows", () => {
            setupSearchDOM();
            setupSearchEditorDOM();

            // Manually add engine rows (simulating what renderSearchEditor does)
            g.renderSearchEditor({
                defaultEngine: "google",
                engines: [
                    { id: "google", label: "Google", url: "https://www.google.com/search", queryParam: "q" },
                    { id: "bing", label: "Bing", url: "https://www.bing.com/search", queryParam: "q" }
                ]
            });

            const result = g.collectSearch();
            expect(result.engines.length).toBe(2);
            expect(result.engines[0].id).toBe("google");
            expect(result.engines[0].label).toBe("Google");
            expect(result.engines[0].url).toBe("https://www.google.com/search");
            expect(result.engines[0].queryParam).toBe("q");
            expect(result.engines[1].id).toBe("bing");
        });

        it("returns the selected default engine", () => {
            setupSearchDOM();
            setupSearchEditorDOM();

            g.renderSearchEditor({
                defaultEngine: "bing",
                engines: [
                    { id: "google", label: "Google", url: "https://www.google.com/search", queryParam: "q" },
                    { id: "bing", label: "Bing", url: "https://www.bing.com/search", queryParam: "q" }
                ]
            });

            const result = g.collectSearch();
            expect(result.defaultEngine).toBe("bing");
        });
    });

    describe("edge cases", () => {
        it("skips rows with empty id", () => {
            setupSearchDOM();
            setupSearchEditorDOM();

            g.renderSearchEditor({
                defaultEngine: "",
                engines: [
                    { id: "", label: "Empty", url: "https://empty.com", queryParam: "q" },
                    { id: "valid", label: "Valid", url: "https://valid.com/search", queryParam: "q" }
                ]
            });

            const result = g.collectSearch();
            expect(result.engines.length).toBe(1);
            expect(result.engines[0].id).toBe("valid");
        });

        it("skips rows with empty url", () => {
            setupSearchDOM();
            setupSearchEditorDOM();

            g.renderSearchEditor({
                defaultEngine: "",
                engines: [{ id: "nope", label: "No URL", url: "", queryParam: "q" }]
            });

            const result = g.collectSearch();
            expect(result.engines.length).toBe(0);
        });

        it("uses id as label when label is empty", () => {
            setupSearchDOM();
            setupSearchEditorDOM();

            g.renderSearchEditor({
                defaultEngine: "myid",
                engines: [{ id: "myid", label: "", url: "https://example.com", queryParam: "q" }]
            });

            const result = g.collectSearch();
            expect(result.engines[0].label).toBe("myid");
        });

        it("defaults queryParam to 'q' when blank", () => {
            setupSearchDOM();
            setupSearchEditorDOM();

            g.renderSearchEditor({
                defaultEngine: "test",
                engines: [{ id: "test", label: "Test", url: "https://test.com", queryParam: "" }]
            });

            const result = g.collectSearch();
            expect(result.engines[0].queryParam).toBe("q");
        });
    });
});

describe("renderSearchEditor", () => {
    it("populates engine rows from config", () => {
        setupSearchDOM();
        const { enginesEditor } = setupSearchEditorDOM();

        g.renderSearchEditor({
            defaultEngine: "google",
            engines: [{ id: "google", label: "Google", url: "https://www.google.com/search", queryParam: "q" }]
        });

        const rows = enginesEditor.querySelectorAll("[data-engine-row]");
        expect(rows.length).toBe(1);
        expect(rows[0].querySelector('[data-field="id"]').value).toBe("google");
        expect(rows[0].querySelector('[data-field="label"]').value).toBe("Google");
    });

    it("adds a default Google row when engines array is empty", () => {
        setupSearchDOM();
        const { enginesEditor } = setupSearchEditorDOM();

        g.renderSearchEditor({ defaultEngine: "", engines: [] });

        const rows = enginesEditor.querySelectorAll("[data-engine-row]");
        expect(rows.length).toBe(1);
        expect(rows[0].querySelector('[data-field="id"]').value).toBe("google");
    });

    it("populates default-engine select with engine ids", () => {
        setupSearchDOM();
        const { defaultEngine } = setupSearchEditorDOM();

        g.renderSearchEditor({
            defaultEngine: "bing",
            engines: [
                { id: "google", label: "Google", url: "https://www.google.com/search", queryParam: "q" },
                { id: "bing", label: "Bing", url: "https://www.bing.com/search", queryParam: "q" }
            ]
        });

        expect(defaultEngine.children.length).toBe(2);
        expect(defaultEngine.value).toBe("bing");
    });
});

describe("addEngineRow + refreshDefaultEngineOptions", () => {
    it("adds a new engine row and syncs default engine select", () => {
        setupSearchDOM();
        const { enginesEditor, defaultEngine } = setupSearchEditorDOM();

        // Start with one engine
        g.renderSearchEditor({
            defaultEngine: "google",
            engines: [{ id: "google", label: "Google", url: "https://www.google.com/search", queryParam: "q" }]
        });

        expect(enginesEditor.querySelectorAll("[data-engine-row]").length).toBe(1);

        // Add another engine row (simulating the UI action)
        g.addEngineRow(
            { id: "ddg", label: "DDG", url: "https://ddg.com", queryParam: "q" },
            enginesEditor,
            doc.getElementById("engine-row-template")
        );
        g.refreshDefaultEngineOptions();

        expect(enginesEditor.querySelectorAll("[data-engine-row]").length).toBe(2);
        // Default engine select should now have 2 options
        expect(defaultEngine.children.length).toBe(2);
    });
});
