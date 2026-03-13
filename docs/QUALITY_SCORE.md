# Quality Score

Grades each major domain by architectural layer.

Scale: A (strong) — F (unacceptable)

Layers: Types, Storage, UI, Styling, Tests

**Last updated:** 2026-03-13

## Domains

| Domain            | Types | Storage | UI  | Styling | Tests | Overall |
| ----------------- | ----- | ------- | --- | ------- | ----- | ------- |
| Config management | —     | B       | —   | —       | B     | B       |
| Link rendering    | —     | —       | —   | —       | —     | —       |
| Search            | —     | —       | —   | —       | —     | —       |
| Customize panel   | —     | —       | —   | —       | —     | —       |
| Backgrounds       | —     | —       | —   | —       | —     | —       |
| Quotes            | —     | —       | —   | —       | —     | —       |
| Import/Export     | —     | —       | —   | —       | —     | —       |
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

Config management graded B: full round-trip save/load/merge/split coverage (35 tests),
but depends on globals and a single-file architecture that limits testability.
