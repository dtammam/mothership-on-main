# Testing

This project is a simple, self-contained web extension. No formal test runner yet; manual flows plus a storage harness cover current needs.

## Manual UI checklist
- Load as unpacked in Edge/Chrome; open a new tab and confirm render.
- Search: submit a query; verify it opens correctly.
- Links: click a link; rearrange sections/links via Rearrange; Finish.
- Customize: add a link, category, and search engine; reorder links inside Customize.
- Import/export: export config, re-import; import quotes and confirm replacement.
- Backgrounds: switch gradient/image/blur; upload an image and see Uploaded images selected.

## Storage harness (quota/migration/debug)
- Open directly (not in manifest): `chrome-extension://<EXT_ID>/tests/storage-harness.html`
- Default backend: **simulator** (enforces 8KB per item, ~100KB total). Toggle to real sync only when desired.
- Controls:
  - Save & load small / target size (with size estimator).
  - Import + save & load (uses v2 chunking).
  - Import + auto-shrink to fit (trims backgrounds → quotes → links until under quota).
  - Write legacy single key → migrate (seed v1 key and auto-migrate to v2).
  - Export current sync state (v2 + legacy keys).
  - Auto-clear storage before save (cleans v2 + legacy keys).
- Estimate card shows config bytes, chunk count, largest item vs 8KB, total vs 100KB, headroom.
- Simulator fault injection: `msomStorage.setSimulatorEnabled(true, () => "fail")` in console to force errors and verify two-phase safety.

## Stability notes
- Harness lives in `tests/` and is not referenced by the manifest; users won’t hit it unless they navigate by URL.
- Sync headroom badge in settings shows approximate usage and free space; turns amber/red near limit.
- Legacy configs auto-migrate to v2 on first load; legacy keys stay until a successful v2 write.

## Future
- Add unit/integration tests as scope grows; current focus is manual + harness coverage.
