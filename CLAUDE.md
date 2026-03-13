# CLAUDE.md

This file is the Claude Code entry point for this repo. It is intentionally thin.
The real sources of truth live in `docs/`. Read them, not this file.

## Session protocol

Every conversation follows this sequence. No exceptions.

### On start (before writing any code)

1. Read the SessionStart hook output (branch, active plans, tech debt count).
2. Read `docs/index.md` → `docs/CONTRIBUTING.md` (design principles + coding standards).
3. If active exec plans exist, read them. Understand what's in progress before starting new work.
4. If the user's request overlaps with an active plan or tech debt item, say so.
5. For new work: use `/kickoff` (simple) or `/kickoff-complex` (multi-domain). Do not start coding without a brief or plan.

### During work

- Follow `docs/CONTRIBUTING.md` design principles on every change.
- Respect performance budgets (`docs/RELIABILITY.md`) and layer boundaries.
- Update the active plan's progress log after each meaningful milestone (append-only, dated).

### On finish (before the conversation ends)

- If behavior changed, update exactly one doc (see "Change hygiene" below).
- If debt was created, add it to `docs/exec-plans/tech-debt-tracker.md`.
- If a plan was completed, check all acceptance criteria, move to `completed/`, update this file's plan list.
- Run quality gates and confirm they pass.

## Reference docs

Read these before touching any code:

1. `docs/index.md` — knowledge map
2. `docs/ARCHITECTURE.md` — system design, data model, repo layout
3. `docs/RELIABILITY.md` — performance budgets and invariants (treat as non-negotiable)
4. `docs/CONTRIBUTING.md` — design principles and coding standards
5. `docs/PLANS.md` — when and how to write execution plans

For active work in progress: `docs/exec-plans/active/`
For tech debt: `docs/exec-plans/tech-debt-tracker.md`

## Non-negotiables (hard stops)

Do not compromise these regardless of what a task seems to require:

- **Config data fidelity** — User configuration data is sacred. Never remove, overwrite, or corrupt existing bookmarks, links, quotes, backgrounds, or settings during upgrades or migrations. Backwards compatibility with stored configs is mandatory. Addition is fine; removal or mutation of user data is not.
- **Performance budgets** — defined in `docs/RELIABILITY.md`. Flag regressions before proceeding.
- **No silent failures** — Every storage write, config migration, or data operation must surface errors explicitly. Never silently "pretend saved." Zero surprises.
- **No visual jank** — No FOUC (flash of unstyled/default content), no flickering, no layout shifts. The extension must feel polished and professional on every load.
- **No new frameworks** — No bundlers, no TypeScript, no build tooling, no dependency chains. This is plain HTML + CSS + JavaScript.
- **Release process** — Changes ship through a defined release process. No ad-hoc deploys.

## Coding standards

These apply to every change, no exceptions:

- No silent catch blocks — every catch must at minimum log and surface the error.
- No fire-and-forget async — all async writes must have error handling.
- Prefer `async`/`await` over raw promise chains.
- Keep functions small, pure where possible. Avoid global state.
- Centralize storage keys and constants — no magic strings scattered across files.
- Add a short intent comment atop new functions so purpose is clear at a glance.
- Validate at system boundaries (user input, storage reads, external data).
- Log milestone changes in `PROGRESS.md` as single-line, timestamped entries.

## Workflow

### Small changes

Make the change, update exactly one doc if behavior changed, write a test.

### Complex changes (multi-domain, data model, operational risk)

Write an execution plan first:

- Create `docs/exec-plans/active/<yyyy-mm-dd>-<short-title>.md`
- Use the template in `docs/PLANS.md`
- Do not write significant code until the plan is in place

### Change hygiene

When behavior changes, update exactly one of:

- `docs/RELIABILITY.md` — if it affects budgets or reliability rules
- `docs/ARCHITECTURE.md` — if it affects domains or system design
- `docs/exec-plans/tech-debt-tracker.md` — if it creates debt

## Quality gates (do not bypass)

- `pre-commit`: JSON validation (config.json, manifest.json), basic JS syntax check
- `pre-push`: full quality gate (once test runner is implemented)
- Never use `--no-verify`. If a hook fails, fix the root cause.

## Commands

Prefer repo scripts over ad-hoc commands.

```
# Load as unpacked extension in Edge/Chrome for manual testing
# Run storage harness: open tests/storage-harness.html in extension context

# Release packaging (PowerShell — see scripts/)
pwsh scripts/package-edge.ps1
```

## Exec plan ownership

Active plans currently in progress:

- `2026-03-13-module-split.md` — split monolithic script.js into focused modules (tech debt #1)

Completed plans:

- `2026-03-13-dom-test-coverage.md` — DOM rendering tests, all C domains upgraded to A
- `2026-03-13-test-coverage-expansion.md` — expand automated test coverage across all domains
- `2026-03-13-testing-and-linting-infrastructure.md` — establish test runner, linter, and formatter

Append to the progress log (dated, append-only) when making meaningful advances on a plan.
Do not rewrite or summarize away prior log entries.
