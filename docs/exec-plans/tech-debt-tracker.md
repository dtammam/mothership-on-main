# Tech Debt Tracker

This is the canonical list of known technical debt.

Rules:

- Every item must have a clear next action.
- Every item must have an owner (human or "unassigned").
- Close items by linking the PR and moving them to "Closed".

## Active

|  ID | Area    | Severity | Summary                                                                             | Owner      | Next action                                                 |
| --: | ------- | -------- | ----------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
|   1 | JS      | High     | All application logic lives in a single `js/script.js` file — no modular separation | unassigned | Split into focused modules (storage, UI, config, customize) |
|   4 | Visual  | Medium   | FOUC on page load — default config briefly visible before user config renders       | unassigned | Implement content-hiding until config is resolved           |
|   5 | Scripts | Medium   | Release scripts are PowerShell-only; incompatible with Linux dev environments       | unassigned | Add cross-platform script support or bash equivalents       |
|   6 | CSS     | Low      | Single monolithic `css/style.css` — no logical separation                           | unassigned | Consider splitting once CSS grows further                   |

## Closed

|  ID | Area    | Closed on  | Summary                                                             | Link                           |
| --: | ------- | ---------- | ------------------------------------------------------------------- | ------------------------------ |
|   2 | Testing | 2026-03-13 | No automated test runner; only manual checklist and storage harness | feature/testing-infrastructure |
|   3 | Tooling | 2026-03-13 | No linter or formatter configured                                   | feature/testing-infrastructure |
