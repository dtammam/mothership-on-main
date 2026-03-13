# Contributing — Mothership on Main

## Software design principles

These apply to every change. They are not aspirational — they are the standard.

1. **Single responsibility** — every function, module, and file does one thing well.
2. **Small, clean functions** — short, focused, readable top-to-bottom. If it scrolls, split it.
3. **Modularity and cohesion** — composable pieces with clear inputs/outputs; related code lives together.
4. **Explicit over implicit** — named parameters, clear return types, obvious control flow. No magic.
5. **Minimal coupling** — depend on interfaces, not implementations; follow layer boundaries.
6. **DRY — but not prematurely** — extract after three genuine repetitions, not two. Three similar lines are better than a premature abstraction.
7. **Fail fast and visibly** — validate at boundaries; surface errors early. Never silently swallow failures.
8. **Naming is documentation** — if a name needs a comment, rename it.
9. **Defensive async** — guard against stale state; no fire-and-forget. Every async operation must handle errors.
10. **Test coverage** — every public method has explicit tests (target; building toward this).
11. **Keep state minimal and local** — prefer derived values over stored duplicates. Centralize shared state.
12. **Delete freely** — dead code is a liability; version control remembers.
13. **Config data is sacred** — user bookmarks, links, quotes, backgrounds, and settings must never be lost, corrupted, or silently overwritten during any operation.

## Coding standards

### Language and tooling

- **Stack:** HTML + CSS + JavaScript only. No frameworks, no bundlers, no TypeScript, no dependency chains.
- **Module style:** Plain `<script>` tags (no ES modules in production yet — extension context limitations). Keep scripts to a small number of well-scoped files.
- **Manifest:** MV3 (Manifest Version 3). Do not introduce MV2 patterns.

### JavaScript

- Use `async`/`await` over raw promise chains.
- Use `const` by default; `let` only when reassignment is necessary; never `var`.
- Use strict equality (`===` / `!==`).
- Keep functions small and pure where possible. Avoid side effects in utility functions.
- Centralize storage keys, constants, and magic numbers at the top of the file or in a dedicated constants section.
- Add a short intent comment atop new functions (one line, what it does and why).
- No silent `catch` blocks — every catch must at minimum `console.error` and surface the failure.
- No `@ts-nocheck` or equivalent suppression patterns.

### CSS

- Use the existing `css/style.css` convention. No CSS-in-JS, no preprocessors.
- Prefer class selectors over IDs for styling. IDs are for JS hooks.
- Avoid `!important` unless overriding third-party styles (there are none currently).

### HTML

- Keep `index.html` as the single-page entry point.
- Semantic elements where appropriate (`section`, `nav`, `header`, `main`).
- No inline styles; no inline event handlers (`onclick`). Bind in JS.

### Storage

- All `chrome.storage.sync` operations go through the v2 chunked storage module (`js/storage.js`).
- Always preflight quota before writing.
- Two-phase writes (temp → final) for corruption safety.
- Legacy key detection and migration must remain intact.

### Git and workflow

- Branch naming: `feature/`, `bugfix/`, `infra/`, `docs/` prefixes.
- Commit messages: imperative mood, concise, explain the _why_ not just the _what_.
- No direct pushes to `main`. All changes via PR.
- Never use `--no-verify` on commits or pushes.
- Log significant changes in `PROGRESS.md` (timestamped, single-line entries).

### Release process

- Packaging scripts live in `scripts/` (currently PowerShell).
- CI builds QA and prod zips on merge to `main` via `.github/workflows/edge-packages.yml`.
- Every release zip gets SHA-256 hashes for integrity verification.
- Manifest version must be bumped before release.
