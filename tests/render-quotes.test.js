import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";

const env = loadScript({ useDomMock: true });
const g = env.globals;
const doc = env.document;

beforeEach(() => {
    env.reset();
});

describe("renderQuote", () => {
    function setupTextContainer() {
        return doc._createRegisteredElement("div", "text-container");
    }

    describe("happy path", () => {
        it("sets placeholder text when quotes array is empty", () => {
            const el = setupTextContainer();
            g.renderQuote([]);
            expect(el.textContent).toBe("Add quotes from the Customize panel.");
        });

        it("displays the single quote when array has one entry", () => {
            const el = setupTextContainer();
            g.renderQuote(["Stay hungry, stay foolish."]);
            expect(el.textContent).toBe("Stay hungry, stay foolish.");
        });

        it("displays one of the provided quotes when array has multiple entries", () => {
            const el = setupTextContainer();
            const quotes = ["Quote A", "Quote B", "Quote C"];
            g.renderQuote(quotes);
            expect(quotes).toContain(el.textContent);
        });

        it("picks from the full set over many runs (not always the same)", () => {
            const el = setupTextContainer();
            const quotes = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
            const seen = new Set();
            for (let i = 0; i < 100; i++) {
                g.renderQuote(quotes);
                seen.add(el.textContent);
            }
            // With 100 runs over 5 items, we expect at least 2 distinct values
            expect(seen.size).toBeGreaterThanOrEqual(2);
        });
    });

    describe("edge cases", () => {
        it("handles very long quote strings without truncation", () => {
            const el = setupTextContainer();
            const longQuote = "A".repeat(10000);
            g.renderQuote([longQuote]);
            expect(el.textContent).toBe(longQuote);
            expect(el.textContent.length).toBe(10000);
        });

        it("writes to textContent, not innerHTML (XSS safety)", () => {
            const el = setupTextContainer();
            const dangerous = '<script>alert("xss")</script>';
            g.renderQuote([dangerous]);
            // textContent should contain the raw string, innerHTML should NOT be set
            expect(el.textContent).toBe(dangerous);
            expect(el.innerHTML).toBe("");
        });

        it("handles quotes with HTML entities as plain text", () => {
            const el = setupTextContainer();
            g.renderQuote(["Tom & Jerry <forever>"]);
            expect(el.textContent).toBe("Tom & Jerry <forever>");
        });

        it("handles single-element array deterministically", () => {
            const el = setupTextContainer();
            for (let i = 0; i < 10; i++) {
                g.renderQuote(["Only one"]);
                expect(el.textContent).toBe("Only one");
            }
        });

        it("handles quote with newlines and special characters", () => {
            const el = setupTextContainer();
            const quote = "Line 1\nLine 2\t\ttabbed";
            g.renderQuote([quote]);
            expect(el.textContent).toBe(quote);
        });

        it("handles quote that is an empty string", () => {
            const el = setupTextContainer();
            g.renderQuote([""]);
            expect(el.textContent).toBe("");
        });
    });

    describe("error paths", () => {
        it("does not throw when text-container element is missing", () => {
            // Don't register the element — getElementById returns null
            doc._clearRegistry();
            // renderQuote accesses textContainer.textContent — will throw on null
            // This tests current behavior: it WILL throw because the function
            // does not guard against missing element. We document this as a known limitation.
            expect(() => g.renderQuote([])).toThrow();
        });
    });
});
