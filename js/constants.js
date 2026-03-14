// Storage keys, limits, defaults, and fallback configuration.

// Legacy storage keys (pre-v2)
const SYNC_KEY = "mothershipSyncConfig"; // single item
const SYNC_CORE_KEY = "mothershipSyncCore"; // v1 core object
const SYNC_INDEX_KEY = "mothershipSyncIndex"; // v1 chunk index
const SYNC_LINKS_PREFIX = "mothershipSyncLinksChunk"; // v1 links chunks
const SYNC_QUOTES_PREFIX = "mothershipSyncQuotesChunk"; // v1 quotes chunks
const SYNC_BACKGROUNDS_PREFIX = "mothershipSyncBackgroundsChunk"; // v1 background chunks
const SYNC_TEST_KEY = "mothershipSyncQuotaTest";
const LOCAL_ASSETS_KEY = "mothershipLocalAssets";
const LEGACY_KEY = "mothershipConfig";
const SYNC_META_KEY = "mothershipSyncMeta";
const FAVICON_CACHE_KEY = "mothershipFaviconCache";
const BACKGROUND_THUMBS_KEY = "mothershipBackgroundThumbs";
const DEFAULT_LINK_SECTION = "Links";
const NEW_SECTION_OPTION = "__new__";
// V2 sync format (string-chunked, versioned)
const SYNC_CHUNK_CHAR_TARGET = 6800; // keep value chunk small so key+value stays under 8KB
const SYNC_TOTAL_QUOTA_BYTES = 100 * 1024; // documented total sync quota (~100KB)
const SYNC_PER_ITEM_LIMIT = 8192; // per-item quota (key + JSON(value))
const SYNC_VERSION = 2;
const V2_META_KEY = "msom:cfg:v2:meta";
const V2_CHUNK_PREFIX = "msom:cfg:v2:chunk:";
const V2_TMP_META_KEY = "msom:cfg:v2:tmp:meta";
const V2_TMP_CHUNK_PREFIX = "msom:cfg:v2:tmp:chunk:";

const fallbackConfig = {
    branding: {
        title: "Mothership on Main",
        subtitle: "Your favorite bookmark replacement tool",
        quotesTitle: "Quotes"
    },
    sections: [DEFAULT_LINK_SECTION],
    links: [],
    quotes: [],
    backgrounds: [],
    backgroundMode: "gradient_signature",
    layout: { resizable: false, maxColumns: 4, minCardWidth: 180, pageWidth: 72 },
    visibility: { search: true, quotes: true, links: true },
    privacy: { autoFetchFavicons: true },
    collapsedSections: [],
    hiddenSections: [],
    search: { defaultEngine: "google", engines: [] }
};
