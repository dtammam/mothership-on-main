import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";

const env = loadScript({ useDomMock: true });
const g = env.globals;
const doc = env.document;

beforeEach(() => {
    env.reset();
    // Reset body classes and styles between tests
    doc.body.classList.remove("background-image");
    doc.body.classList.remove("background-blur");
    doc.body.style.backgroundImage = "";
    doc.body.style.setProperty("--background-image", "none");
});

describe("renderBackground", () => {
    describe("images mode", () => {
        it("adds background-image class and removes background-blur", () => {
            g.renderBackground({
                backgroundMode: "images",
                backgrounds: ["https://example.com/bg.jpg"]
            });
            expect(doc.body.classList.contains("background-image")).toBe(true);
            expect(doc.body.classList.contains("background-blur")).toBe(false);
        });

        it("sets backgroundImage style to the URL of the single background", () => {
            g.renderBackground({
                backgroundMode: "images",
                backgrounds: ["https://example.com/bg.jpg"]
            });
            expect(doc.body.style.backgroundImage).toBe('url("https://example.com/bg.jpg")');
        });

        it("picks one of the provided backgrounds when multiple exist", () => {
            const bgs = ["https://a.com/1.jpg", "https://b.com/2.jpg", "https://c.com/3.jpg"];
            const seen = new Set();
            for (let i = 0; i < 50; i++) {
                g.renderBackground({ backgroundMode: "images", backgrounds: bgs });
                // Extract the URL from the style value
                const match = doc.body.style.backgroundImage.match(/url\("(.+)"\)/);
                if (match) {
                    seen.add(match[1]);
                }
            }
            // Should pick at least 2 different backgrounds over 50 runs
            expect(seen.size).toBeGreaterThanOrEqual(2);
            // All picked should be from the original set
            for (const url of seen) {
                expect(bgs).toContain(url);
            }
        });

        it("sets --background-image CSS var to none in non-blur mode", () => {
            g.renderBackground({
                backgroundMode: "images",
                backgrounds: ["https://example.com/bg.jpg"]
            });
            expect(doc.body.style.getPropertyValue("--background-image")).toBe("none");
        });
    });

    describe("images_blur mode", () => {
        it("adds background-blur class and removes background-image", () => {
            // Pre-set background-image to verify removal
            doc.body.classList.add("background-image");
            g.renderBackground({
                backgroundMode: "images_blur",
                backgrounds: ["https://example.com/bg.jpg"]
            });
            expect(doc.body.classList.contains("background-blur")).toBe(true);
            expect(doc.body.classList.contains("background-image")).toBe(false);
        });

        it("sets --background-image CSS var to the URL", () => {
            g.renderBackground({
                backgroundMode: "images_blur",
                backgrounds: ["https://example.com/blur.jpg"]
            });
            expect(doc.body.style.getPropertyValue("--background-image")).toBe('url("https://example.com/blur.jpg")');
        });

        it("clears inline backgroundImage style in blur mode", () => {
            doc.body.style.backgroundImage = 'url("old.jpg")';
            g.renderBackground({
                backgroundMode: "images_blur",
                backgrounds: ["https://example.com/blur.jpg"]
            });
            expect(doc.body.style.backgroundImage).toBe("");
        });
    });

    describe("gradient modes", () => {
        it("removes both image classes for gradient mode", () => {
            doc.body.classList.add("background-image");
            doc.body.classList.add("background-blur");
            g.renderBackground({
                backgroundMode: "gradient_signature",
                backgrounds: []
            });
            expect(doc.body.classList.contains("background-image")).toBe(false);
            expect(doc.body.classList.contains("background-blur")).toBe(false);
        });

        it("clears backgroundImage style for gradient mode", () => {
            doc.body.style.backgroundImage = 'url("old.jpg")';
            g.renderBackground({
                backgroundMode: "gradient_soda",
                backgrounds: []
            });
            expect(doc.body.style.backgroundImage).toBe("");
        });

        it("sets --background-image to none for gradient mode", () => {
            g.renderBackground({
                backgroundMode: "gradient_dracula",
                backgrounds: []
            });
            expect(doc.body.style.getPropertyValue("--background-image")).toBe("none");
        });

        it("sets aura CSS custom properties for gradient_signature", () => {
            g.renderBackground({
                backgroundMode: "gradient_signature",
                backgrounds: []
            });
            // applySignatureGradient -> setAuraPalette sets --aura-1 through --aura-4
            const rootStyle = doc.documentElement.style;
            expect(rootStyle.getPropertyValue("--aura-1")).toContain("rgba(");
            expect(rootStyle.getPropertyValue("--aura-2")).toContain("rgba(");
            expect(rootStyle.getPropertyValue("--aura-3")).toContain("rgba(");
            expect(rootStyle.getPropertyValue("--aura-4")).toContain("rgba(");
        });

        it("sets aura position CSS properties for gradients", () => {
            g.renderBackground({
                backgroundMode: "gradient_soda",
                backgrounds: []
            });
            const rootStyle = doc.documentElement.style;
            // Position values end with %
            expect(rootStyle.getPropertyValue("--aura-x1")).toMatch(/%$/);
            expect(rootStyle.getPropertyValue("--aura-y1")).toMatch(/%$/);
        });

        it("supports all gradient mode names without throwing", () => {
            const modes = [
                "gradient_signature",
                "gradient_dynamic",
                "gradient_soda",
                "gradient_github_dark",
                "gradient_azure",
                "gradient_dracula",
                "gradient_synthwave",
                "gradient_daylight"
            ];
            for (const mode of modes) {
                expect(() => g.renderBackground({ backgroundMode: mode, backgrounds: [] })).not.toThrow();
            }
        });

        it("falls back to signature gradient for unknown gradient mode", () => {
            g.renderBackground({
                backgroundMode: "gradient_unknown",
                backgrounds: []
            });
            // applyGradientMode falls through to applySignatureGradient for unknown modes
            const rootStyle = doc.documentElement.style;
            expect(rootStyle.getPropertyValue("--aura-1")).toContain("rgba(");
        });
    });

    describe("edge cases", () => {
        it("clears background when backgrounds array is empty in images mode", () => {
            doc.body.style.backgroundImage = 'url("old.jpg")';
            g.renderBackground({
                backgroundMode: "images",
                backgrounds: []
            });
            expect(doc.body.style.backgroundImage).toBe("");
            expect(doc.body.style.getPropertyValue("--background-image")).toBe("none");
        });

        it("clears background when backgrounds array is empty in blur mode", () => {
            g.renderBackground({
                backgroundMode: "images_blur",
                backgrounds: []
            });
            expect(doc.body.style.backgroundImage).toBe("");
            expect(doc.body.style.getPropertyValue("--background-image")).toBe("none");
        });

        it("handles single background in images mode deterministically", () => {
            for (let i = 0; i < 10; i++) {
                g.renderBackground({
                    backgroundMode: "images",
                    backgrounds: ["https://only.one/bg.jpg"]
                });
                expect(doc.body.style.backgroundImage).toBe('url("https://only.one/bg.jpg")');
            }
        });
    });

    describe("error paths", () => {
        it("defaults to images mode when backgroundMode is missing", () => {
            g.renderBackground({ backgrounds: ["https://default.com/bg.jpg"] });
            expect(doc.body.classList.contains("background-image")).toBe(true);
            expect(doc.body.style.backgroundImage).toBe('url("https://default.com/bg.jpg")');
        });

        it("defaults to images mode when backgroundMode is empty string", () => {
            g.renderBackground({
                backgroundMode: "",
                backgrounds: ["https://default.com/bg.jpg"]
            });
            expect(doc.body.classList.contains("background-image")).toBe(true);
        });

        it("throws when backgrounds is undefined in images mode", () => {
            // renderImageBackground calls backgrounds.length — undefined throws
            expect(() => g.renderBackground({ backgroundMode: "images" })).toThrow();
        });

        it("does not throw when backgrounds is undefined in gradient mode", () => {
            // Gradient path doesn't access backgrounds
            expect(() => g.renderBackground({ backgroundMode: "gradient_signature" })).not.toThrow();
        });
    });
});
