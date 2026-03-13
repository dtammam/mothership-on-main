import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";

const env = loadScript();
const { msomStorage } = env;
const g = env.globals;

beforeEach(() => {
    env.reset();
});

// A complete, realistic config for round-trip testing
function fullConfig() {
    return {
        branding: { title: "Mothership", subtitle: "Launch pad", quotesTitle: "Inspiration" },
        sections: ["Work", "Personal", "Tools"],
        links: [
            { id: "l1", name: "GitHub", url: "https://github.com", section: "Work" },
            { id: "l2", name: "Gmail", url: "https://gmail.com", section: "Personal" },
            { id: "l3", name: "VS Code", url: "https://vscode.dev", section: "Tools" }
        ],
        quotes: ["Stay hungry, stay foolish.", "Move fast and break things.", "Ship it."],
        backgrounds: ["https://example.com/bg1.jpg", "https://example.com/bg2.jpg"],
        backgroundMode: "images",
        layout: { resizable: true, maxColumns: 6, minCardWidth: 200, pageWidth: 80 },
        visibility: { search: true, quotes: true, links: true },
        privacy: { autoFetchFavicons: false },
        collapsedSections: ["Tools"],
        search: {
            defaultEngine: "google",
            engines: [
                { name: "Google", urlTemplate: "https://google.com/search?q=%s" },
                { name: "DuckDuckGo", urlTemplate: "https://duckduckgo.com/?q=%s" }
            ]
        }
    };
}

// A minimal base config for merge tests
function baseConfig() {
    return {
        branding: { title: "Base", subtitle: "Original", quotesTitle: "Quotes" },
        sections: ["Links"],
        links: [{ id: "base-1", name: "Base Link", url: "https://base.com", section: "Links" }],
        quotes: ["Base quote"],
        backgrounds: ["https://base.com/bg.jpg"],
        backgroundMode: "gradient_signature",
        layout: { resizable: false, maxColumns: 4, minCardWidth: 180, pageWidth: 72 },
        visibility: { search: true, quotes: true, links: true },
        privacy: { autoFetchFavicons: true },
        collapsedSections: [],
        search: { defaultEngine: "google", engines: [] }
    };
}

describe("export → import round-trip", () => {
    it("preserves all fields through JSON.stringify → JSON.parse → mergeConfig", () => {
        const config = fullConfig();
        const exported = JSON.stringify(config, null, 2);
        const imported = JSON.parse(exported);
        const base = baseConfig();

        const result = msomStorage.mergeConfig(base, imported);

        expect(result.branding).toEqual(config.branding);
        expect(result.links).toEqual(config.links);
        expect(result.quotes).toEqual(config.quotes);
        expect(result.backgrounds).toEqual(config.backgrounds);
        expect(result.backgroundMode).toBe(config.backgroundMode);
        expect(result.layout).toEqual(config.layout);
        expect(result.visibility).toEqual(config.visibility);
        expect(result.privacy).toEqual(config.privacy);
        expect(result.collapsedSections).toEqual(config.collapsedSections);
        expect(result.search).toEqual(config.search);
        expect(result.sections).toEqual(config.sections);
    });

    it("round-trip is idempotent (export → import → export → import produces same result)", () => {
        const config = fullConfig();
        const base = baseConfig();

        // First round-trip
        const exported1 = JSON.stringify(config, null, 2);
        const result1 = msomStorage.mergeConfig(base, JSON.parse(exported1));

        // Second round-trip
        const exported2 = JSON.stringify(result1, null, 2);
        const result2 = msomStorage.mergeConfig(base, JSON.parse(exported2));

        expect(result2).toEqual(result1);
    });

    it("round-trip through save/load preserves data", async () => {
        const config = fullConfig();

        await msomStorage.saveSyncConfig(config);
        const loaded = await msomStorage.loadV2SyncConfig();
        expect(loaded.status).toBe("ok");

        // Re-export and re-import
        const exported = JSON.stringify(loaded.config, null, 2);
        const reimported = JSON.parse(exported);
        const base = baseConfig();
        const result = msomStorage.mergeConfig(base, reimported);

        expect(result.branding).toEqual(config.branding);
        expect(result.links).toEqual(config.links);
        expect(result.quotes).toEqual(config.quotes);
    });
});

describe("quotes-only import mode", () => {
    it("replaces quotes while preserving all other fields", () => {
        const base = baseConfig();
        const quotesPayload = { quotes: ["New quote A", "New quote B"] };
        const result = msomStorage.mergeConfig(base, quotesPayload);

        expect(result.quotes).toEqual(["New quote A", "New quote B"]);
        expect(result.branding).toEqual(base.branding);
        expect(result.links).toEqual(base.links);
        expect(result.backgrounds).toEqual(base.backgrounds);
        expect(result.search).toEqual(base.search);
    });

    it("normalizeQuotesImport → mergeConfig pipeline works with array input", () => {
        const base = baseConfig();
        const normalized = g.normalizeQuotesImport(["One", "Two"]);
        const result = msomStorage.mergeConfig(base, { quotes: normalized });

        expect(result.quotes).toEqual(["One", "Two"]);
        expect(result.branding.title).toBe("Base");
    });

    it("normalizeQuotesImport → mergeConfig pipeline works with string input", () => {
        const base = baseConfig();
        const normalized = g.normalizeQuotesImport("A single quote");
        const result = msomStorage.mergeConfig(base, { quotes: normalized });

        expect(result.quotes).toEqual(["A single quote"]);
    });

    it("normalizeQuotesImport → mergeConfig pipeline works with object input", () => {
        const base = baseConfig();
        const normalized = g.normalizeQuotesImport({ quotes: ["From object"] });
        const result = msomStorage.mergeConfig(base, { quotes: normalized });

        expect(result.quotes).toEqual(["From object"]);
    });

    it("normalizeQuotesImport → mergeConfig pipeline handles empty array", () => {
        const base = baseConfig();
        const normalized = g.normalizeQuotesImport([]);
        const result = msomStorage.mergeConfig(base, { quotes: normalized });

        expect(result.quotes).toEqual([]);
    });
});

describe("links-only import mode", () => {
    it("replaces links while preserving other fields", () => {
        const base = baseConfig();
        const newLinks = [
            { name: "New A", url: "https://new-a.com", section: "Imported" },
            { name: "New B", url: "https://new-b.com", section: "Imported" }
        ];
        const result = msomStorage.mergeConfig(base, { links: newLinks });

        expect(result.links).toEqual(newLinks);
        expect(result.quotes).toEqual(base.quotes);
        expect(result.backgrounds).toEqual(base.backgrounds);
    });

    it("derives sections from imported links when no sections provided", () => {
        const base = baseConfig();
        const newLinks = [
            { name: "A", url: "https://a.com", section: "Alpha" },
            { name: "B", url: "https://b.com", section: "Beta" }
        ];
        const result = msomStorage.mergeConfig(base, { links: newLinks });

        expect(result.sections).toContain("Alpha");
        expect(result.sections).toContain("Beta");
    });

    it("uses explicit sections when provided alongside links", () => {
        const base = baseConfig();
        const result = msomStorage.mergeConfig(base, {
            links: [{ name: "A", url: "https://a.com", section: "Explicit" }],
            sections: ["Explicit", "Other"]
        });

        expect(result.sections).toEqual(["Explicit", "Other"]);
    });
});

describe("search-only import mode", () => {
    it("replaces search config while preserving other fields", () => {
        const base = baseConfig();
        const newSearch = {
            defaultEngine: "bing",
            engines: [{ name: "Bing", urlTemplate: "https://bing.com/search?q=%s" }]
        };
        const result = msomStorage.mergeConfig(base, { search: newSearch });

        expect(result.search).toEqual(newSearch);
        expect(result.links).toEqual(base.links);
        expect(result.quotes).toEqual(base.quotes);
    });
});

describe("mergeConfig edge cases for import", () => {
    it("override with empty arrays replaces (intentional clear)", () => {
        const base = baseConfig();
        const result = msomStorage.mergeConfig(base, {
            quotes: [],
            links: [],
            backgrounds: []
        });

        expect(result.quotes).toEqual([]);
        expect(result.links).toEqual([]);
        expect(result.backgrounds).toEqual([]);
    });

    it("partial branding override preserves unspecified fields", () => {
        const base = baseConfig();
        const result = msomStorage.mergeConfig(base, {
            branding: { title: "New Title" }
        });

        expect(result.branding.title).toBe("New Title");
        expect(result.branding.subtitle).toBe("Original");
        expect(result.branding.quotesTitle).toBe("Quotes");
    });

    it("collapsedSections deduplicates entries", () => {
        const base = baseConfig();
        const result = msomStorage.mergeConfig(base, {
            collapsedSections: ["Work", "Work", "Work"]
        });

        expect(result.collapsedSections).toEqual(["Work"]);
    });

    it("collapsedSections filters out whitespace-only strings", () => {
        const base = baseConfig();
        const result = msomStorage.mergeConfig(base, {
            collapsedSections: ["Valid", "  ", "", "Also Valid"]
        });

        expect(result.collapsedSections).toEqual(["Valid", "Also Valid"]);
    });

    it("layout with non-finite numbers falls back to base values", () => {
        const base = baseConfig();
        const result = msomStorage.mergeConfig(base, {
            layout: { maxColumns: NaN, minCardWidth: Infinity, pageWidth: -Infinity }
        });

        expect(result.layout.maxColumns).toBe(base.layout.maxColumns);
        expect(result.layout.minCardWidth).toBe(base.layout.minCardWidth);
        expect(result.layout.pageWidth).toBe(base.layout.pageWidth);
    });

    it("layout with string numbers falls back to base values", () => {
        const base = baseConfig();
        const result = msomStorage.mergeConfig(base, {
            layout: { maxColumns: "6", minCardWidth: "200" }
        });

        // Number.isFinite("6") is false, so should fall back
        expect(result.layout.maxColumns).toBe(base.layout.maxColumns);
        expect(result.layout.minCardWidth).toBe(base.layout.minCardWidth);
    });

    it("visibility with non-boolean values falls back to base", () => {
        const base = baseConfig();
        const result = msomStorage.mergeConfig(base, {
            visibility: { search: "yes", quotes: 1, links: null }
        });

        expect(result.visibility.search).toBe(base.visibility.search);
        expect(result.visibility.quotes).toBe(base.visibility.quotes);
        expect(result.visibility.links).toBe(base.visibility.links);
    });

    it("mergeConfig with null override returns clone of base", () => {
        const base = baseConfig();
        const result = msomStorage.mergeConfig(base, null);

        expect(result).toEqual(base);
        // Should be a clone, not same reference
        expect(result).not.toBe(base);
    });

    it("mergeConfig with undefined override returns clone of base", () => {
        const base = baseConfig();
        const result = msomStorage.mergeConfig(base, undefined);

        expect(result).toEqual(base);
        expect(result).not.toBe(base);
    });

    it("full config override replaces everything", () => {
        const base = baseConfig();
        const full = fullConfig();
        const result = msomStorage.mergeConfig(base, full);

        expect(result.branding).toEqual(full.branding);
        expect(result.links).toEqual(full.links);
        expect(result.quotes).toEqual(full.quotes);
        expect(result.backgrounds).toEqual(full.backgrounds);
        expect(result.backgroundMode).toBe(full.backgroundMode);
        expect(result.layout).toEqual(full.layout);
        expect(result.search).toEqual(full.search);
    });
});

describe("splitConfig → mergeConfig round-trip (export pipeline)", () => {
    it("splitting and re-merging with local assets reproduces original config", () => {
        const config = fullConfig();
        const { syncConfig, localAssets } = msomStorage.splitConfig(config);

        // applyLocalAssets is what reconstructs the full config from sync + local
        const reconstructed = g.applyLocalAssets(syncConfig, localAssets);

        expect(reconstructed.links.map((l) => l.url)).toEqual(config.links.map((l) => l.url));
        expect(reconstructed.backgrounds).toEqual(config.backgrounds);
    });

    it("splitting config with data-URL backgrounds separates correctly", () => {
        const config = {
            ...fullConfig(),
            backgrounds: ["https://remote.com/bg.jpg", "data:image/png;base64,abc123"]
        };
        const { syncConfig, localAssets } = msomStorage.splitConfig(config);

        // Remote stays in sync, data URL goes to local
        expect(syncConfig.backgrounds).toEqual(["https://remote.com/bg.jpg"]);
        expect(localAssets.backgroundUploads).toEqual(["data:image/png;base64,abc123"]);

        // Re-merge should produce both
        const reconstructed = g.applyLocalAssets(syncConfig, localAssets);
        expect(reconstructed.backgrounds).toContain("https://remote.com/bg.jpg");
        expect(reconstructed.backgrounds).toContain("data:image/png;base64,abc123");
    });
});
