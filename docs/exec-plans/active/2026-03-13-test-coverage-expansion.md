# Execution Plan: Test Coverage Expansion

**Created:** 2026-03-13
**Status:** In progress

## Goal

Expand automated test coverage from config management only (35 tests) to all pure/testable utility functions across every domain in QUALITY_SCORE.md. Grade each newly tested domain.

## Non-goals

- UI/DOM rendering tests (requires full DOM mocking — future phase).
- Refactoring `script.js` into modules (tech debt #1 — separate effort).
- Changing any runtime behavior.

## Constraints

- No runtime code changes to `js/script.js` or the extension.
- Tests must run via `npm test` (Vitest, existing infrastructure).
- Use the existing `vm.createContext` sandbox approach from `tests/helpers/load-script.js`.
- Test functions via `env.globals.<functionName>` (top-level `function` declarations are properties of the VM sandbox context).

## Current state

- **35 tests** across 2 test files: `storage.test.js` and `config-validation.test.js`.
- Only **Config management** domain is graded (B) in QUALITY_SCORE.md.
- All candidate functions are top-level `function` declarations in `script.js` — accessible via the sandbox without extraction.
- Constants declared with `const` are NOT accessible on the sandbox, but we can test behavior with known inputs.

## Proposed approach

### Phase 1: Storage utility tests

Test the low-level chunking and quota functions:

- `hashString` — deterministic hash, consistency, edge cases (empty string, unicode)
- `padChunkIndex` — zero-padding to 3 digits
- `chunkStringBySize` — string splitting at exact boundaries
- `buildV2ChunkKeys` — key generation with correct prefix and padding
- `calculatePayloadBytes` — byte counting accuracy
- `collectChunks` — chunk reassembly from prefix/count
- `estimateSyncUsage` — usage estimation mirrors chunking behavior
- `preflightV2Payload` — quota validation (per-item and total limits)

### Phase 2: Config utility tests

Test config manipulation and data integrity functions:

- `isDataUrl` — data URI detection
- `ensureLinkIds` — ID assignment (preserves existing, generates missing)
- `applyLocalAssets` — local asset overlay on synced config
- `deriveSections` — section ordering from links and existing sections
- `normalizeQuotesImport` — flexible quote import parsing (array, string, object)

### Phase 3: Display utility tests

- `timeAgo` — relative time formatting (just now, minutes, hours, days)
- `applyVisibility` — DOM element visibility toggling (uses mock document)

### Phase 4: Quality scoring

- Update QUALITY_SCORE.md with grades for each newly covered domain.

## Alternatives considered

| Option                                   | Pros                              | Cons                                                            | Decision                                   |
| ---------------------------------------- | --------------------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| Extract to `js/utils.js`                 | Clean module boundary, importable | Runtime change (new `<script>` tag), touches tech debt #1 scope | Deferred — do this as part of tech debt #1 |
| Expose functions on `window.msomStorage` | Explicit test API                 | Pollutes public API, runtime change                             | Rejected                                   |
| Test via VM sandbox `globals`            | Zero runtime changes, works today | Constants not accessible (test behavior instead)                | **Chosen**                                 |

## Risks and mitigations

| Risk                                                            | Mitigation                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Functions depend on constants not accessible in tests           | Test observable behavior with known inputs, not constant values           |
| `ensureLinkIds` calls `createId` which uses `crypto.randomUUID` | Sandbox already provides `crypto` global — verify UUIDs are generated     |
| `applyVisibility` needs DOM elements                            | Enhance document mock minimally to return elements with `hidden` property |

## Acceptance criteria

- [x] Storage utility functions have comprehensive tests (hashString, padChunkIndex, chunkStringBySize, buildV2ChunkKeys, calculatePayloadBytes, collectChunks, estimateSyncUsage, preflightV2Payload).
- [x] Config utility functions have comprehensive tests (isDataUrl, ensureLinkIds, applyLocalAssets, deriveSections, normalizeQuotesImport).
- [x] Display utility functions have tests (timeAgo, applyVisibility).
- [x] All tests pass via `npm test`.
- [x] QUALITY_SCORE.md updated with grades for newly tested domains.
- [x] No runtime code changes to script.js or any extension file.

## Test plan

- `npm test` passes with all new tests.
- `npm run lint` still passes.
- Pre-commit and pre-push hooks pass.

## Rollout / migration plan

- All work on `feature/test-coverage-expansion` branch.
- No runtime code changes — extension behavior is unaffected.
- Merge to `main` via PR after all acceptance criteria met.

## Progress log

(append-only, dated)

- 2026-03-13: Plan created. Moved completed testing-infrastructure plan to `completed/`. Branch created.
- 2026-03-13: Phases 1-3 complete. 83 new tests across 3 files (storage-utils, config-utils, display-utils). Total: 118 tests, all passing. QUALITY_SCORE.md updated with grades for Link rendering (C), Backgrounds (C), Quotes (C), Import/Export (C). All quality gates pass.

## Decision log

(append-only, dated)

- 2026-03-13: Chose VM sandbox `globals` approach over extracting to utils.js — zero runtime changes, all `function` declarations are accessible as sandbox properties. Extraction deferred to tech debt #1 module split.
