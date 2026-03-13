import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";

const env = loadScript();
const { msomStorage } = env;

beforeEach(() => {
    env.reset();
});

describe("mergeConfig — deep edge cases", () => {
    const base = {
        branding: { title: "Base", subtitle: "Sub", quotesTitle: "Quotes" },
        sections: ["Links"],
        links: [],
        quotes: [],
        backgrounds: [],
        backgroundMode: "gradient_signature",
        layout: { resizable: false, maxColumns: 4, minCardWidth: 180, pageWidth: 72 },
        visibility: { search: true, quotes: true, links: true },
        privacy: { autoFetchFavicons: true },
        collapsedSections: [],
        search: { defaultEngine: "google", engines: [] }
    };

    it("derives sections from links when override has links but no sections", () => {
        const override = {
            links: [
                { name: "A", url: "https://a.com", section: "Work" },
                { name: "B", url: "https://b.com", section: "Personal" }
            ]
        };
        const result = msomStorage.mergeConfig(base, override);
        expect(result.sections).toContain("Work");
        expect(result.sections).toContain("Personal");
    });

    it("uses override sections when explicitly provided", () => {
        const override = {
            sections: ["Custom"],
            links: [{ name: "A", url: "https://a.com", section: "Custom" }]
        };
        const result = msomStorage.mergeConfig(base, override);
        expect(result.sections).toEqual(["Custom"]);
    });

    it("handles empty override object gracefully", () => {
        const result = msomStorage.mergeConfig(base, {});
        expect(result.branding.title).toBe("Base");
        expect(result.layout.maxColumns).toBe(4);
        expect(result.backgroundMode).toBe("gradient_signature");
    });

    it("preserves privacy.autoFetchFavicons as boolean", () => {
        const result = msomStorage.mergeConfig(base, { privacy: { autoFetchFavicons: false } });
        expect(result.privacy.autoFetchFavicons).toBe(false);
    });

    it("preserves search engine overrides", () => {
        const engines = [{ name: "DuckDuckGo", urlTemplate: "https://ddg.gg/?q=%s" }];
        const result = msomStorage.mergeConfig(base, { search: { defaultEngine: "duckduckgo", engines } });
        expect(result.search.defaultEngine).toBe("duckduckgo");
        expect(result.search.engines).toEqual(engines);
    });

    it("handles resizable boolean correctly", () => {
        expect(msomStorage.mergeConfig(base, { layout: { resizable: true } }).layout.resizable).toBe(true);
        expect(msomStorage.mergeConfig(base, { layout: { resizable: false } }).layout.resizable).toBe(false);
        expect(msomStorage.mergeConfig(base, { layout: {} }).layout.resizable).toBe(false);
    });
});

describe("splitConfig — edge cases", () => {
    it("handles config with no links or backgrounds", () => {
        const config = { links: [], backgrounds: [] };
        const { syncConfig, localAssets } = msomStorage.splitConfig(config);
        expect(syncConfig.links).toEqual([]);
        expect(syncConfig.backgrounds).toEqual([]);
        expect(localAssets.backgroundUploads).toEqual([]);
        expect(localAssets.linkIcons).toEqual({});
    });

    it("handles mixed data-URL and regular backgrounds", () => {
        const config = {
            links: [],
            backgrounds: [
                "https://example.com/a.jpg",
                "data:image/png;base64,one",
                "https://example.com/b.jpg",
                "data:image/png;base64,two"
            ]
        };
        const { syncConfig, localAssets } = msomStorage.splitConfig(config);
        expect(syncConfig.backgrounds).toEqual(["https://example.com/a.jpg", "https://example.com/b.jpg"]);
        expect(localAssets.backgroundUploads).toEqual(["data:image/png;base64,one", "data:image/png;base64,two"]);
    });

    it("preserves link IDs that already exist", () => {
        const config = {
            links: [{ id: "existing-id", name: "A", url: "https://a.com", section: "Links" }],
            backgrounds: []
        };
        const { syncConfig } = msomStorage.splitConfig(config);
        expect(syncConfig.links[0].id).toBe("existing-id");
    });
});

describe("save/load data integrity", () => {
    it("preserves all config fields through save/load cycle", async () => {
        const config = {
            branding: { title: "Full Test", subtitle: "Every field", quotesTitle: "My Quotes" },
            sections: ["Work", "Personal"],
            links: [
                { name: "Work Link", url: "https://work.com", section: "Work" },
                { name: "Personal Link", url: "https://personal.com", section: "Personal" }
            ],
            quotes: ["Quote one", "Quote two", "Quote three"],
            backgrounds: ["https://example.com/bg1.jpg", "https://example.com/bg2.jpg"],
            backgroundMode: "image",
            layout: { resizable: true, maxColumns: 6, minCardWidth: 200, pageWidth: 80 },
            visibility: { search: false, quotes: true, links: true },
            privacy: { autoFetchFavicons: false },
            collapsedSections: ["Personal"],
            search: {
                defaultEngine: "duckduckgo",
                engines: [{ name: "DuckDuckGo", urlTemplate: "https://ddg.gg/?q=%s" }]
            }
        };

        await msomStorage.saveSyncConfig(config);
        const loaded = await msomStorage.loadV2SyncConfig();

        expect(loaded.status).toBe("ok");
        expect(loaded.config).toEqual(config);
    });

    it("handles empty config save/load", async () => {
        const config = {};
        await msomStorage.saveSyncConfig(config);
        const loaded = await msomStorage.loadV2SyncConfig();
        expect(loaded.status).toBe("ok");
        expect(loaded.config).toEqual({});
    });

    it("overwrites previous save cleanly", async () => {
        const first = { branding: { title: "First" } };
        const second = { branding: { title: "Second" } };

        await msomStorage.saveSyncConfig(first);
        await msomStorage.saveSyncConfig(second);

        const loaded = await msomStorage.loadV2SyncConfig();
        expect(loaded.status).toBe("ok");
        expect(loaded.config.branding.title).toBe("Second");
    });
});
