import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";

const env = loadScript();
const { msomStorage, storageMock } = env;

beforeEach(() => {
    env.reset();
});

describe("msomStorage API surface", () => {
    it("exposes expected methods", () => {
        expect(typeof msomStorage.loadConfig).toBe("function");
        expect(typeof msomStorage.loadV2SyncConfig).toBe("function");
        expect(typeof msomStorage.saveSyncConfig).toBe("function");
        expect(typeof msomStorage.splitConfig).toBe("function");
        expect(typeof msomStorage.mergeConfig).toBe("function");
        expect(typeof msomStorage.mergeLocalAssets).toBe("function");
        expect(typeof msomStorage.getConfigSizeBytes).toBe("function");
        expect(typeof msomStorage.clearSyncStorage).toBe("function");
        expect(typeof msomStorage.setSimulatorEnabled).toBe("function");
    });
});

describe("getConfigSizeBytes", () => {
    it("returns JSON string length for a config object", () => {
        const config = { branding: { title: "Test" }, links: [] };
        const size = msomStorage.getConfigSizeBytes(config);
        expect(size).toBe(JSON.stringify(config).length);
    });

    it("returns 2 for null/undefined (empty JSON object)", () => {
        expect(msomStorage.getConfigSizeBytes(null)).toBe(2);
        expect(msomStorage.getConfigSizeBytes(undefined)).toBe(2);
    });
});

describe("mergeConfig", () => {
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

    it("returns deep clone of base when override is null", () => {
        const result = msomStorage.mergeConfig(base, null);
        expect(result).toEqual(base);
        expect(result).not.toBe(base);
    });

    it("overrides branding fields", () => {
        const override = { branding: { title: "Custom" } };
        const result = msomStorage.mergeConfig(base, override);
        expect(result.branding.title).toBe("Custom");
        expect(result.branding.subtitle).toBe("Sub");
    });

    it("overrides arrays completely", () => {
        const override = { links: [{ name: "A", url: "https://a.com", section: "Links" }] };
        const result = msomStorage.mergeConfig(base, override);
        expect(result.links).toHaveLength(1);
        expect(result.links[0].name).toBe("A");
    });

    it("preserves base layout when override has no layout", () => {
        const result = msomStorage.mergeConfig(base, {});
        expect(result.layout.maxColumns).toBe(4);
    });

    it("merges layout overrides", () => {
        const override = { layout: { maxColumns: 6 } };
        const result = msomStorage.mergeConfig(base, override);
        expect(result.layout.maxColumns).toBe(6);
        expect(result.layout.minCardWidth).toBe(180);
    });

    it("handles visibility boolean overrides", () => {
        const override = { visibility: { search: false } };
        const result = msomStorage.mergeConfig(base, override);
        expect(result.visibility.search).toBe(false);
        expect(result.visibility.quotes).toBe(true);
    });

    it("deduplicates collapsedSections", () => {
        const override = { collapsedSections: ["A", "A", "B"] };
        const result = msomStorage.mergeConfig(base, override);
        expect(result.collapsedSections).toEqual(["A", "B"]);
    });

    it("filters empty string and non-string collapsed sections", () => {
        const override = { collapsedSections: ["A", "", null, 123, "B"] };
        const result = msomStorage.mergeConfig(base, override);
        expect(result.collapsedSections).toEqual(["A", "B"]);
    });
});

describe("splitConfig", () => {
    it("separates data URLs from sync config", () => {
        const config = {
            links: [{ name: "A", url: "https://a.com", section: "Links", iconOverride: "data:image/png;base64,abc" }],
            backgrounds: ["https://example.com/bg.jpg", "data:image/jpeg;base64,xyz"],
            branding: { title: "T", subtitle: "S", quotesTitle: "Q" }
        };
        const { syncConfig, localAssets } = msomStorage.splitConfig(config);

        // data URL backgrounds are extracted
        expect(syncConfig.backgrounds).toEqual(["https://example.com/bg.jpg"]);
        expect(localAssets.backgroundUploads).toEqual(["data:image/jpeg;base64,xyz"]);

        // data URL icon overrides are extracted
        expect(syncConfig.links[0].iconOverride).toBe("");
        expect(Object.values(localAssets.linkIcons)).toContain("data:image/png;base64,abc");
    });

    it("preserves non-data-URL icon overrides in sync config", () => {
        const config = {
            links: [
                { name: "A", url: "https://a.com", section: "Links", iconOverride: "https://example.com/icon.png" }
            ],
            backgrounds: []
        };
        const { syncConfig } = msomStorage.splitConfig(config);
        expect(syncConfig.links[0].iconOverride).toBe("https://example.com/icon.png");
    });

    it("assigns IDs to links that lack them", () => {
        const config = {
            links: [{ name: "A", url: "https://a.com", section: "Links" }],
            backgrounds: []
        };
        const { syncConfig } = msomStorage.splitConfig(config);
        expect(syncConfig.links[0].id).toBeTruthy();
    });
});

describe("mergeLocalAssets", () => {
    it("combines background uploads and link icons", () => {
        const base = { backgroundUploads: ["a"], linkIcons: { x: "1" } };
        const incoming = { backgroundUploads: ["b"], linkIcons: { y: "2" } };
        const result = msomStorage.mergeLocalAssets(base, incoming);
        expect(result.backgroundUploads).toEqual(["a", "b"]);
        expect(result.linkIcons).toEqual({ x: "1", y: "2" });
    });

    it("handles empty/undefined inputs", () => {
        const result = msomStorage.mergeLocalAssets(undefined, undefined);
        expect(result.backgroundUploads).toEqual([]);
        expect(result.linkIcons).toEqual({});
    });
});

describe("save and load round-trip (v2)", () => {
    it("saves and loads a small config", async () => {
        const config = {
            branding: { title: "Test", subtitle: "Sub", quotesTitle: "Q" },
            sections: ["Links"],
            links: [{ name: "A", url: "https://a.com", section: "Links" }],
            quotes: ["Hello world"],
            backgrounds: [],
            backgroundMode: "gradient_signature",
            layout: { resizable: false, maxColumns: 4, minCardWidth: 180, pageWidth: 72 },
            visibility: { search: true, quotes: true, links: true },
            privacy: { autoFetchFavicons: true },
            collapsedSections: [],
            search: { defaultEngine: "google", engines: [] }
        };

        const saveResult = await msomStorage.saveSyncConfig(config);
        expect(saveResult.ok).toBe(true);
        expect(saveResult.meta).toBeDefined();
        expect(saveResult.meta.chunkCount).toBeGreaterThan(0);

        const loadResult = await msomStorage.loadV2SyncConfig();
        expect(loadResult.status).toBe("ok");
        expect(loadResult.config).toEqual(config);
    });

    it("round-trips a config near quota limit", async () => {
        // Build a config large enough to require multiple chunks
        const links = [];
        for (let i = 0; i < 200; i++) {
            links.push({
                name: `Link ${i}`,
                url: `https://example.com/page/${i}?q=${"x".repeat(60)}`,
                section: "Links"
            });
        }
        const config = {
            branding: { title: "Big", subtitle: "S", quotesTitle: "Q" },
            sections: ["Links"],
            links,
            quotes: Array.from({ length: 50 }, (_, i) => `Quote ${i} ${"z".repeat(40)}`),
            backgrounds: Array.from({ length: 10 }, (_, i) => `https://example.com/bg/${i}.jpg`),
            backgroundMode: "gradient_signature",
            layout: { resizable: false, maxColumns: 4, minCardWidth: 180, pageWidth: 72 },
            visibility: { search: true, quotes: true, links: true },
            privacy: { autoFetchFavicons: true },
            collapsedSections: [],
            search: { defaultEngine: "google", engines: [] }
        };

        const saveResult = await msomStorage.saveSyncConfig(config);
        expect(saveResult.ok).toBe(true);
        expect(saveResult.meta.chunkCount).toBeGreaterThan(1);

        const loadResult = await msomStorage.loadV2SyncConfig();
        expect(loadResult.status).toBe("ok");
        expect(loadResult.config).toEqual(config);
    });
});

describe("loadV2SyncConfig edge cases", () => {
    it("returns 'missing' when no data exists", async () => {
        const result = await msomStorage.loadV2SyncConfig();
        expect(result.status).toBe("missing");
    });

    it("returns 'corrupt' for invalid meta", async () => {
        // Directly inject bad meta via the chrome mock
        storageMock.chrome.storage.sync.set({ "msom:cfg:v2:meta": { version: 999, chunkCount: 1 } }, () => {});
        const result = await msomStorage.loadV2SyncConfig();
        expect(result.status).toBe("corrupt");
        expect(result.reason).toBe("invalid meta");
    });

    it("returns 'corrupt' when a chunk is missing", async () => {
        // Save a valid config first
        const config = { branding: { title: "T" } };
        await msomStorage.saveSyncConfig(config);

        // Delete a chunk
        storageMock.chrome.storage.sync.remove("msom:cfg:v2:chunk:000", () => {});

        const result = await msomStorage.loadV2SyncConfig();
        expect(result.status).toBe("corrupt");
        expect(result.reason).toMatch(/missing chunk/);
    });

    it("returns 'corrupt' on checksum mismatch", async () => {
        const config = { branding: { title: "T" } };
        await msomStorage.saveSyncConfig(config);

        // Tamper with chunk data
        storageMock.chrome.storage.sync.set({ "msom:cfg:v2:chunk:000": "corrupted data" }, () => {});

        const result = await msomStorage.loadV2SyncConfig();
        expect(result.status).toBe("corrupt");
    });
});

describe("clearSyncStorage", () => {
    it("removes all v2 keys", async () => {
        const config = { branding: { title: "T" }, links: [], backgrounds: [] };
        await msomStorage.saveSyncConfig(config);

        const before = await msomStorage.loadV2SyncConfig();
        expect(before.status).toBe("ok");

        await msomStorage.clearSyncStorage();

        const after = await msomStorage.loadV2SyncConfig();
        expect(after.status).toBe("missing");
    });
});
