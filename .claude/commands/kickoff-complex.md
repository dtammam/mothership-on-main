# Kickoff Complex

Enforce plan-first intake for complex work. Coding is blocked until an execution plan exists and is approved.

## Workflow

1. **Check existing context first.** Before asking the user anything:
    - Read `docs/exec-plans/active/` — surface related plans.
    - Read `docs/exec-plans/tech-debt-tracker.md` — reference relevant debt.
    - Read `docs/CONTRIBUTING.md` — confirm principles.
    - If already covered by an existing plan, resume it instead.

2. Ask the user to fill this intake template:

    Goal:
    Scope:
    Constraints:
    Authoritative docs:
    Deliverables:
    Complexity signal: (why this is non-trivial)

3. If any field is missing or vague, ask one concise follow-up.

4. Produce a normalized Execution Brief.

5. Produce a Plan Gate block:

    Plan required: Yes
    Execution plan path: docs/exec-plans/active/YYYY-MM-DD-short-title.md
    Coding status: Blocked until plan is written and approved

6. Draft the execution plan using the template from docs/PLANS.md.

7. Write the plan file and confirm with the user before coding.

## Rules

- Do not write implementation code until the plan is approved.
- Acceptance criteria must be specific and testable.
- Progress log and decision log entries are append-only and dated.
- When work is complete, follow the session protocol closing steps in CLAUDE.md.
