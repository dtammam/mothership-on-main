// Playwright E2E configuration for the Mothership on Main extension.
// Loads the extension as unpacked in Chromium and tests the new-tab page.
// Requires a display server (Xvfb in CI, native display locally).
// Chrome extensions cannot run in true headless mode.

const { defineConfig } = require("@playwright/test");
const path = require("path");

const extensionPath = path.resolve(__dirname);

module.exports = defineConfig({
    testDir: "./tests/e2e",
    timeout: 30000,
    retries: 0,
    reporter: "list",
    use: {
        browserName: "chromium",
        headless: false,
        launchOptions: {
            args: [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`,
                "--no-first-run",
                "--disable-default-apps"
            ]
        }
    },
    projects: [
        {
            name: "chromium-extension",
            use: { browserName: "chromium" }
        }
    ]
});
