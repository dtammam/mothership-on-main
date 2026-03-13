# Next Prompt

Auto-generate a continuation prompt for the next session based on current project state.

## Workflow

1. Read the following files (all required):
    - `PROGRESS.md` — extract the **last entry** (most recent work).
    - `docs/QUALITY_SCORE.md` — find all domains graded C, D, or F. Extract the "Next:" action for each.
    - `docs/exec-plans/active/` — list all active plans and their current status.
    - `docs/exec-plans/tech-debt-tracker.md` — list active debt items.

2. Synthesize a continuation prompt using this template:

```
<date> - <branch context>

Continue work on the Mothership on Main repo. <1-sentence summary of last PROGRESS entry>.

<If an active plan exists and has remaining acceptance criteria>
The exec plan at <plan path> is <status>. <Summarize what's done and what remains>.
</If>

The next goal: <primary objective derived from lowest-graded domains or active plan>.

The concrete next actions from QUALITY_SCORE.md are:
<bulleted list of "Next:" actions for C/D/F domains>

<If there are relevant constraints from the active plan, include them>.

Read <relevant doc paths> for current state. Create branch <suggested branch name> off main. <Suggest plan vs direct implementation based on scope>.

<If tech debt items are relevant to the next goal, mention them>.
```

3. Output the prompt in a fenced code block so the user can copy it directly.

## Rules

- Do not fabricate actions — only reference what's explicitly written in the source files.
- Keep the prompt concise — aim for the same density as a human-written session prompt.
- If all domains are graded B or above and no active plans remain, say so and suggest what's next based on tech debt or systemic gaps.
- Include the "Also:" suffix pattern for secondary tasks only if they are clearly defined in the source files.
