# Execution Plan: DOM Test Coverage Improvement

**Created:** 2026-03-13
**Status:** Complete

## Goal

Push C-graded domains (Link rendering, Backgrounds, Quotes, Import/Export) to A by adding DOM rendering tests, edge case coverage, error path tests, and end-to-end JSON round-trip tests. A means "excellent tests given the current single-file architecture" — not blocked on tech debt #1 module split.

## Non-goals

- Refactoring `script.js` into modules (tech debt #1 — separate effort, to be discussed after this plan completes).
- Changing any runtime behavior.
- Testing editor/customize-panel rendering (renderLinksEditor, renderQuotesEditor, etc.).

## Constraints

- No runtime code changes to `js/script.js` or any extension file.
- Tests must run via `npm test` (Vitest, existing infrastructure).
- Use the existing VM sandbox approach from `tests/helpers/load-script.js`.
- DOM mock enhancements must stay in test helpers — not leak into production code.

## Grading rubric

For this plan, A means all of the following within the current architecture:

- **Happy path covered** — primary rendering behavior verified with structural assertions.
- **Edge cases covered** — empty inputs, missing fields, boundary values, unexpected types.
- **Error paths covered** — graceful handling of null/undefined, malformed data, missing DOM elements.
- **Negative tests** — verify that incorrect inputs don't produce incorrect output (e.g., XSS via innerHTML).
- **Integration coverage** — functions tested in composition (e.g., normalizeQuotesImport → mergeConfig → renderQuote pipeline).

What A does NOT require (blocked on tech debt #1):

- True unit isolation via module imports.
- Testing `const`-declared values directly.
- Mocking internal function dependencies cleanly.

## Current state

- **118 tests** across 5 test files.
- 4 domains graded C: pure utility functions tested, but no DOM rendering or integration tests.
- The document mock in `load-script.js` returns `null` from `getElementById`/`querySelector` — insufficient for DOM rendering tests.
- `__MSOM_DISABLE_UI__` flag prevents script.js from running UI init on load — functions are still accessible via `env.globals`.

## Proposed approach

### Phase 1: Enhanced DOM mock

Enhance `tests/helpers/load-script.js` document mock to support DOM rendering tests:

- `createElement(tag)` returns objects with: `tagName`, `className`, `textContent`, `innerHTML`, `hidden`, `dataset` (Proxy-backed), `style` (object with `setProperty`/`getPropertyValue`), `classList` (add/remove/toggle/contains), `children` (array), `childNodes`, `appendChild`, `removeChild`, `setAttribute`, `getAttribute`, `attributes` map, `href`, `target`, `draggable`, `type`, `alt`, `src`, `download`.
- `getElementById(id)` backed by a registry — tests can pre-register elements.
- `querySelector`/`querySelectorAll` — minimal support for ID selectors and tag selectors.
- `document.body` as a full mock element with `classList`, `style`.
- Elements returned by `createElement` track parent/child relationships.

This is a **test-only** helper — zero production code changes.

### Phase 2: renderQuote DOM tests (Quotes → A)

Test `renderQuote(quotes)`:

Happy path:

- Empty array → sets placeholder text on `text-container`.
- Single quote → displays that exact quote.
- Multiple quotes → displays one of the provided quotes (membership check).

Edge cases:

- Very long quote string → still assigned to textContent without truncation.
- Quote containing HTML characters (`<script>`, `&amp;`) → written to `textContent` not `innerHTML` (XSS safety).
- Single-element array → always returns that element.

Error paths:

- `text-container` element missing from DOM → does not throw.

### Phase 3: renderSections DOM tests (Link rendering → A)

Test `renderSections(config)`:

Happy path:

- Single section with links → creates section div, header with h2, collapse button, links-grid with link cards.
- Multiple sections → creates section divs in correct order.
- Link cards have correct `href`, label `textContent`, `data-link-id`.

Edge cases:

- Empty links array → container cleared, no section divs created.
- Links without explicit section → grouped under "Links" default.
- Collapsed sections → `is-collapsed` class present, `data-collapsed="true"`, button text "Expand".
- Non-collapsed sections → no `is-collapsed` class, button text "Collapse".
- Links with `name` → label shows name. Links without `name` → label shows URL.
- Multiple links in same section → all appear in same grid.
- `collapsedSections` as non-array → handled gracefully.

Error paths:

- Config with undefined `links` → does not throw.
- Config with undefined `sections` → derives sections from links.

### Phase 4: renderBackground DOM tests (Backgrounds → A)

Test `renderBackground(config)`:

Happy path:

- `mode: "images"` → body gets `background-image` class, `background-blur` removed, style set.
- `mode: "images_blur"` → body gets `background-blur` class, `background-image` removed, CSS var set.
- Gradient modes → both image classes removed, gradient applied.

Edge cases:

- Empty backgrounds array → clears background image style.
- Single background → that URL used.
- Multiple backgrounds → one of the provided URLs used (membership check).

Error paths:

- Missing `backgroundMode` → defaults to "images" mode.
- Missing `backgrounds` array in image mode → clears gracefully.

Requires: `document.body` mock with `classList`, `style`, and `style.setProperty`.

### Phase 5: Import/Export round-trip tests (Import/Export → A)

Test `mergeConfig` comprehensively as the core of the import flow:

Happy path:

- Full config round-trip: `mergeConfig(base, exportedConfig)` preserves all fields.
- Quotes-only import: `mergeConfig(base, { quotes: [...] })` preserves all other fields.
- Links-only import: links replaced, sections derived from new links.
- Search-only import: engines replaced, other fields preserved.
- Partial override: only specified fields change.

Edge cases:

- Override with empty arrays → replaces with empty (intentional clear).
- Override with nested partial objects (e.g., `{ branding: { title: "New" } }`) → merges correctly, preserves unspecified nested fields.
- `collapsedSections` with duplicates and whitespace-only strings → deduplicated and filtered.
- Layout fields with non-finite numbers → falls back to base values.
- Visibility fields with non-boolean values → falls back to base values.

Integration:

- `normalizeQuotesImport` → `mergeConfig` pipeline: all input formats (array, string, object, wrapped) produce valid config.
- Full cycle: build config → export (JSON.stringify) → import (JSON.parse → mergeConfig) → verify equality.

Error paths:

- `mergeConfig(base, null)` → returns clone of base.
- `mergeConfig(base, undefined)` → returns clone of base.

### Phase 6: Quality scoring

Update `QUALITY_SCORE.md` with upgraded grades:

- Link rendering: C → A (DOM rendering + pure functions + edge cases + error paths).
- Backgrounds: C → A (DOM rendering + asset merging + edge cases + error paths).
- Quotes: C → A (DOM rendering + normalize + edge cases + error paths).
- Import/Export: C → A (round-trip + merge + integration pipeline + error paths).

Update notes to reflect what's blocking A→A+ (module split / tech debt #1).

## Alternatives considered

| Option                                 | Pros                              | Cons                                                         | Decision                                                           |
| -------------------------------------- | --------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| jsdom / happy-dom                      | Full DOM API, realistic           | New dependency, heavier, framework creep                     | Rejected — violates no-new-frameworks constraint                   |
| Minimal mock elements                  | Zero dependencies, fast, targeted | Not a real DOM — edge cases may diverge                      | **Chosen** — sufficient for our rendering functions                |
| Snapshot testing                       | Easy to write                     | Brittle, doesn't verify behavior                             | Rejected — structural assertions are more meaningful               |
| Target B, save A for post-module-split | Less work now                     | Delays quality; A is achievable now with edge/error coverage | Rejected — A is defined as "excellent within current architecture" |

## Risks and mitigations

| Risk                                                                | Mitigation                                                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Mock DOM diverges from real DOM behavior                            | Keep mocks minimal — only properties our code actually uses. Document assumptions.           |
| `renderSections` depends on `isRearranging` global (defaults false) | Test with default state; note this as known limitation in quality notes.                     |
| `renderSections` calls `resolveFavicon` (async, uses fetch)         | Default fetch mock rejects; `resolveFavicon` resolves gracefully. Icon src stays at default. |
| `renderBackground` calls `applyGradientMode` (internal)             | This exercises more code — good. If it fails, we mock minimally.                             |
| Edge case tests may be brittle if they over-specify DOM structure   | Assert on behavior (text content, classes, attributes) not structure (exact child count).    |

## Acceptance criteria

- [x] Document mock enhanced with element tracking (children, classList, dataset, textContent, innerHTML, hidden, style, href, src, etc.).
- [x] `renderQuote` has happy path, edge case, XSS safety, and error path tests.
- [x] `renderSections` has happy path, edge case (collapse, defaults, missing fields), and error path tests.
- [x] `renderBackground` has happy path, edge case (empty, missing mode), and error path tests.
- [x] `mergeConfig` has comprehensive round-trip, edge case, and integration pipeline tests.
- [x] All tests pass via `npm test`.
- [x] QUALITY_SCORE.md updated — all four C domains upgraded to A.
- [x] No runtime code changes to script.js or any extension file.

## Test plan

- `npm test` passes with all new tests.
- `npm run lint` still passes.
- Pre-commit and pre-push hooks pass.

## Rollout / migration plan

- All work on `feature/dom-test-coverage` branch.
- No runtime code changes — extension behavior is unaffected.
- Merge to `main` via PR after all acceptance criteria met.
- After this plan completes, discuss tech debt #1 (module split) as the next major effort.

## Progress log

(append-only, dated)

- 2026-03-13: Plan created. Branch `feature/dom-test-coverage` created. Completed test-coverage-expansion plan moved to `completed/`.
- 2026-03-13: Updated target from B to A. Defined A-grade rubric: happy path + edge cases + error paths + negative tests + integration coverage, all achievable within current single-file architecture.
- 2026-03-13: All phases complete. 74 new tests across 4 files (render-quotes, render-sections, render-background, import-export). Total: 192 tests, all passing. All 4 C domains upgraded to A. All quality gates pass (lint, format, tests). Zero runtime code changes.

## Decision log

(append-only, dated)

- 2026-03-13: Chose minimal mock elements over jsdom/happy-dom — no new dependencies, sufficient for the rendering functions we're testing, consistent with project's no-new-frameworks constraint.
- 2026-03-13: A-grade target defined as "excellent within current architecture." Module split (tech debt #1) is not a prerequisite — it becomes the natural next discussion after this plan completes.
