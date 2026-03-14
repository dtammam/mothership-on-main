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
        },
        deleteProperty(target, prop) {
            delete target[prop];
            return true;
        }
    });
}

// Walks the element tree, calling visitor(node) on each descendant.
function walkTree(root, visitor) {
    const queue = [...(root.children || [])];
    while (queue.length) {
        const node = queue.shift();
        visitor(node);
        if (node.children) {
            queue.push(...node.children);
        }
    }
}

// Checks whether an element matches a simple CSS selector (single segment).
function matchesSimpleSelector(element, selector) {
    if (!element || !element.tagName) {
        return false;
    }
    // Tag selector
    if (/^[a-zA-Z][\w-]*$/.test(selector)) {
        return element.tagName === selector.toUpperCase();
    }
    // #id selector
    if (selector.startsWith("#")) {
        return element.id === selector.slice(1);
    }
    // .class selector
    if (selector.startsWith(".")) {
        const cls = selector.slice(1);
        return element.classList?.contains(cls) ?? false;
    }
    // [data-attr] or [data-attr="value"] selector
    const attrMatch = selector.match(/^\[([^\]=]+)(?:="([^"]*)")?\]$/);
    if (attrMatch) {
        const attrName = attrMatch[1];
        const attrValue = attrMatch[2];
        // data-* attributes live in dataset
        if (attrName.startsWith("data-")) {
            const dataKey = attrName.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            if (attrValue !== undefined) {
                return element.dataset[dataKey] === attrValue;
            }
            return element.dataset[dataKey] !== undefined;
        }
        // Regular attributes
        if (attrValue !== undefined) {
            return element.getAttribute(attrName) === attrValue;
        }
        return element.attributes?.has(attrName) ?? false;
    }
    return false;
}

// Matches a compound selector like "div.class[data-attr]" or "tag.class".
function matchesCompoundSelector(element, compound) {
    // Split compound into parts: tag, .class, [attr], #id
    const parts = compound.match(/[#.][\w-]+|\[[\w-]+(?:="[^"]*")?\]|^[\w-]+/g);
    if (!parts) {
        return false;
    }
    return parts.every((part) => matchesSimpleSelector(element, part));
}

// Matches a full selector with descendant combinators (space-separated).
function matchesSelector(element, selector) {
    const parts = selector.trim().split(/\s+/);
    if (parts.length === 1) {
        return matchesCompoundSelector(element, parts[0]);
    }
    // For multi-part selectors, the last part must match the element
    if (!matchesCompoundSelector(element, parts[parts.length - 1])) {
        return false;
    }
    // Walk ancestors to find matches for earlier parts
    let partIndex = parts.length - 2;
    let ancestor = element.parentNode;
    while (partIndex >= 0 && ancestor) {
        if (matchesCompoundSelector(ancestor, parts[partIndex])) {
            partIndex -= 1;
        }
        ancestor = ancestor.parentNode;
    }
    return partIndex < 0;
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
        disabled: false,
        checked: false,
        id: "",
        name: "",
        placeholder: "",
        children: [],
        childNodes: [],
        parentNode: null,
        dataset: createMockDataset(),
        style: createMockStyle(),
        attributes: new Map(),

        appendChild(child) {
            // Remove from previous parent if any
            if (child.parentNode) {
                child.parentNode.removeChild(child);
            }
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

        insertBefore(newChild, refChild) {
            if (newChild.parentNode) {
                newChild.parentNode.removeChild(newChild);
            }
            if (!refChild) {
                return element.appendChild(newChild);
            }
            const idx = element.children.indexOf(refChild);
            if (idx === -1) {
                return element.appendChild(newChild);
            }
            newChild.parentNode = element;
            element.children.splice(idx, 0, newChild);
            element.childNodes.splice(idx, 0, newChild);
            return newChild;
        },

        contains(child) {
            if (child === element) {
                return true;
            }
            return element.children.some((c) => c === child || (c.contains && c.contains(child)));
        },

        remove() {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        },

        closest(selector) {
            let current = element;
            while (current) {
                if (matchesCompoundSelector(current, selector)) {
                    return current;
                }
                current = current.parentNode;
            }
            return null;
        },

        setAttribute(name, value) {
            element.attributes.set(name, String(value));
            if (name === "id") {
                element.id = String(value);
            }
            if (name === "aria-label") {
                element._ariaLabel = String(value);
            }
        },

        getAttribute(name) {
            return element.attributes.get(name) ?? null;
        },

        removeAttribute(name) {
            element.attributes.delete(name);
        },

        addEventListener() {},

        querySelector(selector) {
            let found = null;
            walkTree(element, (node) => {
                if (!found && matchesSelector(node, selector)) {
                    found = node;
                }
            });
            return found;
        },

        querySelectorAll(selector) {
            const results = [];
            walkTree(element, (node) => {
                if (matchesSelector(node, selector)) {
                    results.push(node);
                }
            });
            return results;
        },

        // Deep clone of the element and all children.
        cloneNode(deep) {
            const clone = createElement(tag);
            clone.className = element.className;
            clone.textContent = element.textContent;
            clone.hidden = element.hidden;
            clone.href = element.href;
            clone.src = element.src;
            clone.alt = element.alt;
            clone.target = element.target;
            clone.type = element.type;
            clone.download = element.download;
            clone.draggable = element.draggable;
            clone.disabled = element.disabled;
            clone.checked = element.checked;
            clone.id = element.id;
            clone.name = element.name;
            clone.placeholder = element.placeholder;
            // Copy dataset
            const rawDataset = Object.getOwnPropertyNames(element.dataset).length ? element.dataset : {};
            for (const key of Object.keys(rawDataset)) {
                clone.dataset[key] = rawDataset[key];
            }
            // Copy attributes
            for (const [k, v] of element.attributes) {
                clone.attributes.set(k, v);
            }
            // Copy value for form elements
            if (element._value !== undefined) {
                clone.value = element._value;
            }
            if (deep) {
                element.children.forEach((child) => {
                    if (child.cloneNode) {
                        clone.appendChild(child.cloneNode(true));
                    }
                });
            }
            return clone;
        },

        getBoundingClientRect() {
            return element._rect || { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 };
        },

        focus() {},
        blur() {},
        click() {},
        scrollIntoView() {}
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

    // Form element value property — for input, select, textarea
    let _value = "";
    Object.defineProperty(element, "value", {
        get() {
            return _value;
        },
        set(val) {
            _value = String(val);
            element._value = _value;
        },
        enumerable: true,
        configurable: true
    });

    // SELECT elements need an options collection
    if (tag.toUpperCase() === "SELECT") {
        Object.defineProperty(element, "options", {
            get() {
                return element.children.filter((c) => c.tagName === "OPTION");
            },
            enumerable: true,
            configurable: true
        });
    }

    // TEMPLATE elements have a content document fragment
    if (tag.toUpperCase() === "TEMPLATE") {
        const content = createElement("template-content");
        Object.defineProperty(element, "content", {
            get() {
                return {
                    get firstElementChild() {
                        return content.children[0] || null;
                    },
                    get children() {
                        return content.children;
                    },
                    appendChild(child) {
                        return content.appendChild(child);
                    }
                };
            },
            enumerable: true,
            configurable: true
        });
        // Helper to set up the template content tree
        element._setContent = (child) => {
            content.appendChild(child);
        };
    }

    return element;
}

// Builds a template element from a simplified structure definition.
// Each node is { tag, attrs?, dataset?, className?, children?, textContent? }
export function buildTemplate(id, structure) {
    const template = createElement("template");
    template.id = id;

    function buildNode(def) {
        const el = createElement(def.tag || "div");
        if (def.className) {
            el.className = def.className;
        }
        if (def.textContent) {
            el.textContent = def.textContent;
        }
        if (def.type) {
            el.type = def.type;
        }
        if (def.attrs) {
            for (const [k, v] of Object.entries(def.attrs)) {
                el.setAttribute(k, v);
            }
        }
        if (def.dataset) {
            for (const [k, v] of Object.entries(def.dataset)) {
                el.dataset[k] = v;
            }
        }
        if (def.children) {
            def.children.forEach((childDef) => {
                el.appendChild(buildNode(childDef));
            });
        }
        return el;
    }

    template._setContent(buildNode(structure));
    return template;
}

// Creates an enhanced document mock with element registry for getElementById.
export function createDocumentMock() {
    const registry = new Map();
    const body = createElement("body");
    const documentElement = createElement("html");
    // Track all elements added to body for global querySelectorAll
    const allRoots = [body];

    const doc = {
        body,
        documentElement,
        title: "",

        addEventListener() {},

        createElement(tag) {
            return createElement(tag);
        },

        getElementById(id) {
            return registry.get(id) || null;
        },

        querySelector(selector) {
            // Support #id selectors
            if (selector.startsWith("#")) {
                return registry.get(selector.slice(1)) || null;
            }
            // Search through all roots
            for (const root of allRoots) {
                const found = root.querySelector(selector);
                if (found) {
                    return found;
                }
            }
            return null;
        },

        querySelectorAll(selector) {
            const results = [];
            for (const root of allRoots) {
                // Check the root itself
                if (matchesSelector(root, selector)) {
                    results.push(root);
                }
                root.querySelectorAll(selector).forEach((el) => {
                    if (!results.includes(el)) {
                        results.push(el);
                    }
                });
            }
            // Also check all registered elements and their trees
            for (const el of registry.values()) {
                if (matchesSelector(el, selector) && !results.includes(el)) {
                    results.push(el);
                }
                el.querySelectorAll(selector).forEach((child) => {
                    if (!results.includes(child)) {
                        results.push(child);
                    }
                });
            }
            return results;
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
