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

### Phase 4: Coverage expansion
- Add tests for config validation, search, UI rendering helpers.
- Establish coverage baseline and track in `QUALITY_SCORE.md`.

## Alternatives considered

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Deno test runner | No package.json needed | Less ecosystem support, team unfamiliarity | Rejected |
| Browser-based test page only | Works in extension context | Can't run in CI headless easily | Keep existing harness, add Node-based runner |
| TypeScript migration | Type safety | Requires build step, violates no-framework constraint | Rejected |

## Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| `package.json` confuses the extension packaging | Ensure `node_modules/` and dev configs are excluded from extension zips |
| ESLint rules too aggressive on existing code | Start with relaxed config, tighten incrementally |
| Chrome API mocking is incomplete | Build mock incrementally, starting with `chrome.storage.sync` only |

## Acceptance criteria

- [ ] `npm run lint` passes on all JS files with zero warnings.
- [ ] `npm run format:check` confirms all files match Prettier config.
- [ ] `npm test` runs and passes with at minimum storage module coverage.
- [ ] `hooks/pre-commit` runs lint + format check.
- [ ] `hooks/pre-push` runs full test suite.
- [ ] CI workflow includes lint + test steps.
- [ ] `QUALITY_SCORE.md` updated with initial grades.
- [ ] Tech debt items #2 and #3 closed.

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

## Decision log

(append-only, dated)
