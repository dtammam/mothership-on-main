# Execution Plan: Feature Batch

**Created:** 2026-03-14
**Status:** Implementation complete — pending review

## Goal

Ship 7 features and fixes across the extension: Chromium bookmark import, proper CI hooks + Playwright E2E, open-all-links-in-section, expand/collapse without rearrange mode, section-select-stays-visible bug fix, true section hiding, and version/build label.

## Non-goals

- Changing the storage format or chunked v2 architecture.
- CSS split (tech debt #6) — deferred.
- Redesigning the Customize panel layout.
- Supporting non-Chromium bookmark formats (Firefox, Safari, etc.).

## Constraints

- No new frameworks, bundlers, or TypeScript (CLAUDE.md non-negotiable).
- Config data fidelity — no mutation or loss of existing user data. Any data model additions must be additive only with backwards-compatible defaults.
- Performance budgets (< 200ms FMP, 0 FOUC, 0 CLS) must hold.
- Playwright is a dev dependency only — not shipped in the extension.
- Every feature needs unit tests; Playwright E2E where appropriate.

## Current state

- 267 tests across 15 files, all passing. All 8 domains graded A.
- Config data model: `config.json` defines the shape. Key fields: `sections`, `links`, `collapsedSections`, `visibility`.
- Collapse/expand buttons exist in the DOM but are **only active in rearrange mode** (`customize.js:610` guards with `if (!isRearranging) { return; }`; CSS `.section-collapse` has `pointer-events: none`, overridden only by `.rearrange-mode`).
- No "hide" concept exists — the collapse behavior hides the grid via `display: none` on `.is-collapsed .links-grid`, but the section header remains visible.
- No `hiddenSections` field in the data model.
- Import exists for the app's own JSON format with mode selector (all/quotes/search/links). No Chromium bookmark JSON support.
- CI already runs lint + format + unit tests in the `quality-gate` job. Local hooks run the same subset. No E2E tests.
- No version/build label in the UI.
- manifest.json `name` field differs between prod ("Mothership on Main") and QA ("Mothership on Main QA") builds — this is the build indicator.

## Proposed approach

### Phase 1: Foundation — data model + bug fixes (no dependencies, safe to ship first)

**1a. Section select stays visible when adding a link (bug fix)**

The bug is in the link-row template's section `<select>` and `handleLinkSectionSelection()`. When a user selects a section, the `moveLinkRowToSection()` call moves the row to a different section list in the DOM, which causes the section picker to disappear from view (the row scrolls away or re-renders). Fix: after `moveLinkRowToSection()`, scroll the row back into view and ensure the select remains populated and visible.

Files touched: `js/customize.js`
Test: unit test in `tests/customize-editors.test.js` — verify row's section select is still populated and row is in the correct section list after selection.

**1b. Data model: add `hiddenSections` field**

Add `hiddenSections: []` (string array) to:

- `config.json` (default config)
- `js/constants.js` (`fallbackConfig`)
- `js/config.js` (`mergeConfig` — additive, defaults to `[]` if absent)

This is a backwards-compatible addition. Existing configs without `hiddenSections` get an empty array on load.

Files touched: `config.json`, `js/constants.js`, `js/config.js`
Test: unit test in `tests/config-utils.test.js` — verify mergeConfig preserves/defaults hiddenSections.

**1c. Version and build label**

Read `name` and `version` from `manifest.json` via `fetch("manifest.json")` (available in extension context) and render a small label in the settings panel footer (`<div class="footer-credit">`). Format: `"{name} v{version}"`. Since the QA build has a different `name` in its manifest, this naturally indicates which build is running.

Alternative: hardcode the version in JS. Rejected — reading manifest.json is more maintainable and already works in the extension context.

Files touched: `js/init.js` (fetch manifest + set label), `index.html` (add `id` to credit div or a new `<span>`), `css/style.css` (minor styling)
Test: unit test — verify label element gets populated. Playwright E2E — verify label is visible on page load.

### Phase 2: UI features — collapse/expand + hide (data model dependency on Phase 1b)

**2a. Expand/collapse sections without rearrange mode**

Currently gated by `if (!isRearranging) { return; }` in the click handler (`customize.js:610`) and CSS `pointer-events: none` on `.section-collapse`. Changes:

1. Remove the `isRearranging` guard from the `toggle-section-collapse` click handler — allow it to fire in both normal and rearrange modes.
2. CSS: give `.section-collapse` `pointer-events: auto` and `opacity: 1` by default (remove the `.rearrange-mode` override that currently enables it).
3. The button already persists collapsed state via `toggleSectionCollapsed()` → `persistActiveConfig()`, so no storage changes needed.

Files touched: `js/customize.js`, `css/style.css`
Test: unit test — verify `toggleSectionCollapsed` works without rearrange mode. Playwright E2E — click collapse button on main page, verify grid hides.

**2b. Hide section = actually hide**

Add a "Hide" button next to the existing "Collapse" button in each section header. When clicked:

1. Add the section name to `hiddenSections` in config.
2. Re-render — `renderSections()` skips sections whose names are in `hiddenSections`.
3. In the Customize panel, hidden sections are still visible and editable. Add an "Unhide" action in the links editor so users can restore hidden sections.

Implementation:

- `render.js` `renderSections()`: filter out sections in `hiddenSections` before rendering.
- `render.js`: add "Hide" button to section header actions (next to Collapse).
- `customize.js`: add `toggleSectionHidden()` — mirrors `toggleSectionCollapsed()` pattern.
- `customize.js` links editor: show a "Hidden" badge and "Unhide" button for sections in `hiddenSections`.

Files touched: `js/render.js`, `js/customize.js`, `css/style.css`
Test: unit test — verify renderSections skips hidden sections, verify toggleSectionHidden adds/removes from array. Playwright E2E — hide section, verify it disappears; unhide, verify it returns.

### Phase 3: Chromium bookmark import (independent, no dependencies on other phases)

**Safety model — config data fidelity is non-negotiable**

Bookmark import is the highest-risk feature in this batch because it introduces potentially large, user-controlled external data into the config. The entire flow must be designed so that **a failed or oversized import cannot corrupt, truncate, or displace existing user data**. The existing config is sacred — import is additive only, and the user must see exactly what will happen before anything is written.

Key constraint: `chrome.storage.sync` has a hard ~100KB total quota (`SYNC_TOTAL_QUOTA_BYTES`), shared across the entire config (links, quotes, backgrounds, search engines, branding, layout, visibility, privacy — everything). A user who already has 50KB of config can only absorb ~50KB of new bookmarks. The quota is not per-feature — it's a single shared pool.

The safety sequence:

1. **Parse** — Convert the Chromium JSON into candidate links/sections. This is a pure function with no side effects. If parsing fails, stop and show an error. Nothing is written.
2. **Merge (dry run)** — Combine the candidate data with the user's existing config in memory. Deduplicate by URL against links already in the config, not just within the import. This produces a projected config object.
3. **Quota preflight** — Run the projected config through `estimateV2SyncPayload()` (existing function in `storage.js`) to get the exact byte cost. Compare against `SYNC_TOTAL_QUOTA_BYTES`. This is the real gate — not a heuristic, not a link count, but the actual serialized size that would be written to storage.
4. **User confirmation with full transparency** — Show the user:
    - How many new links will be added (after dedup)
    - How many new sections will be created
    - Current storage usage: {X}KB of 100KB
    - Projected storage usage after import: {Y}KB of 100KB
    - If over quota: "This import would exceed storage capacity. Remove {Z}KB of data or reduce the import." **Block the import — do not allow it to proceed.**
    - If under quota but > 80%: warning that they're approaching the limit
5. **Write** — Only after confirmation, call the existing `saveV2SyncConfig()` which has its own built-in quota preflight as a second safety net. If this fails, the two-phase write (temp → final) in `saveV2SyncConfig` ensures the previous config is not corrupted.

**What this means concretely:** Even if there's a bug in step 3's estimate, step 5's built-in preflight catches it. Even if step 5's preflight somehow passes but the actual `chrome.storage.sync.set` rejects, the two-phase write means the old config is still intact. Defense in depth — no single failure can lose data.

**3a. Bookmark JSON parser**

Chromium bookmark export format is a JSON file with a `roots` object containing `bookmark_bar`, `other`, and `synced` trees. Each node has `type` ("folder" or "url"), `name`, `url` (for urls), and `children` (for folders).

Create a pure function `parseChromiumBookmarks(json)` in `js/config.js` that:

1. Validates the input has `roots` with expected structure. Returns `{ ok: false, error }` on invalid input.
2. Walks the tree recursively, mapping folders to sections and URLs to links.
3. Handles nested folders: top-level folders become sections, nested URLs get flattened into the parent section.
4. Deduplicates links by URL within each section.
5. Truncates names > 100 chars. Skips entries with empty URLs.
6. Returns `{ ok: true, sections: string[], links: LinkObject[] }` compatible with mergeConfig.

This function has **no side effects** — it does not touch config, storage, or DOM.

Files touched: `js/config.js`
Test: comprehensive unit tests in `tests/config-utils.test.js` — valid Chromium JSON, nested folders, duplicates, empty folders, malformed input, entries with empty/missing URLs, very long names, large files (1000+ bookmarks).

**3b. Quota-aware merge function**

Create `previewBookmarkImport(existingConfig, parsedBookmarks)` in `js/config.js` that:

1. Merges parsed bookmarks into a copy of the existing config (never mutates the original).
2. Deduplicates against existing links by URL — if a URL already exists in any section, skip it.
3. Calls `estimateV2SyncPayload()` on the projected config to get exact byte cost.
4. Returns `{ projectedConfig, stats }` where stats includes:
    - `newLinks`: count of links that would actually be added (post-dedup)
    - `newSections`: count of new sections created
    - `currentBytes`: current config serialized size
    - `projectedBytes`: projected config serialized size
    - `quotaBytes`: `SYNC_TOTAL_QUOTA_BYTES` (100KB)
    - `overQuota`: boolean
    - `skippedDuplicates`: count of links skipped as duplicates

This function also has **no side effects**. It's the dry run.

Files touched: `js/config.js`
Test: unit tests — merge with empty config, merge with existing links (dedup), merge that would exceed quota, merge at exactly quota boundary.

**3c. Import UI integration**

Add `"bookmarks"` option to the import mode `<select>` in index.html:

```html
<option value="bookmarks">Import Chromium bookmarks</option>
```

In the import handler (`customize.js`), add a `bookmarks` mode branch:

1. Read and parse the file with `parseChromiumBookmarks()`. On failure, show error, stop.
2. Call `previewBookmarkImport(activeConfig, parsed)` to get stats.
3. If `overQuota`: show blocking error with current/projected/max bytes. Do not proceed.
4. If not over quota: show confirmation with stats (new links, new sections, current vs projected usage).
5. On confirm: apply the `projectedConfig` via `saveV2SyncConfig()`. On save failure, show error — existing config is safe due to two-phase write.
6. On success: re-render with the new config.

Files touched: `index.html`, `js/customize.js`
Test: unit test — verify import handler calls parser, runs preview, blocks on overQuota. Playwright E2E — import a sample Chromium bookmarks file, verify sections and links appear; import oversized file, verify it's blocked.

### Phase 4: Open all links in section (independent)

Add a "Open all" button to each section header. When clicked:

1. Gather all link URLs in that section.
2. If > 5 links, show a confirmation: "Open {N} links in new tabs?"
3. Open each URL via `window.open(url, '_blank')`.

Popup blocker considerations:

- Browsers block `window.open` calls that aren't in direct response to user interaction. Since the confirm dialog breaks the call chain, we need to collect URLs first, show confirm, then open in a tight synchronous loop immediately after confirm returns `true`.
- If a browser blocks popups, the user will see the browser's built-in "popups blocked" notification — no custom handling needed.

UX placement: visible in both normal and rearrange mode, positioned in `.section-header-actions` between Collapse and the drag handle.

Files touched: `js/render.js` (add button to section header), `js/customize.js` (click handler), `css/style.css` (styling)
Test: unit test — verify button renders in section header, verify URL collection. Playwright E2E — click open-all, verify `window.open` called with correct URLs.

### Phase 5: CI hooks + Playwright E2E (independent, but benefits from all other phases being done)

**5a. Playwright setup**

Add Playwright as a dev dependency. Configure for Chromium extension testing:

- Load the extension as unpacked in a Chromium instance.
- Create test fixtures that set up a known config state via `chrome.storage.sync`.
- Write E2E tests for:
    - Page loads with correct branding and sections
    - Search form submits to correct engine
    - Settings panel opens and saves
    - Collapse/expand works on main page
    - Hide/unhide works
    - Open all links (verify window.open calls)
    - Bookmark import flow
    - Version label visible

Files added: `tests/e2e/` directory, `playwright.config.js`
Dev dependency: `@playwright/test`

**5b. Upgrade git hooks**

Update `hooks/pre-commit`:

- Keep: JSON validation, JS syntax check, lint, format check
- Add: `npx vitest run` (unit tests)

Update `hooks/pre-push`:

- Keep: everything in pre-commit
- Add: `npx playwright test` (E2E tests)
- Add: explicit exit code checking

Update `.github/workflows/edge-packages.yml` `quality-gate` job:

- Add: Playwright install step (`npx playwright install chromium`)
- Add: Playwright test step (`npx playwright test`)

Files touched: `hooks/pre-commit`, `hooks/pre-push`, `.github/workflows/edge-packages.yml`, `package.json`

### Phase 6: Polish and documentation

- Update `docs/ARCHITECTURE.md` with new data model fields (`hiddenSections`).
- Update `PROGRESS.md` with milestone entries.
- Close any new tech debt items or add them to tracker.
- Final quality gate: `npm test`, `npm run lint`, Playwright pass.

## Alternatives considered

| Option                                           | Pros                               | Cons                                                                                         | Decision                                                                                                       |
| ------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Bookmark import via file drag-and-drop           | More intuitive                     | Extra UI complexity, not standard pattern in this app                                        | Rejected — use existing file picker with mode selector                                                         |
| Nested folder → nested sections                  | Preserves hierarchy                | Extension UI is flat sections, no nested section concept                                     | Rejected — flatten to top-level sections                                                                       |
| Hide = delete from render but keep in config     | Simple                             | "Hidden" sections still count toward storage quota (fine), but users might forget they exist | Accepted — add visible indicator in settings panel                                                             |
| Open-all via `chrome.tabs.create` API            | More reliable than window.open     | Requires `tabs` permission (privacy concern, store review flag)                              | Rejected — use window.open, accept popup blocker behavior                                                      |
| Version label in main page footer                | Always visible                     | Adds visual clutter to the main page                                                         | Rejected — put in settings panel footer; small and unobtrusive                                                 |
| Playwright via puppeteer-chromium-extension      | Lighter weight                     | Less maintained, Playwright is industry standard                                             | Rejected — use Playwright directly                                                                             |
| Collapse button always visible with full opacity | Consistent with "always available" | Visual noise for users who don't use collapse                                                | Accepted — keep button subtle (small, uppercase, muted) but clickable. The CSS already has the subtle styling. |

## Risks and mitigations

| Risk                                                       | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hiddenSections` data model change breaks existing configs | Field is additive with `[]` default. `mergeConfig` handles missing field gracefully. Existing configs unaffected.                                                                                                                                                                                                                                                                                          |
| Chromium bookmark import exceeds storage quota             | Defense in depth: (1) `previewBookmarkImport` runs `estimateV2SyncPayload` on the merged config before any write — blocks import if over quota. (2) `saveV2SyncConfig` has its own built-in `preflightV2Quota` as a second gate. (3) Two-phase temp→final write ensures existing config survives even if a write fails mid-flight. Import is additive only and never mutates the existing config in-place. |
| Bookmark import corrupts or displaces existing data        | Parser and merge are pure functions with no side effects. Merge deduplicates against existing links. User sees exact byte impact (current vs projected vs max) before confirming. Over-quota imports are hard-blocked, not warned. Existing config is never at risk.                                                                                                                                       |
| Popup blockers prevent open-all-links                      | Expected behavior. Browser shows its own "popups blocked" notification. No custom workaround needed — users can whitelist the extension's new tab page.                                                                                                                                                                                                                                                    |
| Playwright adds significant CI time                        | Playwright Chromium-only install is ~50MB. Run E2E tests only in pre-push and CI, not pre-commit. Target < 30s for E2E suite.                                                                                                                                                                                                                                                                              |
| Collapse buttons visible on main page add visual noise     | Keep existing subtle CSS styling (11px, uppercase, muted color). Only becomes prominent on hover.                                                                                                                                                                                                                                                                                                          |
| `window.open` chain gets interrupted by browser security   | Open links synchronously in a tight loop immediately after `confirm()` returns. This maximizes the chance browsers treat them as user-initiated.                                                                                                                                                                                                                                                           |
| Version label reveals build info to users                  | Intentional — this is the feature. No sensitive information exposed (name + semver only).                                                                                                                                                                                                                                                                                                                  |

## Dependency graph

```
Phase 1b (hiddenSections data model)
  └─→ Phase 2b (hide section = actually hide)

Phase 1a (section select bug fix)     — independent
Phase 1c (version label)              — independent
Phase 2a (collapse without rearrange) — independent
Phase 3  (bookmark import)            — independent
Phase 4  (open all links)             — independent
Phase 5  (CI + Playwright)            — benefits from all phases done, but can start setup in parallel
```

**Parallelizable work:**

- Phases 1a, 1c, 2a, 3a, 4 can all be developed in parallel (no shared file conflicts beyond minor CSS additions).
- Phase 2b depends on 1b (data model).
- Phase 5 benefits from having features in place to test but Playwright setup can begin independently.

## Acceptance criteria

- [ ] Chromium bookmark JSON import works: nested folders flattened, duplicates filtered, large files handled gracefully.
- [ ] Pre-commit hook runs lint + format + unit tests. Pre-push hook runs full suite + Playwright E2E.
- [ ] CI runs Playwright E2E in the quality-gate job.
- [ ] Each section has an "Open all" button that opens all links in new tabs with confirmation for > 5 links.
- [ ] Collapse/expand buttons work on the main page without entering rearrange mode.
- [ ] Section select remains visible and functional after selecting a section in the add-link flow.
- [ ] "Hide" fully removes a section from the main page. Hidden sections are editable and un-hideable in settings.
- [ ] Extension name and version from manifest.json displayed in settings footer.
- [ ] No data model regressions — existing configs load correctly with new fields defaulting gracefully.
- [ ] All performance budgets hold (< 200ms FMP, 0 FOUC, 0 CLS).
- [ ] All existing 267 tests pass. New unit tests added for every feature.
- [ ] `npm run lint` and `npm run format:check` pass.
- [ ] Playwright E2E tests pass for all new features.

## Test plan

### Unit tests (vitest)

- `tests/config-utils.test.js`: parseChromiumBookmarks (valid, nested, duplicates, malformed, large), mergeConfig with hiddenSections
- `tests/customize-editors.test.js`: section select persistence after selection, toggleSectionHidden
- `tests/render-sections.test.js`: renderSections skips hiddenSections, open-all button renders, collapse button works without rearrange
- `tests/init.test.js` (new): version label populated from manifest

### E2E tests (Playwright)

- Page loads with correct sections and branding
- Collapse/expand on main page (no rearrange)
- Hide section → disappears; unhide → reappears
- Open all links → correct number of window.open calls
- Import Chromium bookmarks → sections and links appear
- Version label visible in settings
- Settings panel save/cancel flow

### Manual smoke tests

- Load extension in Edge/Chrome as unpacked
- Import a real Chromium bookmarks export file
- Verify no FOUC, no layout shifts
- Verify popup blocker behavior on open-all-links
- Verify version label shows correct build name

## Rollout / migration plan

- All work on feature branches, one per phase or logical grouping.
- Data model change (hiddenSections) is backwards-compatible — no migration needed.
- No breaking changes to existing config structure.
- Each phase can be merged independently (respecting the dependency: 1b before 2b).
- Merge to `main` via PR. CI quality gate must pass.
- Version bump in manifest.json after all features land.

## Progress log

(append-only, dated)

- 2026-03-14: Plan created. 7 features scoped across 6 phases. Dependency graph mapped. Codebase analysis complete.
- 2026-03-14: Phase 1a complete — section select scroll fix (scrollIntoView after moveLinkRowToSection).
- 2026-03-14: Phase 1b complete — hiddenSections added to config.json, fallbackConfig, mergeConfig, collectConfigFromEditors.
- 2026-03-14: Phase 1c complete — version label from manifest.json rendered in settings footer.
- 2026-03-14: Phase 2a complete — collapse/expand works without rearrange mode (removed isRearranging guard, CSS always visible).
- 2026-03-14: Phase 2b complete — true section hiding with renderSections skip, Hide button, toggleSectionHidden, hidden-sections-bar with unhide.
- 2026-03-14: Phase 3 complete — parseChromiumBookmarks parser, previewBookmarkImport with estimateSyncUsage quota check, import UI with over-quota blocking.
- 2026-03-14: Phase 4 complete — open-all-links button on section headers with confirm for >5 links.
- 2026-03-14: Phase 5 complete — Playwright installed, E2E test suite (16 tests), pre-commit adds unit tests, pre-push adds Playwright, CI workflow updated with xvfb-run.
- 2026-03-14: Phase 6 — docs updated, quality gates pass (267 unit tests, 0 lint errors, formatting clean).
- 2026-03-14: Bug fix round 1 — unhide refresh, bookmark HTML parsing (was JSON, now uses DOMParser), collapse button visibility, scroll UX.
- 2026-03-14: Bug fix round 2 — critical quota doubling in two-phase write for large payloads (conditional write strategy), "Open all" button repositioned, "Hidden" nav pill added.
- 2026-03-14: Bug fix round 3 — hidden section position restoration (persistActiveConfig now merges visible + hidden sections to preserve order), hidden section links preserved across persist cycles.
- 2026-03-14: Enhancement — selective folder import with modal picker (checkboxes, live quota feedback, over-quota blocking). Import success toast added.
- 2026-03-14: Swapped OpenAI Codex footer link for GitHub repo link.
- 2026-03-14: All 7 features manually verified on Windows and Mac Edge. 267 tests pass, 0 lint errors.

## Decision log

(append-only, dated)

- 2026-03-14: Chose to flatten nested Chromium bookmark folders to top-level sections rather than introducing nested section concept — keeps UI simple and consistent with existing flat section model.
- 2026-03-14: Chose window.open over chrome.tabs.create for open-all-links to avoid adding `tabs` permission (privacy/store review concern).
- 2026-03-14: Chose to put version label in settings footer rather than main page — avoids visual clutter on the primary UI surface.
- 2026-03-14: Chose to make collapse buttons always active (not just in rearrange mode) — this is the feature request, and the existing subtle CSS styling prevents visual noise.
- 2026-03-14: Bookmark import gets a three-layer safety model (preview preflight → saveV2 preflight → two-phase write) to ensure existing config data can never be lost. Over-quota imports are hard-blocked, not just warned. This aligns with the project's #1 non-negotiable: config data fidelity.
- 2026-03-14: Switched bookmark parser from JSON to HTML (Netscape Bookmark File Format) via DOMParser — Chromium exports HTML, not JSON.
- 2026-03-14: Large payload writes (>50% quota) skip two-phase temp→final pattern to avoid doubling storage. Clear-then-write strategy instead.
- 2026-03-14: Added selective folder import modal — users pick which bookmark folders to import, with real-time quota feedback. Replaces all-or-nothing import.
