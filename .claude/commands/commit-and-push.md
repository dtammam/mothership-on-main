# Commit And Push

Safely commit and push to origin with all quality gates enforced.

## Required input

- Commit message provided as $ARGUMENTS.
- Reject generic messages (update, fix, wip).
- If no message provided, ask for one.

## Workflow

1. Run git status and git diff.
2. **PROGRESS check.** Read `PROGRESS.md` and check whether the current branch's work is already logged. If not, and the changes represent a meaningful milestone (not just a docs tweak), append a single-line entry in the format: `YYYY-MM-DD HH:mm - branch-name - summary`. Stage the updated file alongside other changes.
3. Stage changes by file (explicit paths, not git add .).
4. Commit using HEREDOC format with co-author trailer.
5. Push to origin: git push.

## Failure handling

If any step fails — stop. Do not retry blindly. Do not amend or force-push.
Read the error. Fix the root cause. Re-run from step 1.
Never use --no-verify. Never force-push.

If the same failure repeats, add it to docs/exec-plans/tech-debt-tracker.md.
