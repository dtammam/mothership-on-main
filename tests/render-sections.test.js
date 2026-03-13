import { describe, it, expect, beforeEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";

const env = loadScript({ useDomMock: true });
const g = env.globals;
const doc = env.document;

beforeEach(() => {
    env.reset();
    // renderSections always needs sections-container
    doc._createRegisteredElement("div", "sections-container");
});

// Helper: find children by className within a mock element tree
function findByClass(root, className) {
    const results = [];
    const queue = [root];
    while (queue.length) {
        const node = queue.shift();
        if (node.className && node.className.split(/\s+/).includes(className)) {
            results.push(node);
        }
        if (node.children) {
            queue.push(...node.children);
        }
    }
    return results;
}

// Helper: find first child by className
function findOneByClass(root, className) {
    return findByClass(root, className)[0] || null;
}

function makeConfig(overrides = {}) {
    return {
        links: [],
        sections: [],
        collapsedSections: [],
        ...overrides
    };
}

describe("renderSections", () => {
    describe("happy path", () => {
        it("clears the container on each render", () => {
            const container = doc.getElementById("sections-container");
            // Render with links, then render empty — container should be cleared
            g.renderSections(
                makeConfig({
                    links: [{ url: "https://a.com", name: "A", section: "Links" }]
                })
            );
            expect(container.children.length).toBeGreaterThan(0);

            g.renderSections(makeConfig({ links: [] }));
            expect(container.children.length).toBe(0);
        });

        it("creates a section div with header and links-grid for a single section", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [{ url: "https://example.com", name: "Example", section: "Favorites" }]
                })
            );

            expect(container.children.length).toBe(1);
            const sectionEl = container.children[0];
            expect(sectionEl.className).toContain("section");
            expect(sectionEl.dataset.section).toBe("Favorites");

            // Header with h2
            const header = findOneByClass(sectionEl, "section-header");
            expect(header).not.toBeNull();
            const heading = header.children.find((c) => c.tagName === "H2");
            expect(heading.textContent).toBe("Favorites");

            // Links grid
            const grid = findOneByClass(sectionEl, "links-grid");
            expect(grid).not.toBeNull();
            expect(grid.children.length).toBe(1);
        });

        it("creates link cards with correct href, label, and data-link-id", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [{ id: "link-1", url: "https://example.com", name: "Example", section: "Links" }]
                })
            );

            const grid = findOneByClass(container, "links-grid");
            const card = grid.children[0];
            expect(card.tagName).toBe("A");
            expect(card.className).toContain("link-card");
            expect(card.href).toBe("https://example.com");
            expect(card.target).toBe("_self");
            expect(card.dataset.linkId).toBe("link-1");

            // Icon and label children
            const icon = card.children.find((c) => c.tagName === "IMG");
            expect(icon).toBeDefined();
            expect(icon.alt).toBe("");

            const label = card.children.find((c) => c.tagName === "SPAN");
            expect(label.textContent).toBe("Example");
        });

        it("creates multiple section divs in correct order", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [
                        { url: "https://a.com", name: "A", section: "Work" },
                        { url: "https://b.com", name: "B", section: "Personal" },
                        { url: "https://c.com", name: "C", section: "Work" }
                    ],
                    sections: ["Work", "Personal"]
                })
            );

            expect(container.children.length).toBe(2);
            expect(container.children[0].dataset.section).toBe("Work");
            expect(container.children[1].dataset.section).toBe("Personal");

            // Work section has 2 links, Personal has 1
            const workGrid = findOneByClass(container.children[0], "links-grid");
            expect(workGrid.children.length).toBe(2);
            const personalGrid = findOneByClass(container.children[1], "links-grid");
            expect(personalGrid.children.length).toBe(1);
        });

        it("respects section order from config.sections", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [
                        { url: "https://a.com", name: "A", section: "Alpha" },
                        { url: "https://b.com", name: "B", section: "Beta" }
                    ],
                    sections: ["Beta", "Alpha"]
                })
            );

            expect(container.children[0].dataset.section).toBe("Beta");
            expect(container.children[1].dataset.section).toBe("Alpha");
        });

        it("includes collapse button and drag handle in each section header", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [{ url: "https://a.com", name: "A", section: "Links" }]
                })
            );

            const sectionEl = container.children[0];
            const actions = findOneByClass(sectionEl, "section-header-actions");
            expect(actions).not.toBeNull();

            const collapseBtn = findOneByClass(actions, "section-collapse");
            expect(collapseBtn).not.toBeNull();
            expect(collapseBtn.type).toBe("button");
            expect(collapseBtn.dataset.action).toBe("toggle-section-collapse");

            const handle = findOneByClass(actions, "section-handle");
            expect(handle).not.toBeNull();
            expect(handle.type).toBe("button");
        });
    });

    describe("edge cases", () => {
        it("creates no section divs when links array is empty", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(makeConfig({ links: [] }));
            expect(container.children.length).toBe(0);
        });

        it("defaults links without section to 'Links'", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [{ url: "https://no-section.com", name: "No Section" }]
                })
            );

            expect(container.children.length).toBe(1);
            expect(container.children[0].dataset.section).toBe("Links");
        });

        it("marks collapsed sections with is-collapsed class and data-collapsed='true'", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [
                        { url: "https://a.com", name: "A", section: "Open" },
                        { url: "https://b.com", name: "B", section: "Closed" }
                    ],
                    sections: ["Open", "Closed"],
                    collapsedSections: ["Closed"]
                })
            );

            const openSection = container.children[0];
            expect(openSection.dataset.collapsed).toBe("false");
            expect(openSection.classList.contains("is-collapsed")).toBe(false);

            const closedSection = container.children[1];
            expect(closedSection.dataset.collapsed).toBe("true");
            expect(closedSection.classList.contains("is-collapsed")).toBe(true);
        });

        it("shows 'Expand' button text for collapsed sections, 'Collapse' for open", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [
                        { url: "https://a.com", name: "A", section: "Open" },
                        { url: "https://b.com", name: "B", section: "Closed" }
                    ],
                    sections: ["Open", "Closed"],
                    collapsedSections: ["Closed"]
                })
            );

            const openBtn = findOneByClass(container.children[0], "section-collapse");
            expect(openBtn.textContent).toBe("Collapse");

            const closedBtn = findOneByClass(container.children[1], "section-collapse");
            expect(closedBtn.textContent).toBe("Expand");
        });

        it("uses URL as label when link has no name", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [{ url: "https://unnamed.com", section: "Links" }]
                })
            );

            const grid = findOneByClass(container, "links-grid");
            const label = grid.children[0].children.find((c) => c.tagName === "SPAN");
            expect(label.textContent).toBe("https://unnamed.com");
        });

        it("assigns IDs to links that are missing them", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [{ url: "https://no-id.com", name: "No ID", section: "Links" }]
                })
            );

            const grid = findOneByClass(container, "links-grid");
            const card = grid.children[0];
            // ensureLinkIds should have assigned an ID
            expect(card.dataset.linkId).toBeDefined();
            expect(card.dataset.linkId.length).toBeGreaterThan(0);
        });

        it("groups multiple links in the same section into one grid", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [
                        { url: "https://a.com", name: "A", section: "Tools" },
                        { url: "https://b.com", name: "B", section: "Tools" },
                        { url: "https://c.com", name: "C", section: "Tools" }
                    ]
                })
            );

            expect(container.children.length).toBe(1);
            const grid = findOneByClass(container, "links-grid");
            expect(grid.children.length).toBe(3);
        });

        it("skips sections that have no links even if listed in config.sections", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [{ url: "https://a.com", name: "A", section: "HasLinks" }],
                    sections: ["EmptySection", "HasLinks"]
                })
            );

            // Only HasLinks should render (EmptySection has no links)
            expect(container.children.length).toBe(1);
            expect(container.children[0].dataset.section).toBe("HasLinks");
        });

        it("handles collapsedSections as non-array gracefully", () => {
            const container = doc.getElementById("sections-container");
            // collapsedSections as string instead of array
            g.renderSections(
                makeConfig({
                    links: [{ url: "https://a.com", name: "A", section: "Links" }],
                    collapsedSections: "not-an-array"
                })
            );

            // Should render without error, section should not be collapsed
            expect(container.children.length).toBe(1);
            expect(container.children[0].dataset.collapsed).toBe("false");
        });
    });

    describe("error paths", () => {
        it("throws when links is undefined (no defensive guard in renderSections)", () => {
            // renderSections passes links to deriveSections which calls .forEach —
            // undefined.forEach throws. This documents current behavior.
            expect(() => g.renderSections({ sections: [], collapsedSections: [] })).toThrow();
        });

        it("handles config with undefined sections by deriving from links", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections({
                links: [{ url: "https://a.com", name: "A", section: "Derived" }],
                collapsedSections: []
            });

            expect(container.children.length).toBe(1);
            expect(container.children[0].dataset.section).toBe("Derived");
        });

        it("sets default icon src to images/icon.png for each link card", () => {
            const container = doc.getElementById("sections-container");
            g.renderSections(
                makeConfig({
                    links: [{ url: "https://a.com", name: "A", section: "Links" }]
                })
            );

            const grid = findOneByClass(container, "links-grid");
            const icon = grid.children[0].children.find((c) => c.tagName === "IMG");
            expect(icon.src).toBe("images/icon.png");
        });
    });
});
