# AGENTS.md — Mothership on Main (Edge extension)

## Purpose
You are working in a production Microsoft Edge (Chromium) extension. The goal of this branch is to fix config saving failures caused by `chrome.storage.sync` limits (notably `QUOTA_BYTES_PER_ITEM`), by storing the config as multiple smaller chunks while preserving backwards compatibility.

Key constraints:
- Keep the stack: **HTML + CSS + JavaScript only** (no build tooling introduced in this branch).
- Avoid breaking existing users’ configs.
- Keep changes minimal, readable, and well-tested (manual + lightweight automated where possible).
- Prefer deterministic behavior over cleverness.

## Non-negotiables
1. **Do not change the extension’s UX or default behaviors** unless the change is required for the quota fix.
2. **No new frameworks**. No bundlers. No TypeScript. No dependency chain.
3. **Backward compatible migration**:
   - If legacy single-key config exists, load it, then migrate to chunked format.
   - If chunked format exists, load it.
   - If both exist, prefer chunked.
4. **Failure must be explicit**:
   - Any storage write failure must surface a clear error state (console + UI if there is a settings page).
   - Never silently “pretend saved”.

## Chromium sync storage quota reality (design around it)
- `chrome.storage.sync` is limited to ~100KB total and 8KB per item. :contentReference[oaicite:1]{index=1}
- Per-item size is measured by JSON stringification of the *value* plus the key length. :contentReference[oaicite:2]{index=2}
- Therefore chunking must keep (key + JSON.stringify(value)).length under the per-item ceiling with margin.

## First step (required)
Before making changes:
1. Identify where config is defined (schema/shape) and where it is saved/loaded.
2. Locate all `chrome.storage.*` usage.
3. Identify the current storage key(s) used for config.
4. Confirm whether the extension is MV2 or MV3 (manifest version), and where scripts run (new tab page, options page, background/service worker).

Document your findings in the PR description:
- Files touched and why
- Storage keys (old + new)
- Migration behavior

## Branch goal: Chunked sync config
Implement a small storage module (single file if possible) that provides:

### Public API
- `loadConfig(): Promise<ConfigObject>`
- `saveConfig(config: ConfigObject): Promise<void>`
- `getConfigSizeBytes(config: ConfigObject): number` (approx; used for warnings)
- `migrateIfNeeded(): Promise<void>` (idempotent)

### Storage format (proposed)
Use a versioned namespace so we can evolve later:

- `msom:cfg:v2:meta` → `{ version: 2, chunkCount: N, updatedAt: ISO, checksum?: string }`
- `msom:cfg:v2:chunk:000` → string chunk
- `msom:cfg:v2:chunk:001` → string chunk
- ...
- Optional: `msom:cfg:v2:legacyBackup` (short-lived, removable later)

Rules:
- Chunk payload is a plain string segment of the JSON stringified config.
- Chunk size target: ~6500–7000 chars to leave margin for key+JSON overhead.
- `saveConfig` writes all chunks + meta, then (optionally) deletes legacy key after success.
- Writes should be “two-phase” to avoid partial corruption:
  1) Write new chunks under a temporary prefix `msom:cfg:v2:tmp:*`
  2) Write temp meta
  3) Swap: copy/move to final keys (or write final keys then delete temp)
  4) Cleanup temp keys
  If a true atomic swap is too heavy, ensure load logic can detect incomplete saves and fall back to last good.

### Backwards compatibility
- Legacy key: detect it (whatever the repo currently uses).
- On load: if chunked missing but legacy exists, load legacy, then call `saveConfig` (migrate).
- Keep migration idempotent and safe.

### Edge cases
- Storage writes can fail with:
  - `QUOTA_BYTES_PER_ITEM` (per-item)
  - `QUOTA_BYTES` (total)
- If the config exceeds total sync quota, explicitly warn and fail gracefully. Consider (optional future) fallback to `storage.local`, but do not add that behavior without a clear product decision.

## Testing requirements (minimum)
Add a small test harness page or dev-only function to validate:
1. Save/load roundtrip for small config
2. Roundtrip for config near per-item threshold
3. Roundtrip for config near total threshold (~100KB)
4. Migration from legacy single-key to chunked
5. Corruption handling: missing chunk, wrong chunkCount, etc.

If no automated test runner exists, add a minimal `test.html` or `debug.html` that can be opened in the extension context and prints results.

## Coding style
- Keep functions small, pure where possible.
- Avoid global state. Centralize storage keys/constants.
- Add comments explaining quota margins and why chunk sizing is conservative.
- Prefer async/await.

## What to do when uncertain
Stop guessing. Inspect the repo to confirm:
- actual keys
- config shape
- entry points (newtab/options/background)
Then proceed with the smallest change that solves the quota bug.
