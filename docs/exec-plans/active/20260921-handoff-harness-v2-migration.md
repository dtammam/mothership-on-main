# handoff-harness v1 → v2.3.0 migration

---

status: In review
anchor: outcome
gate: APPROVED @572ea2f
branch: infra/handoff-harness-v2
base: 6863e26
reviewed: 572ea2f

---

Reconstructed acceptance for the change already committed as
`d48cafa infra: migrate handoff-harness v1 → v2.3.0` (PR #21). The commit landed
outside the flow — this is the harness installing itself — so this doc is written
after the fact to give the gate a contract to judge against and a place for the
bound verdicts. The reviewed sha is `d48cafa`; verdicts bind to it. Per the
config-data-sacred non-negotiable, "no user state lost" is a hard acceptance
criterion, not a nicety.

## Acceptance

1. **Self-consistent & self-describing.** `AGENTS.md` is the canonical entry
   point and `CLAUDE.md` is a thin wrapper pointing to it; `flow.md`,
   `gate-protocol.md`, `scrutiny.toml`, and every installed `/command` + `/agent`
   exist and agree — no command references a seat, file, or script that isn't
   installed, and `manifest.lock` matches the actual footprint on disk.

2. **No user-owned state lost.** The v1 legacy agents/commands/state are
   _relocated_ (renamed) under `.state/plans/legacy/20260921-000926/`, not
   deleted; `.claude/settings.json`, `.vscode/tasks.json`, and `.prettierignore`
   changes preserve prior working capability rather than silently dropping it;
   content removed from `CLAUDE.md` is superseded by `AGENTS.md`, not lost.

3. **The machinery runs.** `check-markers.sh` and `apply-regions.sh` execute
   without error and behave as their headers claim; the `session-start.sh` hook
   is safe and does what `settings.json` wires it to; all harness markers/regions
   in the shipped docs are well-formed (`check-markers.sh` exits 0).

## Named attack surfaces

- **Shell logic:** `check-markers.sh` (frontmatter parsing, sha/staleness/merged
  checks, globbing, exit codes), `apply-regions.sh` (in-place file mutation),
  `session-start.sh` (auto-executed hook — arbitrary shell on every session
  start).
- **Config integrity:** `settings.json`, `.vscode/tasks.json`, `.prettierignore`
  — verify no capability was silently removed vs the base.
- **Data-loss:** legacy files moved-not-deleted; `CLAUDE.md` rewrite drops
  nothing user-owned.
- **Self-consistency:** `manifest.lock` vs actual tree; commands referencing
  agents/files that exist; markers/regions valid.
- **Doc-claims-vs-tree:** `AGENTS.md` / `flow.md` / `gate-protocol.md` describe
  the system that is actually installed.

## Gate

Seats: adversary (floor) + qa (escalated — shell logic to run/mutate +
config-loss risk). security-brief runs as a standing section within both, not as
a dedicated seat (no auth/secret/network/dep surface). Verdicts below, each bound
to the reviewed sha.

qa findings (disclosed, non-blocking):

- WARNING AGENTS.md:65 — index row claims `docs/CONTRIBUTING.md` carries "the
  project's build/test/lint commands"; it carries none. The runnable commands
  live only in `package.json` scripts. Old `CLAUDE.md`'s "Commands" section was
  dropped and is not superseded where AGENTS.md points. Recoverable from
  package.json → safe to ship disclosed; fix by adding commands to CONTRIBUTING
  or pointing AGENTS.md at package.json.
- SUGGESTION .harness/lib/apply-regions.sh:35 — region id used unsanitized as a
  temp filename; a crafted id with path separators in LOCAL could write outside
  the temp dir on update. Unreachable in shipped wiring (not auto-run; operates
  on the user's own repo), so no live surface.

### Live verdicts — bound to the shipped sha `572ea2f`

Gate: APPROVED r3 @572ea2f — adversary

Gate: APPROVED r3 @572ea2f — qa

### Superseded rounds (audit history)

Earlier verdicts, each re-gated after a fix — kept for the record, no longer live
(written without the `Gate:`/`@sha` marker form so the stale-approval checker
does not flag superseded shas):

- r1, sha d48cafa — both seats approved; superseded by the r2 fix that added the
  CONTRIBUTING.md Commands section (addressing the AGENTS.md:65 doc drift both
  seats flagged).
- r2, sha 28e85e3 — both seats approved; superseded by the r3 fix that added
  `yaml` to the format:check description (the adversary's r2 cosmetic nit).
