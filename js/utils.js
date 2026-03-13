// Pure utility functions with no domain knowledge.

function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
}

// Zero-pads chunk index to three digits.
function padChunkIndex(index) {
    return String(index).padStart(3, "0");
}

// Splits a string into slices of maxChars for v2 chunk storage.
function chunkStringBySize(value, maxChars) {
    const chunks = [];
    for (let i = 0; i < value.length; i += maxChars) {
        chunks.push(value.slice(i, i + maxChars));
    }
    return chunks;
}

// Builds v2 chunk keys for the given count/prefix.
function buildV2ChunkKeys(count, prefix = V2_CHUNK_PREFIX) {
    const keys = [];
    for (let i = 0; i < count; i += 1) {
        keys.push(`${prefix}${padChunkIndex(i)}`);
    }
    return keys;
}

// Computes total bytes across all items as key.length + JSON(value).length.
function calculatePayloadBytes(payload) {
    return Object.entries(payload).reduce((total, [key, value]) => {
        return total + key.length + JSON.stringify(value ?? null).length;
    }, 0);
}

function isDataUrl(value) {
    return typeof value === "string" && value.startsWith("data:");
}

function ensureLinkIds(links) {
    return links.map((link) => {
        if (link.id) {
            return link;
        }
        return { ...link, id: createId() };
    });
}

function createId() {
    if (crypto?.randomUUID) {
        return crypto.randomUUID();
    }
    return `link_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function timeAgo(timestamp) {
    const delta = Date.now() - timestamp;
    if (delta < 60000) {
        return "just now";
    }
    const minutes = Math.floor(delta / 60000);
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(list) {
    const array = [...list];
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function boostColor(color, amount) {
    return color.map((channel) => Math.min(255, Math.max(0, Math.round(channel + (255 - channel) * amount))));
}

function safeParseUrl(value) {
    try {
        return new URL(value);
    } catch (_error) {
        return null;
    }
}

function blobToDataUrl(blob) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

function fileToDataUrl(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

function createImageThumbnail(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const maxWidth = 240;
            const maxHeight = 160;
            const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
            const width = Math.round(img.width * ratio);
            const height = Math.round(img.height * ratio);
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                resolve("");
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        img.onerror = () => resolve("");
        img.src = dataUrl;
    });
}
