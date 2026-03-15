// E2E tests for the Mothership on Main Chrome extension.
// Loads the extension as unpacked and tests the new-tab page.

const { test, expect, chromium } = require("@playwright/test");
const path = require("path");

const extensionPath = path.resolve(__dirname, "../..");

// Launches a persistent browser context with the extension loaded.
// This extension has no background/service worker — it only overrides the
// new-tab page, so we navigate to chrome://newtab to trigger it.
async function launchExtension() {
    const context = await chromium.launchPersistentContext("", {
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            "--no-first-run",
            "--disable-default-apps"
        ]
    });

    const page = await context.newPage();
    await page.goto("chrome://newtab");
    await page.waitForLoadState("domcontentloaded");
    // Wait for the extension's init to complete (removes the loading class).
    await page.waitForFunction(() => !document.body.classList.contains("loading"), null, {
        timeout: 10000
    });

    // Dismiss the "What's New" dialog if it appeared (shows on fresh installs).
    const overlay = page.locator(".whats-new-overlay");
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.locator(".whats-new-got-it").click();
        await overlay.waitFor({ state: "detached", timeout: 2000 });
    }

    return { context, page };
}

test.describe("Extension loads", () => {
    let context;
    let page;

    test.beforeAll(async () => {
        const ext = await launchExtension();
        context = ext.context;
        page = ext.page;
    });

    test.afterAll(async () => {
        await context?.close();
    });

    test("renders the main page with title", async () => {
        const title = page.locator("#title");
        await expect(title).toBeVisible();
        await expect(title).toHaveText("Mothership on Main");
    });

    test("renders the subtitle", async () => {
        const subtitle = page.locator("#subtitle");
        await expect(subtitle).toBeVisible();
    });

    test("renders the search form", async () => {
        const form = page.locator("#search-form");
        await expect(form).toBeVisible();
    });

    test("renders the search engine select with options", async () => {
        const select = page.locator("#search-engine");
        await expect(select).toBeVisible();
        const optionCount = await select.locator("option").count();
        expect(optionCount).toBeGreaterThan(0);
    });

    test("renders default link sections", async () => {
        const sections = page.locator("#sections-container .section");
        const count = await sections.count();
        expect(count).toBeGreaterThan(0);
    });

    test("body does not have loading class (FOUC prevention)", async () => {
        const hasLoading = await page.locator("body").evaluate((el) => el.classList.contains("loading"));
        expect(hasLoading).toBe(false);
    });

    test("quotes section is visible", async () => {
        const quotes = page.locator("#quotes-title");
        await expect(quotes).toBeVisible();
    });
});

test.describe("Settings panel", () => {
    let context;
    let page;

    test.beforeAll(async () => {
        const ext = await launchExtension();
        context = ext.context;
        page = ext.page;
    });

    test.afterAll(async () => {
        await context?.close();
    });

    test("opens when Customize button is clicked", async () => {
        const panel = page.locator("#settings-panel");
        await expect(panel).toHaveAttribute("aria-hidden", "true");

        await page.locator("#settings-toggle").click();
        await page.waitForTimeout(300);

        await expect(panel).toHaveClass(/open/);
    });

    test("displays branding inputs", async () => {
        const titleInput = page.locator("#branding-title");
        await expect(titleInput).toBeVisible();
        await expect(titleInput).toHaveValue("Mothership on Main");
    });

    test("displays import mode with bookmarks option", async () => {
        const select = page.locator("#import-config-mode");
        await expect(select).toBeVisible();
        const bookmarkOption = select.locator('option[value="bookmarks"]');
        await expect(bookmarkOption).toHaveText("Import Chromium bookmarks");
    });

    test("closes when Cancel button is clicked", async () => {
        await page.locator("#settings-cancel-bottom").click();
        await page.waitForTimeout(300);

        const panel = page.locator("#settings-panel");
        await expect(panel).not.toHaveClass(/open/);
    });
});

test.describe("Section interactions", () => {
    let context;
    let page;

    test.beforeAll(async () => {
        const ext = await launchExtension();
        context = ext.context;
        page = ext.page;
    });

    test.afterAll(async () => {
        await context?.close();
    });

    test("collapse button is visible without rearrange mode", async () => {
        const collapseBtn = page.locator(".section-collapse").first();
        await expect(collapseBtn).toBeVisible();
        await expect(collapseBtn).toHaveText("Collapse");
    });

    test("collapse button hides links grid when clicked", async () => {
        const section = page.locator(".section").first();
        const grid = section.locator(".links-grid");
        await expect(grid).toBeVisible();

        // Collapse button has pointer-events:none outside rearrange mode;
        // dispatchEvent bypasses CSS pointer-events entirely.
        await section.locator(".section-collapse").dispatchEvent("click");
        await page.waitForTimeout(500);

        const updatedSection = page.locator(".section").first();
        const updatedGrid = updatedSection.locator(".links-grid");
        await expect(updatedGrid).not.toBeVisible();
    });

    test("expand button shows links grid when clicked", async () => {
        const section = page.locator(".section").first();
        const expandBtn = section.locator(".section-collapse");
        await expect(expandBtn).toHaveText("Expand");

        await expandBtn.dispatchEvent("click");
        await page.waitForTimeout(500);

        const updatedSection = page.locator(".section").first();
        const updatedGrid = updatedSection.locator(".links-grid");
        await expect(updatedGrid).toBeVisible();
    });

    test("open-all button is visible", async () => {
        const openAll = page.locator(".section-open-all").first();
        await expect(openAll).toBeVisible();
        await expect(openAll).toHaveText("Open all");
    });
});

test.describe("Version label", () => {
    let context;
    let page;

    test.beforeAll(async () => {
        const ext = await launchExtension();
        context = ext.context;
        page = ext.page;
    });

    test.afterAll(async () => {
        await context?.close();
    });

    test("shows version in settings footer", async () => {
        // Open settings to see the footer
        await page.locator("#settings-toggle").click();
        await page.waitForTimeout(300);

        const label = page.locator("#version-label");
        await expect(label).toBeVisible();
        await expect(label).toContainText("Mothership on Main v");
    });
});
