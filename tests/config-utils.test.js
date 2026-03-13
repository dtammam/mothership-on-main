import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";

const env = loadScript();
const g = env.globals;

beforeEach(() => {
    env.reset();
});

describe("isDataUrl", () => {
    it("returns true for data: URIs", () => {
        expect(g.isDataUrl("data:image/png;base64,abc123")).toBe(true);
        expect(g.isDataUrl("data:text/plain,hello")).toBe(true);
    });

    it("returns false for regular URLs", () => {
        expect(g.isDataUrl("https://example.com/image.png")).toBe(false);
        expect(g.isDataUrl("http://example.com")).toBe(false);
    });

    it("returns false for non-string values", () => {
        expect(g.isDataUrl(null)).toBe(false);
        expect(g.isDataUrl(undefined)).toBe(false);
        expect(g.isDataUrl(123)).toBe(false);
        expect(g.isDataUrl({})).toBe(false);
    });

    it("returns false for empty string", () => {
        expect(g.isDataUrl("")).toBe(false);
    });

    it("is case-sensitive (data: must be lowercase)", () => {
        expect(g.isDataUrl("DATA:image/png;base64,abc")).toBe(false);
        expect(g.isDataUrl("Data:image/png;base64,abc")).toBe(false);
    });
});

describe("ensureLinkIds", () => {
    it("preserves existing IDs", () => {
        const links = [
            { id: "existing-1", name: "A", url: "https://a.com" },
            { id: "existing-2", name: "B", url: "https://b.com" }
        ];
        const result = g.ensureLinkIds(links);
        expect(result[0].id).toBe("existing-1");
        expect(result[1].id).toBe("existing-2");
    });

    it("generates IDs for links without them", () => {
        const links = [
            { name: "A", url: "https://a.com" },
            { name: "B", url: "https://b.com" }
        ];
        const result = g.ensureLinkIds(links);
        expect(result[0].id).toBeTruthy();
        expect(result[1].id).toBeTruthy();
    });

    it("generates unique IDs for each link", () => {
        const links = [
            { name: "A", url: "https://a.com" },
            { name: "B", url: "https://b.com" },
            { name: "C", url: "https://c.com" }
        ];
        const result = g.ensureLinkIds(links);
        const ids = result.map((link) => link.id);
        expect(new Set(ids).size).toBe(3);
    });

    it("does not mutate original links", () => {
        const original = { name: "A", url: "https://a.com" };
        const links = [original];
        g.ensureLinkIds(links);
        expect(original.id).toBeUndefined();
    });

    it("handles empty array", () => {
        expect(g.ensureLinkIds([])).toEqual([]);
    });

    it("preserves other link properties", () => {
        const links = [{ name: "A", url: "https://a.com", section: "Work", iconOverride: "icon.png" }];
        const result = g.ensureLinkIds(links);
        expect(result[0].name).toBe("A");
        expect(result[0].url).toBe("https://a.com");
        expect(result[0].section).toBe("Work");
        expect(result[0].iconOverride).toBe("icon.png");
    });
});

describe("applyLocalAssets", () => {
    it("merges local background uploads into config backgrounds", () => {
        const config = { links: [], backgrounds: ["https://example.com/bg.jpg"] };
        const localAssets = { backgroundUploads: ["data:image/png;base64,local"], linkIcons: {} };
        const result = g.applyLocalAssets(config, localAssets);
        expect(result.backgrounds).toEqual(["https://example.com/bg.jpg", "data:image/png;base64,local"]);
    });

    it("applies local icon overrides to links by ID", () => {
        const config = {
            links: [{ id: "link-1", name: "A", url: "https://a.com", iconOverride: "" }],
            backgrounds: []
        };
        const localAssets = {
            backgroundUploads: [],
            linkIcons: { "link-1": "data:image/png;base64,icon" }
        };
        const result = g.applyLocalAssets(config, localAssets);
        expect(result.links[0].iconOverride).toBe("data:image/png;base64,icon");
    });

    it("clears data URL icon overrides from synced config (they belong in local assets)", () => {
        const config = {
            links: [{ id: "link-1", name: "A", url: "https://a.com", iconOverride: "data:image/png;base64,synced" }],
            backgrounds: []
        };
        const localAssets = { backgroundUploads: [], linkIcons: {} };
        const result = g.applyLocalAssets(config, localAssets);
        // Data URL overrides in sync config are cleared (replaced with empty string)
        // since they should be in local assets, not synced
        expect(result.links[0].iconOverride).toBe("");
    });

    it("preserves non-data-URL icon overrides from synced config", () => {
        const config = {
            links: [{ id: "link-1", name: "A", url: "https://a.com", iconOverride: "https://example.com/icon.png" }],
            backgrounds: []
        };
        const localAssets = { backgroundUploads: [], linkIcons: {} };
        const result = g.applyLocalAssets(config, localAssets);
        expect(result.links[0].iconOverride).toBe("https://example.com/icon.png");
    });

    it("handles null/undefined localAssets gracefully", () => {
        const config = { links: [{ id: "1", name: "A", url: "https://a.com" }], backgrounds: ["bg.jpg"] };
        const result = g.applyLocalAssets(config, null);
        expect(result.backgrounds).toEqual(["bg.jpg"]);
        expect(result.links).toHaveLength(1);
    });

    it("ensures link IDs are present after applying", () => {
        const config = {
            links: [{ name: "No ID", url: "https://example.com" }],
            backgrounds: []
        };
        const result = g.applyLocalAssets(config, {});
        expect(result.links[0].id).toBeTruthy();
    });
});

describe("deriveSections", () => {
    it("extracts unique section names from links", () => {
        const links = [
            { name: "A", section: "Work" },
            { name: "B", section: "Personal" },
            { name: "C", section: "Work" }
        ];
        const result = g.deriveSections(links, []);
        expect(result).toContain("Work");
        expect(result).toContain("Personal");
        expect(result).toHaveLength(2);
    });

    it("preserves order from existingSections first", () => {
        const links = [
            { name: "A", section: "Alpha" },
            { name: "B", section: "Beta" }
        ];
        const result = g.deriveSections(links, ["Beta", "Alpha"]);
        expect(result[0]).toBe("Beta");
        expect(result[1]).toBe("Alpha");
    });

    it("appends new sections from links after existing ones", () => {
        const links = [
            { name: "A", section: "Existing" },
            { name: "B", section: "New" }
        ];
        const result = g.deriveSections(links, ["Existing"]);
        expect(result).toEqual(["Existing", "New"]);
    });

    it("uses default section name for links without section", () => {
        const links = [{ name: "A", url: "https://a.com" }];
        const result = g.deriveSections(links, []);
        // Default section is "Links"
        expect(result).toContain("Links");
    });

    it("deduplicates sections from existingSections", () => {
        const result = g.deriveSections([], ["A", "A", "B", "B"]);
        expect(result).toEqual(["A", "B"]);
    });

    it("handles empty links and empty existing sections", () => {
        const result = g.deriveSections([], []);
        expect(result).toEqual([]);
    });

    it("handles null existingSections", () => {
        const links = [{ name: "A", section: "Work" }];
        const result = g.deriveSections(links, null);
        expect(result).toContain("Work");
    });
});

describe("normalizeQuotesImport", () => {
    it("accepts an array of strings", () => {
        const result = g.normalizeQuotesImport(["Hello", "World"]);
        expect(result).toEqual(["Hello", "World"]);
    });

    it("filters out non-string entries from array", () => {
        const result = g.normalizeQuotesImport(["Valid", 123, null, "Also valid", undefined]);
        expect(result).toEqual(["Valid", "Also valid"]);
    });

    it("trims whitespace from entries", () => {
        const result = g.normalizeQuotesImport(["  hello  ", "  world  "]);
        expect(result).toEqual(["hello", "world"]);
    });

    it("filters out empty/whitespace-only entries", () => {
        const result = g.normalizeQuotesImport(["hello", "", "  ", "world"]);
        expect(result).toEqual(["hello", "world"]);
    });

    it("accepts a newline-separated string", () => {
        const result = g.normalizeQuotesImport("Line one\nLine two\nLine three");
        expect(result).toEqual(["Line one", "Line two", "Line three"]);
    });

    it("handles string with empty lines", () => {
        const result = g.normalizeQuotesImport("First\n\n\nSecond");
        expect(result).toEqual(["First", "Second"]);
    });

    it("accepts an object with quotes array", () => {
        const result = g.normalizeQuotesImport({ quotes: ["Quote A", "Quote B"] });
        expect(result).toEqual(["Quote A", "Quote B"]);
    });

    it("accepts an object with quotes string", () => {
        const result = g.normalizeQuotesImport({ quotes: "Quote A\nQuote B" });
        expect(result).toEqual(["Quote A", "Quote B"]);
    });

    it("returns empty array for unrecognized input", () => {
        expect(g.normalizeQuotesImport(42)).toEqual([]);
        expect(g.normalizeQuotesImport(null)).toEqual([]);
        expect(g.normalizeQuotesImport(undefined)).toEqual([]);
        expect(g.normalizeQuotesImport({})).toEqual([]);
    });

    it("filters non-strings from object quotes array", () => {
        const result = g.normalizeQuotesImport({ quotes: ["Good", 42, "Also good"] });
        expect(result).toEqual(["Good", "Also good"]);
    });
});
