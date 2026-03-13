# Reliability & Performance Budgets — Mothership on Main

These budgets are non-negotiable. If a change threatens any of these, flag it before proceeding.

## Performance budgets

| Metric | Budget | Rationale |
|--------|--------|-----------|
| New tab render (first meaningful paint) | < 200ms | New tab must feel instant. Users open tabs reflexively; any perceptible delay feels broken. |
| No FOUC / flash of default config | 0 occurrences | The page must not briefly show default config before loading the user's actual data. Hide content until config is resolved, or render from a loading state. |
| Config load from storage | < 100ms | Storage reads happen on every new tab. Must not block render perceptibly. |
| Config save (full round-trip) | < 500ms | User clicks Save in Customize; feedback must be near-instant. |
| Layout shift (CLS) | 0 | No elements should jump or reflow after initial paint. Links, sections, and backgrounds must be stable. |
| Favicon resolution | < 1s per icon | Favicon fetches should not block page render. Load asynchronously, show fallback immediately. |

## Storage invariants

| Rule | Detail |
|------|--------|
| Per-item limit | Each `chrome.storage.sync` item must stay under 8,192 bytes (key + JSON value). Target 6,500–7,000 byte chunks to leave margin. |
| Total sync limit | Total `chrome.storage.sync` usage must stay under 102,400 bytes. Preflight every write. |
| Two-phase writes | All config saves use temp → final key swap. Partial writes must never corrupt the active config. |
| Migration safety | Legacy single-key configs auto-migrate to v2 chunked format. Legacy keys are retained until v2 write succeeds. Migration is idempotent. |
| No data loss | A failed save must never overwrite or clear previously saved valid config. The last known good state must remain recoverable. |

## Visual quality invariants

| Rule | Detail |
|------|--------|
| No FOUC | Content is hidden or shows a loading state until config is fully resolved and applied. |
| No flicker | Background images, gradients, and UI elements must not visibly swap or flash during load. |
| No layout jank | All elements must have stable dimensions from first paint. No reflows triggered by late-loading data. |
| Smooth transitions | State changes in Customize (drag, reorder, toggle) should feel responsive with no visible stutter. |

## What to do when a budget is at risk

1. **Stop and flag it.** Do not ship the change hoping it will be fine.
2. **Measure.** Use browser DevTools Performance tab or `performance.now()` to get actual numbers.
3. **Document the tradeoff** in the PR description or exec plan.
4. **Get explicit approval** before merging anything that exceeds a budget.
