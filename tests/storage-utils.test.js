import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";

const env = loadScript();
const g = env.globals;

beforeEach(() => {
    env.reset();
});

describe("hashString", () => {
    it("returns a string", () => {
        expect(typeof g.hashString("hello")).toBe("string");
    });

    it("is deterministic — same input produces same output", () => {
        expect(g.hashString("test")).toBe(g.hashString("test"));
    });

    it("produces different hashes for different inputs", () => {
        expect(g.hashString("abc")).not.toBe(g.hashString("def"));
    });

    it("handles empty string", () => {
        const result = g.hashString("");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });

    it("handles unicode characters", () => {
        const result = g.hashString("日本語テスト🎉");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });

    it("handles long strings", () => {
        const long = "a".repeat(10000);
        const result = g.hashString(long);
        expect(typeof result).toBe("string");
    });
});

describe("padChunkIndex", () => {
    it("pads single digit to three characters", () => {
        expect(g.padChunkIndex(0)).toBe("000");
        expect(g.padChunkIndex(5)).toBe("005");
        expect(g.padChunkIndex(9)).toBe("009");
    });

    it("pads double digit to three characters", () => {
        expect(g.padChunkIndex(10)).toBe("010");
        expect(g.padChunkIndex(42)).toBe("042");
        expect(g.padChunkIndex(99)).toBe("099");
    });

    it("does not pad triple digit", () => {
        expect(g.padChunkIndex(100)).toBe("100");
        expect(g.padChunkIndex(999)).toBe("999");
    });
});

describe("chunkStringBySize", () => {
    it("splits a string into chunks of the given size", () => {
        const result = g.chunkStringBySize("abcdefghij", 3);
        expect(result).toEqual(["abc", "def", "ghi", "j"]);
    });

    it("returns single chunk when string fits", () => {
        const result = g.chunkStringBySize("abc", 10);
        expect(result).toEqual(["abc"]);
    });

    it("returns empty array for empty string", () => {
        const result = g.chunkStringBySize("", 5);
        expect(result).toEqual([]);
    });

    it("handles chunk size of 1", () => {
        const result = g.chunkStringBySize("abc", 1);
        expect(result).toEqual(["a", "b", "c"]);
    });

    it("handles exact multiple of chunk size", () => {
        const result = g.chunkStringBySize("abcdef", 3);
        expect(result).toEqual(["abc", "def"]);
    });
});

describe("buildV2ChunkKeys", () => {
    it("builds correct number of keys with default prefix", () => {
        const result = g.buildV2ChunkKeys(3);
        expect(result).toHaveLength(3);
    });

    it("uses zero-padded indices", () => {
        const result = g.buildV2ChunkKeys(2);
        expect(result[0]).toMatch(/000$/);
        expect(result[1]).toMatch(/001$/);
    });

    it("uses custom prefix when provided", () => {
        const result = g.buildV2ChunkKeys(2, "custom:");
        expect(result[0]).toBe("custom:000");
        expect(result[1]).toBe("custom:001");
    });

    it("returns empty array for count 0", () => {
        expect(g.buildV2ChunkKeys(0)).toEqual([]);
    });
});

describe("calculatePayloadBytes", () => {
    it("counts key length plus JSON-serialized value length", () => {
        const payload = { key: "value" };
        // "key".length (3) + '"value"'.length (7) = 10
        expect(g.calculatePayloadBytes(payload)).toBe(10);
    });

    it("handles multiple entries", () => {
        const payload = { a: 1, bb: 2 };
        // "a".length(1) + "1".length(1) + "bb".length(2) + "2".length(1) = 5
        expect(g.calculatePayloadBytes(payload)).toBe(5);
    });

    it("handles null values", () => {
        const payload = { key: null };
        // "key".length(3) + "null".length(4) = 7
        expect(g.calculatePayloadBytes(payload)).toBe(7);
    });

    it("handles undefined values (serialized as null)", () => {
        const payload = { key: undefined };
        // "key".length(3) + "null".length(4) = 7
        expect(g.calculatePayloadBytes(payload)).toBe(7);
    });

    it("returns 0 for empty payload", () => {
        expect(g.calculatePayloadBytes({})).toBe(0);
    });

    it("handles nested objects", () => {
        const payload = { k: { nested: true } };
        const expected = "k".length + JSON.stringify({ nested: true }).length;
        expect(g.calculatePayloadBytes(payload)).toBe(expected);
    });
});

describe("collectChunks", () => {
    it("collects arrays from chunks by prefix and count", () => {
        const chunks = {
            links_0: ["a", "b"],
            links_1: ["c"],
            links_2: ["d", "e"]
        };
        const result = g.collectChunks(chunks, "links", 3);
        expect(result).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("returns empty array when count is 0", () => {
        expect(g.collectChunks({}, "prefix", 0)).toEqual([]);
    });

    it("returns empty array when count is undefined", () => {
        expect(g.collectChunks({}, "prefix", undefined)).toEqual([]);
    });

    it("skips missing chunks gracefully", () => {
        const chunks = {
            data_0: ["a"],
            // data_1 is missing
            data_2: ["c"]
        };
        const result = g.collectChunks(chunks, "data", 3);
        expect(result).toEqual(["a", "c"]);
    });

    it("skips non-array values", () => {
        const chunks = {
            x_0: ["ok"],
            x_1: "not an array",
            x_2: ["also ok"]
        };
        const result = g.collectChunks(chunks, "x", 3);
        expect(result).toEqual(["ok", "also ok"]);
    });
});

describe("estimateSyncUsage", () => {
    it("returns an object with configBytes, chunkCount, maxItemBytes, totalBytes", () => {
        const result = g.estimateSyncUsage({ branding: { title: "Test" } });
        expect(result).toHaveProperty("configBytes");
        expect(result).toHaveProperty("chunkCount");
        expect(result).toHaveProperty("maxItemBytes");
        expect(result).toHaveProperty("totalBytes");
    });

    it("returns small values for a minimal config", () => {
        const result = g.estimateSyncUsage({ links: [] });
        expect(result.configBytes).toBeGreaterThan(0);
        expect(result.totalBytes).toBeGreaterThan(result.configBytes);
        expect(result.chunkCount).toBeGreaterThanOrEqual(1);
    });

    it("handles null/undefined config", () => {
        const result = g.estimateSyncUsage(null);
        expect(result.configBytes).toBe(2); // "{}"
        expect(result.chunkCount).toBe(1);
    });

    it("increases totalBytes for larger configs", () => {
        const small = g.estimateSyncUsage({ title: "hi" });
        const large = g.estimateSyncUsage({
            links: Array.from({ length: 50 }, (_, i) => ({
                name: `Link ${i}`,
                url: `https://example.com/${i}`,
                section: "Links"
            }))
        });
        expect(large.totalBytes).toBeGreaterThan(small.totalBytes);
    });

    it("produces multiple chunks for very large configs", () => {
        const huge = g.estimateSyncUsage({
            quotes: Array.from({ length: 500 }, (_, i) => `Quote number ${i} with some extra text to make it longer`)
        });
        expect(huge.chunkCount).toBeGreaterThan(1);
    });
});

describe("preflightV2Payload", () => {
    it("returns ok for a small payload", () => {
        const payload = { key: "small value" };
        const result = g.preflightV2Payload(payload);
        expect(result.ok).toBe(true);
        expect(result.totalBytes).toBeGreaterThan(0);
    });

    it("rejects payload with per-item exceeding 8192 bytes", () => {
        const bigValue = "x".repeat(8200);
        const payload = { k: bigValue };
        const result = g.preflightV2Payload(payload);
        expect(result.ok).toBe(false);
        expect(result.error).toContain("PER_ITEM");
    });

    it("rejects payload exceeding total quota (100KB)", () => {
        // Create many items that individually fit but together exceed 100KB
        const payload = {};
        for (let i = 0; i < 20; i++) {
            payload[`key_${i}`] = "x".repeat(7000);
        }
        const result = g.preflightV2Payload(payload);
        expect(result.ok).toBe(false);
        expect(result.error).toContain("QUOTA_BYTES");
    });

    it("returns totalBytes on success", () => {
        const payload = { a: "hello", b: "world" };
        const result = g.preflightV2Payload(payload);
        expect(result.ok).toBe(true);
        expect(typeof result.totalBytes).toBe("number");
    });

    it("handles empty payload", () => {
        const result = g.preflightV2Payload({});
        expect(result.ok).toBe(true);
        expect(result.totalBytes).toBe(0);
    });
});
