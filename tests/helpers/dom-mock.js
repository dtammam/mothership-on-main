// Minimal DOM element mock for testing rendering functions.
// Tracks parent/child relationships, classList, dataset, style, and attributes.
// Not a full DOM — only properties our rendering code actually uses.

function createMockClassList(element) {
    const classes = new Set();
    return {
        add(...names) {
            names.forEach((n) => classes.add(n));
            element.className = [...classes].join(" ");
        },
        remove(...names) {
            names.forEach((n) => classes.delete(n));
            element.className = [...classes].join(" ");
        },
        toggle(name, force) {
            const shouldAdd = force !== undefined ? force : !classes.has(name);
            if (shouldAdd) {
                classes.add(name);
            } else {
                classes.delete(name);
            }
            element.className = [...classes].join(" ");
            return shouldAdd;
        },
        contains(name) {
            return classes.has(name);
        },
        get length() {
            return classes.size;
        },
        [Symbol.iterator]() {
            return classes[Symbol.iterator]();
        },
        _syncFromClassName(cn) {
            classes.clear();
            if (cn) {
                cn.split(/\s+/)
                    .filter(Boolean)
                    .forEach((n) => classes.add(n));
            }
        }
    };
}

function createMockStyle() {
    const properties = new Map();
    return new Proxy(
        {
            setProperty(name, value) {
                properties.set(name, String(value));
            },
            getPropertyValue(name) {
                return properties.get(name) || "";
            },
            removeProperty(name) {
                const old = properties.get(name) || "";
                properties.delete(name);
                return old;
            },
            _properties: properties
        },
        {
            get(target, prop) {
                if (prop in target) {
                    return target[prop];
                }
                // Camel-case style properties (e.g., backgroundImage)
                return properties.get(prop) || "";
            },
            set(target, prop, value) {
                if (prop.startsWith("_")) {
                    target[prop] = value;
                    return true;
                }
                properties.set(prop, String(value));
                return true;
            }
        }
    );
}

function createMockDataset() {
    const data = {};
    return new Proxy(data, {
        get(target, prop) {
            return target[prop];
        },
        set(target, prop, value) {
            target[prop] = String(value);
            return true;
        }
    });
}

// Creates a mock DOM element with the properties used by our rendering code.
export function createElement(tag) {
    let _innerHTML = "";

    const element = {
        tagName: tag.toUpperCase(),
        className: "",
        textContent: "",
        hidden: false,
        href: "",
        src: "",
        alt: "",
        target: "",
        type: "",
        download: "",
        draggable: false,
        id: "",
        children: [],
        childNodes: [],
        parentNode: null,
        dataset: createMockDataset(),
        style: createMockStyle(),
        attributes: new Map(),

        appendChild(child) {
            child.parentNode = element;
            element.children.push(child);
            element.childNodes.push(child);
            return child;
        },

        removeChild(child) {
            const idx = element.children.indexOf(child);
            if (idx !== -1) {
                element.children.splice(idx, 1);
                element.childNodes.splice(idx, 1);
                child.parentNode = null;
            }
            return child;
        },

        setAttribute(name, value) {
            element.attributes.set(name, String(value));
            if (name === "id") {
                element.id = String(value);
            }
        },

        getAttribute(name) {
            return element.attributes.get(name) ?? null;
        },

        addEventListener() {},

        querySelector() {
            return null;
        },

        querySelectorAll() {
            return [];
        },

        click() {}
    };

    element.classList = createMockClassList(element);

    // Sync classList when className is set directly
    let _className = "";
    Object.defineProperty(element, "className", {
        get() {
            return _className;
        },
        set(value) {
            _className = value;
            element.classList._syncFromClassName(value);
        },
        enumerable: true,
        configurable: true
    });

    // Setting innerHTML = "" clears children (mirrors real DOM behavior)
    Object.defineProperty(element, "innerHTML", {
        get() {
            return _innerHTML;
        },
        set(value) {
            _innerHTML = value;
            if (value === "") {
                element.children.length = 0;
                element.childNodes.length = 0;
            }
        },
        enumerable: true,
        configurable: true
    });

    return element;
}

// Creates an enhanced document mock with element registry for getElementById.
export function createDocumentMock() {
    const registry = new Map();
    const body = createElement("body");
    const documentElement = createElement("html");

    const doc = {
        body,
        documentElement,

        addEventListener() {},

        createElement(tag) {
            return createElement(tag);
        },

        getElementById(id) {
            return registry.get(id) || null;
        },

        querySelector(selector) {
            // Minimal: support #id selectors
            if (selector.startsWith("#")) {
                return registry.get(selector.slice(1)) || null;
            }
            return null;
        },

        querySelectorAll() {
            return [];
        },

        // Test helper: register an element so getElementById can find it.
        _registerElement(id, element) {
            element.id = id;
            registry.set(id, element);
        },

        // Test helper: clear registry between tests.
        _clearRegistry() {
            registry.clear();
        },

        // Test helper: create and register an element in one step.
        _createRegisteredElement(tag, id) {
            const el = createElement(tag);
            el.id = id;
            registry.set(id, el);
            return el;
        }
    };

    return doc;
}
