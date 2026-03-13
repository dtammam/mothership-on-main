import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";

const env = loadScript();
const g = env.globals;

beforeEach(() => {
    env.reset();
});

describe("timeAgo", () => {
    it("returns 'just now' for timestamps less than 60 seconds ago", () => {
        const now = Date.now();
        expect(g.timeAgo(now)).toBe("just now");
        expect(g.timeAgo(now - 30000)).toBe("just now");
        // Avoid exact boundary (59999ms) — clock drift between test and function makes it flaky
        expect(g.timeAgo(now - 55000)).toBe("just now");
    });

    it("returns minutes for timestamps 1-59 minutes ago", () => {
        const now = Date.now();
        expect(g.timeAgo(now - 61000)).toBe("1m ago");
        expect(g.timeAgo(now - 5 * 60000)).toBe("5m ago");
        expect(g.timeAgo(now - 59 * 60000)).toBe("59m ago");
    });

    it("returns hours for timestamps 1-23 hours ago", () => {
        const now = Date.now();
        expect(g.timeAgo(now - 60 * 60000)).toBe("1h ago");
        expect(g.timeAgo(now - 12 * 60 * 60000)).toBe("12h ago");
        expect(g.timeAgo(now - 23 * 60 * 60000)).toBe("23h ago");
    });

    it("returns days for timestamps 24+ hours ago", () => {
        const now = Date.now();
        expect(g.timeAgo(now - 24 * 60 * 60000)).toBe("1d ago");
        expect(g.timeAgo(now - 7 * 24 * 60 * 60000)).toBe("7d ago");
        expect(g.timeAgo(now - 30 * 24 * 60 * 60000)).toBe("30d ago");
    });

    it("floors partial time units", () => {
        const now = Date.now();
        // 90 seconds = 1 minute (floor)
        expect(g.timeAgo(now - 90000)).toBe("1m ago");
        // 90 minutes = 1 hour (floor)
        expect(g.timeAgo(now - 90 * 60000)).toBe("1h ago");
    });
});

describe("applyVisibility", () => {
    // applyVisibility manipulates DOM elements via document.getElementById/querySelector.
    // The default sandbox returns null for those, so the function runs without error
    // but we can't observe element state changes with the default mock.
    // We test that it handles various inputs without throwing.

    it("handles undefined visibility without throwing", () => {
        expect(() => g.applyVisibility(undefined)).not.toThrow();
    });

    it("handles null visibility without throwing", () => {
        expect(() => g.applyVisibility(null)).not.toThrow();
    });

    it("handles empty object without throwing", () => {
        expect(() => g.applyVisibility({})).not.toThrow();
    });

    it("handles full visibility config without throwing", () => {
        expect(() => g.applyVisibility({ search: true, quotes: false, links: true })).not.toThrow();
    });

    it("handles partial visibility config without throwing", () => {
        expect(() => g.applyVisibility({ search: false })).not.toThrow();
    });
});
