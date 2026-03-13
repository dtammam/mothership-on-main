# Plans

Plans are first-class artifacts.

## Lightweight plan (default)

For small changes:

- Put the plan in the PR description.
- Include: scope, acceptance criteria, test plan.

## Execution plan (required for complex work)

Create a new file under `docs/exec-plans/active/` when:

- It spans multiple domains
- It changes the data model or critical paths
- It introduces operational or security risk
- It's likely to take more than one session
- It has non-obvious tradeoffs

### Template

Create: `docs/exec-plans/active/<yyyy-mm-dd>-<short-title>.md`

Skeleton:

- Goal
- Non-goals
- Constraints
- Current state
- Proposed approach
- Alternatives considered
- Risks and mitigations
- Acceptance criteria
- Test plan
- Rollout / migration plan
- Progress log (append-only, dated)
- Decision log (append-only, dated)

## Tech debt

If you discover debt:

- Add it to `docs/exec-plans/tech-debt-tracker.md`
- Link the PR or plan that introduced it
