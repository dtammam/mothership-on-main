# Quality Score

Grades each major domain by architectural layer.

Scale: A (strong) — F (unacceptable)

Layers: Types, Storage, UI, Styling, Tests

**Last updated:** 2026-03-13

## Domains

| Domain            | Types | Storage | UI  | Styling | Tests | Overall |
| ----------------- | ----- | ------- | --- | ------- | ----- | ------- |
| Config management | —     | B       | —   | —       | A     | A       |
| Link rendering    | —     | —       | —   | —       | A     | A       |
| Search            | —     | —       | —   | —       | C     | C       |
| Customize panel   | —     | —       | —   | —       | D     | D       |
| Backgrounds       | —     | —       | —   | —       | A     | A       |
| Quotes            | —     | —       | —   | —       | A     | A       |
| Import/Export     | —     | —       | —   | —       | A     | A       |
| Drag & reorder    | —     | —       | —   | —       | D     | D       |

_Module split complete (tech debt #1 closed). True unit isolation now possible._

## Systemic gaps

- No TypeScript — no static type checking (accepted constraint).
- FOUC on load — tech debt #4.

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

Search graded C (Tests): collectSearch tested indirectly via import-export round-trips and
search-only import mode. No direct tests for renderSearch DOM rendering or engine row
management. Next: add renderSearch DOM tests and collectSearch unit tests.

Customize panel graded D (Tests): no direct tests for setupSettings, renderSettings, or
any editor renderer. These are heavily DOM-dependent and were not testable pre-split.
Next: add DOM tests for editor renderers (renderLinksEditor, renderBackgroundsEditor, etc.).

Drag & reorder graded D (Tests): no direct tests for findReorderTarget, setRearrangeMode,
updateLinkRowDragState, or any drag event handlers. Next: add unit tests for
findReorderTarget and setRearrangeMode with DOM mocks.
