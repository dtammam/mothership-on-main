# CLAUDE.md

This file is the Claude Code entry point for this repo. It is intentionally thin.
The real sources of truth live in `docs/`. Read them, not this file.

## What YOU (the main session) do

You are NOT any of the agents listed below. You are the user's interface.
Your only job is to:

1. Receive the user's request
2. Invoke the engineering-manager agent via the Agent tool
3. Relay the engineering-manager's output — including its routing instructions — verbatim to the user

Do NOT roleplay as the engineering-manager. Do NOT directly invoke
product-manager, principal-engineer, software-developer, or any other
agent. Always go through engineering-manager.

If you catch yourself coordinating the pipeline, reading state files,
or delegating to specialist agents directly — STOP. Invoke the EM instead.

## Agent architecture

The engineering-manager is an **advisor and state manager**, not a delegator.
It writes the specialist prompt to `.state/inbox/<agent-name>.md` and tells the
user which VS Code task to run. The user launches each specialist via
**Terminal -> Run Task...** in VS Code, which spawns a fresh Claude Code session
that reads the inbox file automatically. This keeps every agent's output directly
visible to the user — no intermediary summaries, no copy-paste.

### Agents (`.claude/agents/`)

| Agent                 | What it does                                                                                  | How to run it                                           |
| --------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `engineering-manager` | Tracks feature state, routes work to specialists, manages stage transitions                   | Invoked automatically by `/commands`                    |
| `product-manager`     | Gathers requirements + acceptance criteria (Discovery), validates delivered work (Acceptance) | VS Code task **"Run Product Manager"** or `/run-pm`     |
| `principal-engineer`  | Reads requirements and codebase, produces technical design with approach, risks, alternatives | VS Code task **"Run Principal Engineer"** or `/run-pe`  |
| `software-developer`  | Implements ONE task at a time — writes code, tests, runs quality checks                       | VS Code task **"Run Software Developer"** or `/run-sde` |
| `build-specialist`    | Runs build + test + lint + format checks, reports pass/fail (never fixes code)                | VS Code task **"Run Build Specialist"** or `/run-build` |
| `quality-assurance`   | Reviews code for correctness, security, performance, standards compliance (never fixes code)  | VS Code task **"Run Quality Assurance"** or `/run-qa`   |

### Commands (`.claude/commands/`)

Each command moves the feature one stage forward. Run them in order.

| Command                | What it does                                                                 | Then you do                                                      |
| ---------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **`/kickoff`**         | Initializes state, reads project context, summarizes starting point          | Review summary -> **`/discover`**                                |
| **`/discover`**        | Routes to PM to gather requirements and write exec plan                      | Run task **"Run Product Manager"** -> **`/design`**              |
| **`/design`**          | Routes to PE to produce technical design in exec plan                        | Run task **"Run Principal Engineer"** -> **`/tasks`**            |
| **`/tasks`**           | EM breaks design into small, testable tasks with definitions of done         | Review tasks -> **`/implement`**                                 |
| **`/implement`**       | Routes ONE task to SDE for implementation                                    | Run task **"Run Software Developer"** -> repeat or **`/verify`** |
| **`/verify`**          | Routes to build specialist to run all quality gates                          | Run task **"Run Build Specialist"** -> **`/accept`**             |
| **`/review`**          | Routes to QA for code review (optional, recommended for non-trivial changes) | Run task **"Run Quality Assurance"** -> fix or proceed           |
| **`/accept`**          | Routes to PM to validate every acceptance criterion                          | Run task **"Run Product Manager"** -> **`/done`**                |
| **`/done`**            | Archives plan, commits, pushes, creates PR, offers release tagging           | Merge PR -> **`/kickoff`** for next feature                      |
| **`/commit-only`**     | Stages and commits (no push)                                                 | --                                                               |
| **`/commit-and-push`** | Stages, commits, pushes                                                      | --                                                               |

### VS Code tasks (`.vscode/tasks.json`)

Each specialist agent has a corresponding VS Code task that spawns a fresh
Claude Code session reading from `.state/inbox/<agent-name>.md`. Run via
**Terminal -> Run Task...** in VS Code.

### Mobile workflow (Session 2)

For environments without VS Code (e.g. mobile CLI), specialist agents
can be invoked via shell scripts or slash commands instead of VS Code tasks.

**Two-session model:**

- **Session 1 (EM):** Uses existing slash commands (`/kickoff`, `/discover`, etc.) — unchanged.
- **Session 2 (Specialist workbench):** Runs specialist agents via `/run-*` commands.

| Slash command | Shell script                        | Equivalent VS Code task |
| ------------- | ----------------------------------- | ----------------------- |
| `/run-pm`     | `scripts/run-product-manager.sh`    | Run Product Manager     |
| `/run-pe`     | `scripts/run-principal-engineer.sh` | Run Principal Engineer  |
| `/run-sde`    | `scripts/run-software-developer.sh` | Run Software Developer  |
| `/run-build`  | `scripts/run-build-specialist.sh`   | Run Build Specialist    |
| `/run-qa`     | `scripts/run-quality-assurance.sh`  | Run Quality Assurance   |

Each script verifies the inbox file exists and is non-empty before invoking
`claude --agent <name> @.state/inbox/<name>.md`. If the inbox is missing,
it means the EM hasn't routed work yet — run the appropriate command in Session 1 first.

### Shared state

`.state/feature-state.json` tracks the current feature lifecycle. The
engineering-manager reads and updates it at every stage transition.

`.state/inbox/` holds ephemeral prompt files written by the EM for specialist
agents. These are `.gitignore`d — only `.gitkeep` is tracked.

### Workflow

```text
/kickoff -> /discover -> /design -> /tasks -> /implement -> /verify -> /accept -> /done
                                                ↑            |
                                                └── (next) ──┘

Optional at any point: /review (code review)
```

Every stage transition requires explicit user approval. No auto-progression.
The user runs each command manually. The engineering-manager runs ONE stage
per invocation and stops.

## Session protocol

Every conversation follows this sequence. No exceptions.

### On start (before writing any code)

1. Read `docs/index.md` → `docs/CONTRIBUTING.md` (design principles + coding standards).
2. If active exec plans exist, read them. Understand what's in progress before starting new work.
3. If the user's request overlaps with an active plan or tech debt item, say so.
4. For new work: use `/kickoff`. Do not start coding without a brief or plan.

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
- Do not write significant code until the plan is in place

### Change hygiene

When behavior changes, update exactly one of:

- `docs/RELIABILITY.md` — if it affects budgets or reliability rules
- `docs/ARCHITECTURE.md` — if it affects domains or system design
- `docs/exec-plans/tech-debt-tracker.md` — if it creates debt

## Quality gates (do not bypass)

- `pre-commit`: JSON validation (config.json, manifest.json), JS syntax check, lint, format check, unit tests
- `pre-push`: full quality gate (lint, format, unit tests, E2E tests)
- Never use `--no-verify`. If a hook fails, fix the root cause.

## Commands

Prefer repo scripts over ad-hoc commands.

```
# Lint
npx eslint js/ tests/ --no-error-on-unmatched-pattern

# Format check
npx prettier --check "**/*.{js,json,md,yml,yaml,css,html}"

# Unit tests
npx vitest run

# E2E tests
npx playwright test --reporter=line

# Load as unpacked extension in Edge/Chrome for manual testing
# Run storage harness: open tests/storage-harness.html in extension context

# Release packaging (PowerShell — see scripts/)
pwsh scripts/package-edge.ps1
```

## Exec plan ownership

Active plans currently in progress:

- `2026-03-14-design-system.md` — design system: tokenize all colors, eliminate hardcoded values, light mode, gradient-aware theming (future, not started)

Completed plans:

- `2026-03-15-whats-new.md` — "What's New" dialog: one-time post-upgrade modal with release highlights, settings footer link, accordion for past versions
- `2026-03-14-feature-batch.md` — 7 features: bookmark import, CI hooks + Playwright, open-all-links, collapse without rearrange, section select bug fix, true section hiding, version label (v1.5.0)
- `2026-03-13-module-split.md` — split monolithic script.js into 7 focused modules (tech debt #1)
- `2026-03-13-dom-test-coverage.md` — DOM rendering tests, all C domains upgraded to A
- `2026-03-13-test-coverage-expansion.md` — expand automated test coverage across all domains
- `2026-03-13-testing-and-linting-infrastructure.md` — establish test runner, linter, and formatter
- `2026-03-13-test-and-debt-sweep.md` — test coverage for Search/Customize/Drag domains + FOUC fix + cross-platform scripts

Append to the progress log (dated, append-only) when making meaningful advances on a plan.
Do not rewrite or summarize away prior log entries.
