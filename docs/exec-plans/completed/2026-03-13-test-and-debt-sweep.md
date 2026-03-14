# Execution Plan: Test Coverage + Tech Debt Sweep

**Created:** 2026-03-13
**Status:** Complete

## Goal

Upgrade the 3 lowest-graded domains (Search C, Customize panel D, Drag & reorder D) to A-grade test coverage, and close the remaining medium-severity tech debt items (#4 FOUC, #5 PowerShell-only scripts).

## Non-goals

- New features or behavior changes.
- CSS split (tech debt #6) — low severity, defer.
- Refactoring customize.js internals — test first, refactor later.

## Constraints

- No runtime code changes except for the FOUC fix (tech debt #4).
- All new tests use the existing VM sandbox + DOM mock approach.
- FOUC fix must not introduce FOUC of its own (no visible flash during the fix).
- No new frameworks or build tools.

## Current state

- 192 tests across 9 files, all passing.
- Module split complete — all functions are in isolated, focused modules.
- DOM mock (`tests/helpers/dom-mock.js`) supports element creation, queries, classList, dataset, style, attributes, and event listeners.
- 3 domains need test coverage:
    - **Search (C):** collectSearch tested indirectly. No renderSearch DOM tests, no engine row management tests.
    - **Customize panel (D):** No tests for renderSettings, renderLinksEditor, renderBackgroundsEditor, renderSearchEditor, renderLayoutEditor, renderVisibilityEditor, renderPrivacyEditor, renderBrandingEditor, renderBackgroundModeEditor.
    - **Drag & reorder (D):** No tests for findReorderTarget, setRearrangeMode, updateLinkRowDragState, updateEngineRowDragState, updateMainDragState.
- 2 medium tech debt items:
    - **#4 FOUC:** Page briefly shows default content before user config loads.
    - **#5 PowerShell-only scripts:** `scripts/package-edge.ps1` and `scripts/build-release-body.ps1` don't work on Linux.

## Proposed approach

### Phase 1: Search domain tests (C → A)

Add `tests/render-search.test.js`:

- **renderSearch DOM tests:** default engine highlighted, multiple engines render, empty engines fallback, missing DOM elements, search form structure.
- **collectSearch unit tests:** collect from populated editor, empty editor, default engine selection.
- **Engine row management:** addEngineRow renders fields correctly, refreshDefaultEngineOptions syncs select options.

### Phase 2: Customize panel editor tests (D → A)

Add `tests/customize-editors.test.js`:

- **renderSettings:** calls all sub-renderers (verify DOM populated for each section).
- **renderLinksEditor:** links populate rows with correct fields, sections create blocks, empty links add default row, iconOverride sets preview src.
- **renderBackgroundsEditor:** backgrounds populate rows, empty adds default, thumbnail preview queued.
- **renderQuotesEditor:** quotes joined with newlines in textarea.
- **renderLayoutEditor:** resizable/maxColumns/minCardWidth/pageWidth populate, updateLayoutControlState disables controls when not resizable.
- **renderVisibilityEditor / renderPrivacyEditor:** checkboxes reflect config values, defaults when undefined.
- **renderBrandingEditor:** title/subtitle/quotesTitle populate inputs.
- **renderBackgroundModeEditor:** select value matches config.
- **Link section management:** ensureLinksSection creates section, createLinksSection builds DOM structure, refreshLinkSectionChoices populates dropdowns, getLinkRowSectionValue/setLinkRowSectionValue read/write correctly, handleLinkSectionSelection shows custom input for "New...", finalizeCustomLinkSection moves row.

### Phase 3: Drag & reorder tests (D → A)

Add `tests/drag-reorder.test.js`:

- **findReorderTarget:** returns closest element above pointer, returns null when no candidates, skips dragging item, handles single element, handles empty container.
- **setRearrangeMode:** toggles isRearranging, adds/removes CSS classes, calls renderAll, updates drag states.
- **updateLinkRowDragState:** sets draggable based on isRearranging/canRearrangeEditor.
- **updateEngineRowDragState:** sets draggable and aria-disabled on handles.
- **updateMainDragState:** sets draggable on link-cards, sections, section-handles.

### Phase 4: FOUC fix (tech debt #4)

- Add `visibility: hidden` to `<body>` in CSS (or inline style in `index.html`).
- In `init()`, after `renderAll()` completes, remove the hidden state.
- Ensure the fix doesn't cause a blank flash (hidden → rendered should be instantaneous after paint).
- Test: verify init() removes the hidden class/attribute after render.

### Phase 5: Cross-platform release scripts (tech debt #5)

- Add `scripts/package-edge.sh` — bash equivalent of `package-edge.ps1`.
- Add `scripts/build-release-body.sh` — bash equivalent of `build-release-body.ps1`.
- Verify both produce identical output to the PowerShell versions.
- Update docs to mention both options.

### Phase 6: Scoring and cleanup

- Update QUALITY_SCORE.md: Search C → A, Customize panel D → A, Drag & reorder D → A.
- Close tech debt #4 and #5 in tracker.
- Update PROGRESS.md.

## Alternatives considered

| Option                                                            | Pros                  | Cons                                    | Decision                                    |
| ----------------------------------------------------------------- | --------------------- | --------------------------------------- | ------------------------------------------- |
| Test customize panel via integration tests (full init → interact) | More realistic        | Slow, brittle, requires full DOM        | Rejected — unit test individual renderers   |
| FOUC fix via inline `<script>` that hides body                    | Runs before CSS loads | Adds script to critical path            | Consider — may be simpler than CSS approach |
| Skip PowerShell equivalents, use Node scripts instead             | Single runtime        | Adds Node dependency to release process | Rejected — bash is simpler, no extra deps   |

## Risks and mitigations

| Risk                                          | Mitigation                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| DOM mock insufficient for editor tests        | Extend dom-mock.js as needed (add template element support, cloneNode deep copy, form elements) |
| FOUC fix introduces blank flash               | Use `opacity: 0` + transition rather than `display: none` to avoid layout recalculation         |
| Bash scripts diverge from PowerShell versions | Test both produce identical zip contents                                                        |
| Test count growth slows CI                    | VM sandbox is fast (~1.3s for 192 tests); adding ~80-100 tests should stay under 3s             |

## Acceptance criteria

- [ ] Search domain graded A in QUALITY_SCORE.md.
- [ ] Customize panel domain graded A in QUALITY_SCORE.md.
- [ ] Drag & reorder domain graded A in QUALITY_SCORE.md.
- [ ] No FOUC on page load (tech debt #4 closed).
- [ ] `scripts/package-edge.sh` and `scripts/build-release-body.sh` exist and work (tech debt #5 closed).
- [ ] All tests pass (existing 192 + new tests).
- [ ] `npm run lint` passes.
- [ ] No user-facing behavior changes (except FOUC elimination).

## Test plan

- `npm test` passes after every phase.
- `npm run lint` passes after every phase.
- Manual smoke test: new tab loads without FOUC, all features work.
- Release scripts: run bash versions and verify zip output matches PowerShell output.

## Rollout / migration plan

- All work on a single feature branch.
- One commit per phase for clean bisect.
- FOUC fix is the only runtime change — minimal risk.
- Merge to `main` via PR after all acceptance criteria met.

## Progress log

(append-only, dated)

- 2026-03-13: Plan created.
- 2026-03-14: Phase 1 complete — 22 Search domain tests added (renderSearch, collectSearch, renderSearchEditor, addEngineRow, refreshDefaultEngineOptions). Search C→A.
- 2026-03-14: Phase 2 complete — 37 Customize panel editor tests added (renderSettings, renderLinksEditor, renderBackgroundsEditor, renderQuotesEditor, renderLayoutEditor, updateLayoutControlState, renderVisibilityEditor, renderPrivacyEditor, renderBrandingEditor, renderBackgroundModeEditor, createLinksSection, ensureLinksSection, link section management). Customize panel D→A.
- 2026-03-14: Phase 3 complete — 16 Drag & reorder tests added (findReorderTarget, setRearrangeMode, updateLinkRowDragState, updateEngineRowDragState, updateMainDragState, FOUC prevention test). Drag & reorder D→A.
- 2026-03-14: Phase 4 complete — FOUC fix: body.loading class (opacity: 0) in CSS + init() removes loading class after renderAll(). Tech debt #4 closed.
- 2026-03-14: Phase 5 complete — Added scripts/package-edge.sh and scripts/build-release-body.sh (bash equivalents of PowerShell scripts). Tech debt #5 closed.
- 2026-03-14: Phase 6 complete — Updated QUALITY_SCORE.md (all 8 domains A), closed tech debt #4 and #5 in tracker, updated PROGRESS.md. 267 tests total, all passing.

## Decision log

(append-only, dated)

- 2026-03-13: Chose to test editor renderers individually rather than through full integration tests — faster, more isolated, easier to debug failures.
