// Loads js/script.js into a sandboxed context with mock globals.
// Returns the window.msomStorage API and other exposed globals for testing.

import { readFileSync } from "fs";
import { resolve } from "path";
import vm from "vm";
import { createChromeStorageMock } from "./chrome-storage-mock.js";
import { createDocumentMock } from "./dom-mock.js";

// Load module files in dependency order (concatenated for VM sandbox)
const jsDir = resolve(import.meta.dirname, "../../js");
const moduleFiles = ["constants.js", "script.js"];
const scriptSource = moduleFiles.map((f) => readFileSync(resolve(jsDir, f), "utf-8")).join("\n");

export function loadScript(options = {}) {
    const storageMock = createChromeStorageMock();

    // Minimal localStorage mock
    const localStorageData = new Map();
    const localStorageMock = {
        getItem(key) {
            return localStorageData.get(key) ?? null;
        },
        setItem(key, value) {
            localStorageData.set(key, String(value));
        },
        removeItem(key) {
            localStorageData.delete(key);
        },
        clear() {
            localStorageData.clear();
        },
        get length() {
            return localStorageData.size;
        },
        key(index) {
            return [...localStorageData.keys()][index] ?? null;
        }
    };

    // Use enhanced DOM mock when requested, otherwise use minimal mock
    const documentMock = options.useDomMock
        ? createDocumentMock()
        : {
              addEventListener() {},
              getElementById() {
                  return null;
              },
              querySelector() {
                  return null;
              },
              querySelectorAll() {
                  return [];
              },
              createElement(tag) {
                  return { tagName: tag, style: {}, addEventListener() {} };
              }
          };

    const sandbox = {
        window: {},
        document: documentMock,
        console,
        localStorage: localStorageMock,
        chrome: storageMock.chrome,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        structuredClone,
        JSON,
        Promise,
        Array,
        Object,
        String,
        Number,
        Math,
        Date,
        Error,
        Map,
        Set,
        RegExp,
        Symbol,
        Blob: globalThis.Blob,
        URL: globalThis.URL,
        crypto: globalThis.crypto,
        fetch: options.fetch || (() => Promise.reject(new Error("fetch not available in test"))),
        Image: class MockImage {
            set src(_v) {}
            set onload(_v) {}
            set onerror(_v) {}
        },
        Boolean,
        __MSOM_DISABLE_UI__: true
    };

    // Make window self-referential
    sandbox.window = sandbox;
    sandbox.window.__MSOM_DISABLE_UI__ = true;

    const context = vm.createContext(sandbox);
    vm.runInContext(scriptSource, context);

    return {
        msomStorage: sandbox.window.msomStorage,
        mothershipDebug: sandbox.window.mothershipDebug,
        globals: sandbox,
        document: documentMock,
        storageMock,
        localStorage: localStorageMock,
        reset() {
            storageMock.reset();
            localStorageData.clear();
            if (documentMock._clearRegistry) {
                documentMock._clearRegistry();
            }
        }
    };
}
