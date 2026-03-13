# Execution Plan: Module Split (Tech Debt #1)

**Created:** 2026-03-13
**Status:** Complete

## Goal

Split `js/script.js` (2,975 lines, ~90 functions, ~30 constants) into focused, cohesive modules with clear boundaries. Enable clean imports in tests, reduce coupling, and make the codebase navigable for future changes.

## Non-goals

- Introducing ES module `import`/`export` in production (extension context uses plain `<script>` tags — MV3 doesn't support ES modules in new-tab overrides without a bundler).
- Adding a bundler, TypeScript, or build step.
- Changing any user-facing behavior.
- Changing the storage format or data model.

## Constraints

- **No new frameworks or build tools.** Files loaded via `<script>` tags in `index.html`.
- **Script load order matters.** Modules must be loaded in dependency order.
- **All 192 tests must pass** after every step. The test suite is our safety net.
- **No behavior changes.** Every function must produce identical output for identical input.
- **Config data is sacred.** Storage keys, migration paths, and data shapes are untouchable.
- **Globals must remain accessible** for the VM sandbox test approach (functions declared with `function` at file scope become sandbox properties). If a function moves to a new file, it must still be a top-level `function` declaration.

## Current state

- Single `js/script.js` file with everything: constants, storage, config, rendering, customize panel, drag/reorder, gradients, favicons, utilities.
- 192 tests across 9 files, all passing.
- Tests access functions via `env.globals.<functionName>` — requires top-level `function` declarations in the VM sandbox.
- `index.html` loads a single `<script src="js/script.js">`.

## Proposed module structure

Based on natural boundaries in the code, 7 modules:

### `js/constants.js` (~50 lines)

All `const` declarations: storage keys, limits, defaults, `fallbackConfig`.

**Contains:** Lines 9–51 (all `const` declarations through `fallbackConfig`).
**Dependencies:** None.

### `js/utils.js` (~80 lines)

Pure utility functions with no domain knowledge.

**Contains:** `hashString`, `padChunkIndex`, `chunkStringBySize`, `buildV2ChunkKeys`, `calculatePayloadBytes`, `isDataUrl`, `ensureLinkIds`, `createId`, `timeAgo`, `rand`, `shuffleArray`, `boostColor`, `safeParseUrl`, `blobToDataUrl`, `fileToDataUrl`, `createImageThumbnail`.
**Dependencies:** None (uses built-in `crypto`, `URL`, `FileReader`).

### `js/storage.js` (~500 lines)

All `chrome.storage` operations: sync/local wrappers, v2 chunked format, quota preflight, migration, simulated sync for testing.

**Contains:** `storageLocal`, `storageSync`, `shouldUseSimSync`, `getSimSyncStore`, `validateSimSyncSnapshot`, `applySimFault`, `loadConfig`, `loadDefaultConfig`, `loadSyncConfigCore`, `loadV2SyncConfig`, `loadChunkedSyncConfig`, `saveSyncConfigV2`, `saveSyncConfig`, `clearSyncStorage`, `collectChunks`, `getChunkKeys`, `preflightV2Payload`, `estimateSyncUsage`, `getConfigSizeBytes`, `setSyncStatus`, `updateSyncUsage`, `refreshSyncStatus`.
**Dependencies:** `constants.js`, `utils.js`.

### `js/config.js` (~200 lines)

Config manipulation: merge, split, local assets, normalization.

**Contains:** `mergeConfig`, `splitConfig`, `applyLocalAssets`, `mergeLocalAssets`, `normalizeQuotesImport`, `deriveSections`, `collectConfigFromEditors`, `collectLinks`, `collectSectionsFromEditor`, `collectSectionsFromMain`, `collectCollapsedSectionsFromMain`, `collectLinksFromMain`, `collectBackgrounds`, `collectQuotes`, `collectSearch`, `collectLayout`, `collectVisibility`, `collectPrivacy`, `collectBranding`, `collectBackgroundMode`.
**Dependencies:** `constants.js`, `utils.js`.

### `js/render.js` (~350 lines)

All main-page rendering: sections, quotes, backgrounds, branding, search, layout, visibility, favicons, gradients.

**Contains:** `renderAll`, `renderSections`, `renderQuote`, `renderBackground`, `renderImageBackground`, `renderBranding`, `renderSearch`, `applyVisibility`, `updatePageLayout`, `updateGridColumns`, `setupGridObserver`, `resolveFavicon`, `fetchFavicon`, `applyGradientMode`, `applySignatureGradient`, `applySodaGradient`, `applyGithubDarkGradient`, `applyAzureGradient`, `applyDraculaGradient`, `applySynthwaveGradient`, `applyDaylightGradient`, `setAuraPalette`, `sampleDominantColor`, `collectFaviconSources`.
**Dependencies:** `constants.js`, `utils.js`, `config.js`.

### `js/customize.js` (~900 lines)

The entire settings/customize panel: setup, editors, drag/reorder, import/export, file handling.

**Contains:** `setupSettings`, `setupSettingsNav`, `renderSettings`, `renderLinksEditor`, `renderQuotesEditor`, `renderBackgroundsEditor`, `renderSearchEditor`, `renderBackgroundModeEditor`, `renderBrandingEditor`, `renderLayoutEditor`, `updateLayoutControlState`, `renderVisibilityEditor`, `renderPrivacyEditor`, `addLinkRow`, `addBackgroundRow`, `addEngineRow`, `refreshDefaultEngineOptions`, `refreshLinkSectionChoices`, `getLinkRowSectionValue`, `setLinkRowSectionValue`, `moveLinkRowToSection`, `handleLinkSectionSelection`, `finalizeCustomLinkSection`, `getDefaultLinkSectionFromMain`, `ensureLinksSection`, `createLinksSection`, `setRearrangeMode`, `updateLinkRowDragState`, `updateEngineRowDragState`, `updateMainDragState`, `findReorderTarget`, `ensureBackgroundPreviewObserver`, `queueBackgroundPreview`, `getBackgroundThumb`, `getBackgroundThumbKey`, `updateFileLabel`.
**Dependencies:** `constants.js`, `utils.js`, `config.js`, `render.js`, `storage.js`.

### `js/init.js` (~30 lines)

Entry point: global state declarations, `DOMContentLoaded` listener, `init()`.

**Contains:** Global `let` declarations (`activeConfig`, `faviconCache`, `backgroundThumbs`, `isRearranging`, `lastRenderLinks`, etc.), `init()` function, `DOMContentLoaded` listener.
**Dependencies:** All other modules.

### Script load order in `index.html`

```html
<script src="js/constants.js"></script>
<script src="js/utils.js"></script>
<script src="js/storage.js"></script>
<script src="js/config.js"></script>
<script src="js/render.js"></script>
<script src="js/customize.js"></script>
<script src="js/init.js"></script>
```

## Proposed approach

### Phase 1: Extract constants.js

Move all `const` declarations (lines 9–51) to `js/constants.js`. Update `script.js` to remove them. Add `<script>` tag to `index.html`. Verify all 192 tests pass.

This is the safest first step — constants have no dependencies and every other module needs them.

### Phase 2: Extract utils.js

Move pure utility functions to `js/utils.js`. These have no dependencies on other application code. Verify tests pass.

### Phase 3: Extract storage.js

Move storage wrappers and v2 chunked operations. These depend on constants and utils but nothing else. Verify tests pass.

### Phase 4: Extract config.js

Move config manipulation functions. Depends on constants and utils. Verify tests pass.

### Phase 5: Extract render.js

Move all rendering functions. Depends on constants, utils, and config. Verify tests pass.

### Phase 6: Extract customize.js

Move the settings panel. This is the largest module and has the most dependencies. Verify tests pass.

### Phase 7: Create init.js, remove script.js

Move global state and init to `js/init.js`. `js/script.js` should now be empty — delete it. Update `index.html` to load all modules. Verify tests pass.

### Phase 8: Update test infrastructure

Update `tests/helpers/load-script.js` to load all module files in order (concatenating sources before running in VM context). Verify all 192 tests still pass with the multi-file approach.

**Important:** This phase must happen alongside each extraction phase, not at the end. As each module is extracted, the test loader must be updated to load the new file.

### Phase 9: Quality scoring

- Update QUALITY_SCORE.md: Config management B → A (now has module isolation).
- Update tech debt tracker: close tech debt #1.
- Remove "remaining gap: module isolation" notes from all domain grades.

## Alternatives considered

| Option                                      | Pros                                      | Cons                                                                         | Decision   |
| ------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- | ---------- |
| ES modules with bundler                     | Clean imports, tree-shaking               | Adds build step, violates no-bundler constraint                              | Rejected   |
| ES modules without bundler                  | Native import/export                      | MV3 new-tab override doesn't support `type="module"` without CSP workarounds | Rejected   |
| IIFE per file                               | Avoids global pollution                   | More boilerplate, tests can't access functions directly                      | Rejected   |
| Plain `<script>` files, top-level functions | Simple, works today, tests work unchanged | Global namespace pollution (acceptable for extension new-tab page)           | **Chosen** |
| Single file, just reorganize with comments  | Zero risk                                 | Doesn't solve testability, navigability, or coupling                         | Rejected   |

## Risks and mitigations

| Risk                                                                                                           | Mitigation                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared mutable state (`activeConfig`, `faviconCache`, etc.) creates hidden coupling between modules            | Document which module owns each mutable. `init.js` owns declarations; other modules reference but don't declare.                                |
| Script load order bugs (function called before its file loads)                                                 | Strict dependency ordering in `index.html`. Test in browser after each phase.                                                                   |
| Tests break because VM sandbox loads only one file                                                             | Update test loader to concatenate all module files in order. Do this incrementally with each phase.                                             |
| Functions that cross module boundaries (e.g., `collectConfigFromEditors` reads DOM and calls config functions) | Accept that `customize.js` is a "thick" module with cross-cutting concerns. It's the natural boundary — the customize panel touches everything. |
| Merge conflicts with other work                                                                                | This should be the only active plan during execution. No parallel feature work on `script.js`.                                                  |

## Acceptance criteria

- [x] `js/script.js` no longer exists (deleted, not empty).
- [x] 7 module files exist: `constants.js`, `utils.js`, `storage.js`, `config.js`, `render.js`, `customize.js`, `init.js`.
- [x] `index.html` loads all 7 files in correct dependency order.
- [x] All 192+ tests pass via `npm test`.
- [x] `npm run lint` passes.
- [x] Extension loads and functions identically in Edge/Chrome (manual verification).
- [x] QUALITY_SCORE.md updated.
- [x] Tech debt #1 closed in tracker.
- [x] No user-facing behavior changes.

## Test plan

- `npm test` passes after every phase (not just at the end).
- `npm run lint` passes after every phase.
- Manual smoke test in Edge: load extension, verify links render, customize panel opens, save/load works, backgrounds display.
- Pre-commit and pre-push hooks pass.

## Rollout / migration plan

- All work on `feature/module-split` branch.
- One commit per phase for clean bisect if needed.
- No behavior changes — extension is unchanged from the user's perspective.
- Merge to `main` via PR after all acceptance criteria met.

## Progress log

(append-only, dated)

- 2026-03-13: Plan created.
- 2026-03-13: Phase 1 complete — extracted constants.js (43 lines, all storage keys + fallbackConfig).
- 2026-03-13: Phase 2 complete — extracted utils.js (16 pure utility functions, 138 lines).
- 2026-03-13: Phase 3 complete — extracted storage.js (24 functions, 524 lines).
- 2026-03-13: Phase 4 complete — extracted config.js (20 functions, 389 lines).
- 2026-03-13: Phase 5 complete — extracted render.js (25 functions, 512 lines).
- 2026-03-13: Phase 6 complete — extracted customize.js (38 functions, 1319 lines).
- 2026-03-13: Phase 7 complete — created init.js (58 lines), deleted script.js.
- 2026-03-13: Phase 8 complete — test infrastructure verified (192 tests pass with 7-module concatenation).
- 2026-03-13: Phase 9 complete — graded Search (C), Customize panel (D), Drag & reorder (D). Config management upgraded B→A. Tech debt #1 closed.

## Decision log

(append-only, dated)

- 2026-03-13: Chose plain `<script>` files with top-level functions over ES modules — MV3 new-tab override doesn't support `type="module"` without CSP workarounds, and a bundler violates the no-frameworks constraint. Global namespace pollution is acceptable for a single-page extension context.
