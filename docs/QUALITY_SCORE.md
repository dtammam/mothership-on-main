# Quality Score

Grades each major domain by architectural layer.

Scale: A (strong) — F (unacceptable)

Layers: Types, Storage, UI, Styling, Tests

**Last updated:** 2026-03-14

## Domains

| Domain            | Types | Storage | UI  | Styling | Tests | Overall |
| ----------------- | ----- | ------- | --- | ------- | ----- | ------- |
| Config management | —     | B       | —   | —       | A     | A       |
| Link rendering    | —     | —       | —   | —       | A     | A       |
| Search            | —     | —       | —   | —       | A     | A       |
| Customize panel   | —     | —       | —   | —       | A     | A       |
| Backgrounds       | —     | —       | —   | —       | A     | A       |
| Quotes            | —     | —       | —   | —       | A     | A       |
| Import/Export     | —     | —       | —   | —       | A     | A       |
| Drag & reorder    | —     | —       | —   | —       | A     | A       |

_All domains at A-grade. Module split + DOM mock extensions enable full unit isolation._

## Systemic gaps

- No TypeScript — no static type checking (accepted constraint).

## Notes

This file is allowed to be uncomfortable.
If a grade is C/D/F, the next action must be concrete.

A-grade definition: happy path + edge cases + error paths + negative tests + integration
coverage. Module split enables isolated unit testing per module.

Config management upgraded to A: module split complete — storage.js and config.js are
isolated modules. Full round-trip save/load/merge/split coverage (192 tests total),
including v2 chunked format, quota preflight, and simulated sync.

Link rendering graded A (Tests): pure data functions tested (ensureLinkIds, deriveSections,
isDataUrl, applyLocalAssets) plus renderSections DOM tests — section structure, link cards,
collapse state, edge cases (empty links, missing sections, default section), and error paths.

Backgrounds graded A (Tests): applyLocalAssets covers local/sync background merging,
isDataUrl covers data URI detection, renderBackground DOM tests cover images mode,
blur mode, all 8 gradient modes, empty backgrounds, missing mode defaults, and CSS
custom property assertions.

Quotes graded A (Tests): normalizeQuotesImport tested with all input formats (array, string,
object). renderQuote DOM tests cover empty quotes, single/multiple quotes, XSS safety
(textContent vs innerHTML), long strings, special characters, and missing DOM element error path.

Import/Export graded A (Tests): full JSON round-trip (export → import → verify), idempotency,
save/load round-trip, splitConfig → applyLocalAssets reconstruction, quotes/links/search-only
import modes, normalizeQuotesImport → mergeConfig pipeline, edge cases (empty arrays,
partial overrides, NaN/Infinity layout values, non-boolean visibility, whitespace-only
collapsedSections, deduplication).

Search upgraded C → A (Tests): renderSearch DOM tests (engine options, default engine,
form action, queryParam), collectSearch unit tests (populated/empty editor, skipping
invalid rows, label/queryParam defaults), renderSearchEditor tests (population, default
row, default-engine select sync), addEngineRow + refreshDefaultEngineOptions integration.

Customize panel upgraded D → A (Tests): renderSettings integration (all sub-renderers),
renderLinksEditor (field values, sections, empty default, icon overrides, re-render),
renderBackgroundsEditor (populated rows, empty default, re-render),
renderQuotesEditor (join with newlines, empty, single),
renderLayoutEditor + updateLayoutControlState (resizable/defaults, disabled state),
renderVisibilityEditor + renderPrivacyEditor (config values, defaults, undefined),
renderBrandingEditor (field population, missing/undefined),
renderBackgroundModeEditor (set value, default fallback),
createLinksSection (DOM structure), ensureLinksSection (create/reuse),
link section management (refreshLinkSectionChoices, get/set/custom section value).

Drag & reorder upgraded D → A (Tests): findReorderTarget (closest above, null when
none above, skip dragging, single element, empty container, multiple above),
setRearrangeMode (CSS classes, toggle text, via init()),
updateLinkRowDragState (draggable based on rearranging state),
updateEngineRowDragState (draggable + aria-disabled),
updateMainDragState (link cards, sections, handles).
