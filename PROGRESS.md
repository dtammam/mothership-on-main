# PROGRESS.md — Mothership on Main

Purpose: quick, human-readable timeline for maintainers and agents. Format: `YYYY-MM-DD HH:mm - branchname - summary`.

2023-05-08 12:00 - release/1.0.0 - Initial launch of the new-tab experience (baseline links/search/quotes layout).
2026-01-04 12:00 - release/1.1.0 - Customize panel revamp with branding controls, sticky nav, and background previews.
2026-01-10 12:00 - release/1.2.0 - UX polish: quick-add links/sections, new gradients/blurred uploads, smarter import/export defaults.
2026-02-04 22:15 - bugfix/eliminate-8kb-cache-storage-limit - Added storage harness (tests/), v2 chunked sync with quota preflight, sync usage badge, manifest 1.3.0
2026-02-04 22:40 - bugfix/eliminate-8kb-cache-storage-limit - Removed CHANGELOG; README now points to PROGRESS as the history source.
2026-02-13 10:30 - infra/edge-package-ci - Added CI packaging for QA/prod Edge zips, SHA-256 generation, standardized release notes, and automatic merge/version-tag GitHub releases.
2026-02-13 12:10 - feature/customize-usability-enhancements - Added search-provider drag sorting, persistent section collapse, visibility toggles, section dropdown/new flow for links, wider layout controls (up to 10 columns), append-order new links, and a toggle to disable favicon auto-fetching (keeps cached icons; uses default icon when fetch is disabled and no cache exists).
2026-03-13 13:50 - feature/testing-infrastructure - Added ESLint + Prettier + Vitest, 35 automated tests (storage round-trip, config merge/split, corruption handling), upgraded git hooks (pre-commit: lint+format, pre-push: full suite), CI quality-gate job, docs-only packaging skip. Closes tech debt #2 and #3.
2026-03-13 16:30 - feature/test-coverage-expansion - Expanded test coverage from 35 to 118 tests across 5 files. Tested 15 pure utility functions via VM sandbox globals (zero runtime changes). Graded 4 new domains in QUALITY_SCORE.md (Link rendering, Backgrounds, Quotes, Import/Export — all C).
