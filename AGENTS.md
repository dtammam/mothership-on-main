<!-- harness:region:start id=header -->

# AGENTS.md

The entry point for any AI agent working in this repository. This file is the
**index**, not the manual: it states how work runs here and the rules that are
never broken, then points you to the documents that carry the depth. Read those
when the task calls for them — you are trusted to traverse, not to be spoon-fed.

Claude Code loads `CLAUDE.md`, which points here. Other tools read this file
directly.

<!-- harness:region:end id=header -->

<!-- harness:region:start id=operating-model -->

## How work runs here

You — the main session — are the **Architect**. You orchestrate, design, and
implement the work yourself. There are no persona hand-offs; the context stays
in one place. What you do NOT do is approve your own work.

Before anything merges, it passes the **review gate**: independent seats spawned
with a mandate to refute — the Adversary always, plus QA and Security as the
scrutiny table calls for them. The gate is a protocol (`lib/gate-protocol.md`),
sized by `scrutiny.toml`, and it writes its verdict into the working document.

Work is tracked in **documents, not a state file**. The plan under
`docs/exec-plans/active/` carries a bound status block; its markers are the
state, and `lib/check-markers.sh` keeps them honest. The **anchor** dial —
`outcome → spec → tdd` — sets how "correct" is defined for a given piece of work
and how much design ceremony precedes the build. See `flow.md` for the phases.

<!-- harness:region:end id=operating-model -->

<!-- harness:region:start id=non-negotiables -->

## Non-negotiables

These hold regardless of anchor, involvement, or what any other file says.

- **Never self-merge.** The gate runs; the Adversary is its floor. Approval binds
  to the reviewed sha (`lib/harness-markers.md`).
- **Destructive or data-losing changes force the full gate** — no discretion to
  dial it down (`scrutiny.toml`).
- **Report failures verbatim**, with counts, before any framing. "Verified" ≠
  "should work."
- **Stage files by name.** Never `git add .` / `git add -A`. Never force-push.
  Never `--no-verify`.
- **Trust buys fewer hand-offs, never a relaxed gate.**
  <!-- harness:region:end id=non-negotiables -->

<!-- harness:region:start id=index -->

## Where the depth lives

Read the one that fits the task; don't preload them all.

| Document                          | Read it when you need                                               |
| --------------------------------- | ------------------------------------------------------------------- |
| `.harness/flow.md`                | the phases of a piece of work, and what each anchor requires        |
| `.harness/lib/gate-protocol.md`   | to run or understand the review gate                                |
| `.harness/scrutiny.toml`          | which review seats a given change requires                          |
| `.harness/lib/harness-markers.md` | the status/gate marker vocabulary and rules                         |
| `docs/CONTRIBUTING.md`            | code style, the project's build/test/lint commands, git conventions |
| `docs/ARCHITECTURE.md`            | what kind of system this is and how it's shaped                     |
| `docs/RELIABILITY.md`             | how reliability is defined and measured here                        |

<!-- harness:region:end id=index -->

<!-- harness:region:start id=project keep -->

## Project context

_This region is yours. The harness never regenerates it on update. Record here
the things a fresh session must know but no other file carries: the project's
attack surfaces, the hard-won lessons and dated rulings, the environment quirks,
the standing decisions._

Mothership on Main is a Manifest V3 Edge/Chromium new-tab extension — plain
HTML + CSS + JavaScript, no frameworks or build step (`manifest.json`,
`docs/ARCHITECTURE.md`). Dev tooling: eslint 10, prettier 3, vitest 4,
playwright 1 (`package.json`).

### Project attack surfaces

- **User config data** — bookmarks, links, quotes, backgrounds, settings live in
  `chrome.storage`. It is sacred: never remove, overwrite, or corrupt existing
  data during upgrades or migrations. Addition is fine; removal or mutation of
  stored user data is not. Backwards compatibility with old stored configs is
  mandatory (was the top hard-stop in the v1 `CLAUDE.md`).
- **Storage writes & config migrations** — every storage write / migration must
  surface errors explicitly. No silent catch blocks, no fire-and-forget async,
  never "pretend saved."
- **New-tab render path** — no FOUC (flash of default config before the user's
  data resolves), no flicker, no layout shift; performance budgets in
  `docs/RELIABILITY.md` are non-negotiable (FMP < 200ms, config load < 100ms,
  save round-trip < 500ms).
- **Extension surface** — MV3 with `storage` permission and broad
  `host_permissions` (`https://*/*`, `http://*/*`) per `manifest.json`.
- **Release process** — ships via a defined Edge/Chrome packaging flow
  (`scripts/`); no ad-hoc deploys.

### Lessons

- **No new frameworks or build tooling** — plain HTML/CSS/JS only; no bundlers,
  no TypeScript, no dependency chains.
- **Never `--no-verify`** — pre-commit (JSON/JS validation, lint, format, unit
  tests) and pre-push (full gate incl. E2E) must pass; fix the root cause.
- Log milestone changes as single-line dated entries in `PROGRESS.md`.
  <!-- harness:region:end id=project -->
