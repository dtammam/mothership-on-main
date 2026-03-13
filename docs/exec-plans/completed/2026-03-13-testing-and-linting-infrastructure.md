# Execution Plan: Testing and Linting Infrastructure

**Created:** 2026-03-13
**Status:** Not started (planned for next feature branch after harness merge)

## Goal

Establish automated testing, linting, and formatting for the Mothership on Main codebase so that quality gates in git hooks have real enforcement power.

## Non-goals

- Rewriting existing application logic (this plan is infrastructure only).
- Achieving 100% coverage immediately — focus on critical paths first.
- Introducing a build step or bundler.

## Constraints

- No new frameworks or dependency chains beyond dev tooling.
- Must work in both local development and CI (GitHub Actions).
- Must not affect the extension's runtime behavior — tooling is dev-only.
- Tests must run without a real Chrome extension context (mock `chrome.storage` APIs).

## Current state

- **Testing:** Manual UI checklist + storage harness (`tests/storage-harness.html`). No automated test runner.
- **Linting:** None. No ESLint, no Prettier, no config.
- **Formatting:** None. Inconsistent style enforced only by convention.
- **Git hooks:** JSON validation and basic `node --check` syntax only.
- **CI:** Packaging only (`edge-packages.yml`). No test or lint step.

## Proposed approach

### Phase 1: Package manager and dev dependencies

- Initialize `package.json` (dev dependencies only — not shipped in extension).
- Add ESLint with a sensible config (no TypeScript, browser globals).
- Add Prettier for consistent formatting.
- Add `.gitignore` entry for `node_modules/`.

### Phase 2: Test runner

- Add a lightweight test framework (e.g., Vitest or Jest) configured for plain JS.
- Create mock for `chrome.storage` API surface.
- Write initial tests for the storage module (save/load round-trip, chunking, migration, corruption handling).
- Port storage harness test scenarios to automated tests.

### Phase 3: Hook and CI integration

- Update `hooks/pre-commit` to run lint + format check.
- Update `hooks/pre-push` to run full test suite.
- Add lint + test steps to GitHub Actions workflow.
- Add docs-only skip condition to CI so merges touching only docs/harness files do not trigger packaging or release creation.

### Phase 4: Coverage expansion

- Add tests for config validation, search, UI rendering helpers.
- Establish coverage baseline and track in `QUALITY_SCORE.md`.

## Alternatives considered

| Option                       | Pros                       | Cons                                                  | Decision                                     |
| ---------------------------- | -------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| Deno test runner             | No package.json needed     | Less ecosystem support, team unfamiliarity            | Rejected                                     |
| Browser-based test page only | Works in extension context | Can't run in CI headless easily                       | Keep existing harness, add Node-based runner |
| TypeScript migration         | Type safety                | Requires build step, violates no-framework constraint | Rejected                                     |

## Risks and mitigations

| Risk                                            | Mitigation                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| `package.json` confuses the extension packaging | Ensure `node_modules/` and dev configs are excluded from extension zips |
| ESLint rules too aggressive on existing code    | Start with relaxed config, tighten incrementally                        |
| Chrome API mocking is incomplete                | Build mock incrementally, starting with `chrome.storage.sync` only      |

## Acceptance criteria

- [x] `npm run lint` passes on all JS files with zero warnings.
- [x] `npm run format:check` confirms all files match Prettier config.
- [x] `npm test` runs and passes with at minimum storage module coverage.
- [x] `hooks/pre-commit` runs lint + format check.
- [x] `hooks/pre-push` runs full test suite.
- [x] CI workflow includes lint + test steps.
- [x] CI workflow skips packaging for docs-only merges.
- [x] `QUALITY_SCORE.md` updated with initial grades.
- [x] Tech debt items #2 and #3 closed.

## Test plan

- Verify hooks block bad commits (introduce a lint error, confirm pre-commit rejects).
- Verify CI fails on lint/test failure (push a failing test to a branch, confirm Actions fails).
- Verify existing storage harness still works alongside new automated tests.

## Rollout / migration plan

- Implement on a dedicated feature branch (`feature/testing-infrastructure`).
- No runtime code changes — extension behavior is unaffected.
- Merge to `main` via PR after all acceptance criteria met.

## Progress log

(append-only, dated)

- 2026-03-13: Phase 1 complete — package.json, ESLint (flat config), Prettier, .gitignore updated. All JS files pass lint with zero warnings; all files match Prettier format.
- 2026-03-13: Phase 2 complete — Vitest runner, chrome.storage mock, 23 storage tests (save/load round-trip, chunking, corruption, merge, split). All pass.
- 2026-03-13: Phase 3 complete — hooks/pre-commit runs lint+format, hooks/pre-push runs lint+format+tests. CI workflow has quality-gate job (lint+format+test) and docs-only skip for packaging.
- 2026-03-13: Phase 4 complete — Added config-validation.test.js (12 more tests, 35 total). QUALITY_SCORE.md graded config management as B.

## Decision log

(append-only, dated)

- 2026-03-13: Chose ESLint flat config (.mjs) over legacy .eslintrc to align with ESLint v9+ default. Avoids `"type": "module"` in package.json which could confuse extension packaging.
- 2026-03-13: Chose Vitest over Jest — lighter, faster, native ESM support, no babel needed.
- 2026-03-13: Used `vm.createContext` sandbox to load script.js globals into test environment rather than refactoring to ES modules (which would be a runtime code change violating plan constraints).
- 2026-03-13: Docs-only CI skip uses git diff heuristic (compare HEAD~1) rather than path filters in `on.push.paths`, because path filters would prevent the workflow from running at all — we still want quality-gate to run on every push.
- 2026-03-13: Minimal lint fixes to script.js (unused catch vars → `_error` prefix, unused param → `_pendingPayload`) — cosmetic only, no behavioral change.
