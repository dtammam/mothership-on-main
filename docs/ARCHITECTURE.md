# Architecture — Mothership on Main

## What this is

Mothership on Main is a Microsoft Edge (Chromium) extension that replaces the new tab and home page with a configurable command center. It provides link cards organized by sections, a multi-engine search bar, rotating quotes, and customizable backgrounds — all controlled through a built-in Customize panel.

The stack is intentionally simple: plain HTML, CSS, and JavaScript. No frameworks, no build tools, no dependencies.

## Runtime model

This is a Manifest V3 Chrome extension with a single surface:

- **New Tab override** (`index.html`) — the only UI entry point. Serves as both the main page and the Customize panel host.
- **No background script / service worker** — all logic runs in the new tab page context.
- **No options page** — configuration is handled inline via the Customize panel.

Primary flows:
1. **Page load:** `index.html` loads → `js/script.js` executes → config read from `chrome.storage.sync` → UI renders with user data.
2. **Config update:** User edits settings in Customize → config saved via v2 chunked storage → UI re-renders.
3. **First run / migration:** If no v2 config exists, checks for legacy single-key config → auto-migrates to v2 chunked format.

## Repo layout

```
mothership-on-main/
├── index.html              # Single-page entry point (new tab override)
├── manifest.json           # MV3 extension manifest
├── config.json             # Default/seed configuration
├── css/
│   └── style.css           # All styles
├── js/
│   └── script.js           # All application logic
├── images/
│   ├── icon.png            # Extension icon
│   ├── icon.ico            # Favicon
│   ├── Default.png         # Screenshot for readme
│   └── Customize.png       # Screenshot for readme
├── scripts/
│   ├── package-edge.ps1    # Release packaging (PowerShell)
│   └── build-release-body.ps1  # Release notes generation
├── tests/
│   ├── storage-harness.html    # Manual storage testing page
│   ├── storage-harness.js      # Storage harness logic
│   └── storage-harness-boot.js # Harness bootstrap
├── docs/                   # System of record (see docs/index.md)
├── .claude/                # Agent harness (hooks, commands, settings)
├── hooks/                  # Git hooks (pre-commit, pre-push)
└── .github/
    └── workflows/
        └── edge-packages.yml   # CI: QA/prod zip packaging + GitHub releases
```

## Data model: configuration

The extension's behavior is driven by a single configuration object. The default shape is defined in `config.json`:

| Field | Type | Purpose |
|-------|------|---------|
| `branding` | object | Title, subtitle, quotes heading |
| `sections` | string[] | Ordered list of link section names |
| `links` | object[] | Links with section, name, url, iconOverride |
| `quotes` | string[] | Rotating quotes shown on page load |
| `backgroundMode` | string | `"gradient_signature"`, `"image"`, etc. |
| `backgrounds` | array | User-uploaded background images (base64) |
| `layout` | object | Column count, card width, page width, resizable flag |
| `visibility` | object | Toggle search, quotes, links sections |
| `privacy` | object | Favicon auto-fetch toggle |
| `collapsedSections` | string[] | Sections collapsed by user |
| `search` | object | Default engine ID + array of engine definitions |

## Storage architecture (v2: chunked config)

User config is stored in `chrome.storage.sync` using a versioned, chunked format to work within Chromium's quota limits.

### Keyspace
All keys are prefixed and versioned:
- `msom:cfg:v2:meta` — `{ version: 2, chunkCount: N, updatedAt: ISO }`
- `msom:cfg:v2:chunk:000` through `msom:cfg:v2:chunk:NNN` — string segments of JSON-serialized config

### Quota constraints
- **Per-item limit:** ~8,192 bytes (key + JSON value). Chunks target 6,500–7,000 bytes.
- **Total sync limit:** ~102,400 bytes. Preflight check before every write.

### Write safety
- Two-phase writes: temp keys (`msom:cfg:v2:tmp:*`) → final keys → cleanup.
- Partial write detection on load with fallback to last known good state.

### Migration
- Legacy single-key (`mothershipSyncConfig`) auto-migrates to v2 on first load.
- Legacy keys retained until v2 write succeeds.
- Migration is idempotent.

## CI / Release pipeline

On merge to `main`, GitHub Actions (`.github/workflows/edge-packages.yml`):
1. Builds two zip packages: `*-qa.zip` (name suffixed with "QA") and `*-prod.zip`.
2. Creates a GitHub Release (`main-<sha>`) with both zips + SHA-256 hashes.
3. On version tags (`v*`), attaches the same artifacts to a versioned release.

Local packaging: `scripts/package-edge.ps1` (PowerShell).

## Key protocols

### Config lifecycle
```
Page load → loadConfig() → [try v2 chunked] → [fallback: legacy key → migrate] → render
User edit → saveConfig() → [preflight quota] → [two-phase write] → success/error feedback
```

### Extension permissions
- `storage` — for `chrome.storage.sync`
- `host_permissions: https://*/* , http://*/*` — for favicon fetching
