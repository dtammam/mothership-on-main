# Quality Score

Grades each major domain by architectural layer.

Scale: A (strong) — F (unacceptable)

Layers: Types, Storage, UI, Styling, Tests

**Last updated:** 2026-03-13

## Domains

| Domain            | Types | Storage | UI  | Styling | Tests | Overall |
| ----------------- | ----- | ------- | --- | ------- | ----- | ------- |
| Config management | —     | B       | —   | —       | B     | B       |
| Link rendering    | —     | —       | —   | —       | C     | C       |
| Search            | —     | —       | —   | —       | —     | —       |
| Customize panel   | —     | —       | —   | —       | —     | —       |
| Backgrounds       | —     | —       | —   | —       | C     | C       |
| Quotes            | —     | —       | —   | —       | C     | C       |
| Import/Export     | —     | —       | —   | —       | C     | C       |
| Drag & reorder    | —     | —       | —   | —       | —     | —       |

_Remaining grades to be assigned as test coverage expands._

## Systemic gaps

- No TypeScript — no static type checking (accepted constraint).
- All logic in single `js/script.js` — no module boundaries (tech debt #1).
- UI rendering functions untested — requires DOM mocking (future phase).
- FOUC on load — tech debt #4.

## Notes

This file is allowed to be uncomfortable.
If a grade is C/D/F, the next action must be concrete.

Config management graded B: full round-trip save/load/merge/split coverage (118 tests total),
but depends on globals and a single-file architecture that limits testability.

Link rendering graded C (Tests): pure data functions tested (ensureLinkIds, deriveSections,
isDataUrl, applyLocalAssets), but no DOM rendering tests yet. Next: DOM mock for renderSections.

Backgrounds graded C (Tests): applyLocalAssets covers local/sync background merging,
isDataUrl covers data URI detection. No rendering or upload tests. Next: DOM tests.

Quotes graded C (Tests): normalizeQuotesImport tested with all input formats (array, string,
object). No rendering or random-selection tests. Next: renderQuote DOM tests.

Import/Export graded C (Tests): normalizeQuotesImport tested. Full import/export flow
(JSON round-trip) not yet covered. Next: end-to-end import/export tests.
