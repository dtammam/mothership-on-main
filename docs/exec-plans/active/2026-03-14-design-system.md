# Design System & Theme Standardization

**Status:** Planned (not started)
**Created:** 2026-03-14

## Goal

Establish a formal design system with a complete, tokenized color palette and component styling vocabulary. All visual properties should derive from CSS custom properties on `:root`, enabling consistent theming, a future light mode, and adaptation to gradient backgrounds.

## Non-goals

- Introducing CSS preprocessors, build tools, or frameworks
- Changing the visual identity (colors, fonts, feel) — just formalizing what exists
- Implementing theme persistence in sync storage (separate effort if needed)

## Constraints

- Plain CSS only (per project non-negotiable: no build tooling)
- Must not regress any existing visual behavior
- Must not affect performance budgets
- Changes are purely cosmetic — no data model or JS logic changes expected

## Current state

The CSS already uses some custom properties on `:root`:

| Token                            | Value                       | Used for                 |
| -------------------------------- | --------------------------- | ------------------------ |
| `--surface`                      | `rgba(18, 20, 28, 0.82)`    | Card backgrounds         |
| `--surface-bright`               | `rgba(26, 30, 42, 0.92)`    | Hover states             |
| `--surface-glow`                 | `rgba(255, 255, 255, 0.08)` | Subtle highlights        |
| `--border`                       | `rgba(255, 255, 255, 0.18)` | Borders                  |
| `--text`                         | `#f4f2ee`                   | Primary text             |
| `--muted`                        | `rgba(244, 242, 238, 0.7)`  | Secondary text           |
| `--accent`                       | `#ff8a3d`                   | Primary accent (orange)  |
| `--accent-strong`                | `#ffb23d`                   | Stronger accent variant  |
| `--shadow`                       | `0 24px 50px rgba(...)`     | Drop shadows             |
| `--radius` / `--radius-tight`    | `18px` / `12px`             | Border radii             |
| `--font-sans` / `--font-display` | Bahnschrift / Segoe UI      | Typography               |
| `--aura-*`                       | Various rgba                | Background gradient aura |

**Problem:** ~50+ hardcoded `rgba()` and hex values scattered throughout `style.css` that don't reference these tokens. These cover:

- Input/select field backgrounds (`rgba(16, 18, 28, 0.8)`)
- Input borders (`rgba(255, 255, 255, 0.12)`)
- Settings panel chrome (`rgba(12, 14, 22, 0.96)`, `#0c0e16`)
- Divider lines (`rgba(255, 255, 255, 0.06)`, `rgba(255, 255, 255, 0.08)`)
- Status colors: success (`#c9f7d0`), error (`#f3b1b1`), warning (`#ffd79b`)
- Overlay/backdrop (`rgba(0, 0, 0, 0.6)`)
- Body fallback (`#0d0f16`)
- Various one-off gradients

These make it impossible to re-theme without a find-and-replace audit.

## Proposed approach

### Phase 1 — Audit & define tokens

1. Catalog every unique color value in `style.css`
2. Group into semantic categories:
    - **Surfaces:** body, card, panel, input, overlay
    - **Borders:** strong, default, subtle, divider
    - **Text:** primary, secondary/muted, inverse (on accent)
    - **Accent:** primary, strong, glow
    - **Status:** success, error, warning (text + border variants)
    - **Shadow:** card, panel-header, panel-footer
3. Define new CSS custom properties for each semantic role
4. Document the token set (what each token means, not just its value)

### Phase 2 — Replace hardcoded values

1. Systematically replace every hardcoded color in `style.css` with the appropriate token
2. Verify visual parity at each step (no visible change expected)
3. Lint/grep to confirm zero remaining hardcoded color values outside `:root`

### Phase 3 — Light mode

1. Define a `[data-theme="light"]` override block with inverted token values
2. Add a theme toggle in settings (visibility section or its own section)
3. Persist preference in config
4. Apply on load (before paint to avoid FOUC)

### Phase 4 — Gradient-aware theming (stretch)

1. When a gradient background mode is active, derive accent/aura tokens from the gradient palette
2. The bookmark picker modal, settings panel, and other overlays adapt to the active gradient
3. This is the "consistent theme that changes with the gradient" idea

## Alternatives considered

- **CSS-in-JS / CSS modules:** Rejected — no build tooling constraint
- **Sass variables:** Rejected — same reason, and CSS custom properties are strictly more powerful (runtime switchable)
- **Per-component theming:** Over-engineered for this project's scale

## Risks and mitigations

| Risk                                          | Mitigation                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Visual regression during token replacement    | Phase 2 is purely mechanical — replace value with var that resolves to the same value. Visual diff before/after. |
| Light mode looks bad without design iteration | Start with a conservative inversion, iterate visually. User (Dean) has final say on palette.                     |
| FOUC on theme switch                          | Apply `data-theme` attribute synchronously in `<head>` before CSS loads, reading from storage                    |

## Acceptance criteria

- [ ] Zero hardcoded color values in `style.css` outside `:root` (all reference tokens)
- [ ] Token set documented with semantic names and intended usage
- [ ] Dark mode visually identical to current appearance
- [ ] Light mode available and toggleable
- [ ] No FOUC on theme application
- [ ] All quality gates pass

## Test plan

- Visual comparison: screenshots before/after Phase 2 (dark mode parity)
- Manual toggle between light/dark across all pages and settings panels
- Gradient mode + theme interaction check
- Performance: no measurable paint delay from theme application

## Rollout / migration plan

- Phase 1-2 can ship as a standalone PR (zero visual change, pure refactor)
- Phase 3 ships as a feature (light mode toggle)
- Phase 4 is a stretch goal, can be deferred indefinitely

## Progress log

- 2026-03-14: Plan created. Identified ~50+ hardcoded color values needing tokenization.

## Decision log

- 2026-03-14: Agreed to keep this as a future plan, not part of the current feature batch.
