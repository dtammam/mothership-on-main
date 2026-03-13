# Quality Score

Grades each major domain by architectural layer.

Scale: A (strong) — F (unacceptable)

Layers: Types, Storage, UI, Styling, Tests

**Last updated:** 2026-03-13

## Domains

| Domain            | Types | Storage | UI  | Styling | Tests | Overall |
| ----------------- | ----- | ------- | --- | ------- | ----- | ------- |
| Config management | —     | B       | —   | —       | B     | B       |
| Link rendering    | —     | —       | —   | —       | A     | A       |
| Search            | —     | —       | —   | —       | —     | —       |
| Customize panel   | —     | —       | —   | —       | —     | —       |
| Backgrounds       | —     | —       | —   | —       | A     | A       |
| Quotes            | —     | —       | —   | —       | A     | A       |
| Import/Export     | —     | —       | —   | —       | A     | A       |
| Drag & reorder    | —     | —       | —   | —       | —     | —       |

_Remaining grades to be assigned as test coverage expands._

## Systemic gaps

- No TypeScript — no static type checking (accepted constraint).
- All logic in single `js/script.js` — no module boundaries (tech debt #1).
- FOUC on load — tech debt #4.

## Notes

This file is allowed to be uncomfortable.
If a grade is C/D/F, the next action must be concrete.

A-grade definition (current architecture): happy path + edge cases + error paths + negative
tests + integration coverage. True unit isolation blocked on tech debt #1 (module split).

Config management graded B: full round-trip save/load/merge/split coverage (192 tests total),
but depends on globals and a single-file architecture that limits testability.
Next: upgrade to A after module split enables isolated unit tests.

Link rendering graded A (Tests): pure data functions tested (ensureLinkIds, deriveSections,
isDataUrl, applyLocalAssets) plus renderSections DOM tests — section structure, link cards,
collapse state, edge cases (empty links, missing sections, default section), and error paths.
Remaining gap: module isolation (tech debt #1).

Backgrounds graded A (Tests): applyLocalAssets covers local/sync background merging,
isDataUrl covers data URI detection, renderBackground DOM tests cover images mode,
blur mode, all 8 gradient modes, empty backgrounds, missing mode defaults, and CSS
custom property assertions. Remaining gap: module isolation (tech debt #1).

Quotes graded A (Tests): normalizeQuotesImport tested with all input formats (array, string,
object). renderQuote DOM tests cover empty quotes, single/multiple quotes, XSS safety
(textContent vs innerHTML), long strings, special characters, and missing DOM element error path.
Remaining gap: module isolation (tech debt #1).

Import/Export graded A (Tests): full JSON round-trip (export → import → verify), idempotency,
save/load round-trip, splitConfig → applyLocalAssets reconstruction, quotes/links/search-only
import modes, normalizeQuotesImport → mergeConfig pipeline, edge cases (empty arrays,
partial overrides, NaN/Infinity layout values, non-boolean visibility, whitespace-only
collapsedSections, deduplication). Remaining gap: module isolation (tech debt #1).
