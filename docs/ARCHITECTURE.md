# ARCHITECTURE.md — Mothership on Main (Edge extension)

## 1) What this is
Mothership on Main is a Microsoft Edge (Chromium) extension that replaces the new tab/home experience with a custom UI. It is intentionally simple: plain HTML, CSS, and JavaScript.

This document focuses on the current architecture and the storage-quota fix branch.

## 2) Runtime model (high level)
Typical extension surfaces involved (confirm in `manifest.json`):
- New Tab override page (UI)
- Options / Settings page (UI for configuration)
- Background script / Service Worker (optional, depending on MV2/MV3)

Primary flows:
1. **Startup**: UI loads → reads config → renders
2. **User config update**: user edits settings → config saved → UI re-renders

## 3) Data model: configuration
The extension has a configuration object (schema defined in code) that controls UI behavior. Historically, this config was saved as a single item in `chrome.storage.sync`, which fails when the serialized config exceeds the per-item limit.

Chromium sync limits:
- Approximately **100KB total** for `storage.sync`
- Approximately **8KB per item** :contentReference[oaicite:3]{index=3}
- Per-item size is measured by JSON stringification of value plus key length :contentReference[oaicite:4]{index=4}

### Problem
When config grows beyond ~8KB, `chrome.storage.sync.set()` fails with:
- `QUOTA_BYTES_PER_ITEM quota exceeded`

Result: users cannot save larger configs; state appears to “not stick”.

## 4) Storage architecture (v2: chunked config)

### Goals
- Allow configs up to the practical maximum of sync storage (~100KB total)
- Avoid breaking existing users
- Prevent partial-write corruption
- Keep implementation small and dependency-free

### Keyspace
All keys are prefixed and versioned:

- `msom:cfg:v2:meta`
- `msom:cfg:v2:chunk:000`
- `msom:cfg:v2:chunk:001`
- …

Meta example:
```json
{
  "version": 2,
  "chunkCount": 4,
  "updatedAt": "2026-02-03T00:00:00.000Z"
}
