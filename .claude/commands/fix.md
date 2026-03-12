# Fix

Fix a bug or make a small, localized change. Skips the full plan cycle.

For changes that touch multiple modules, change public interfaces, or require design decisions, use `/plan` + `/implement` instead.

$ARGUMENTS describes the bug or change.

## Constraints
- Keep changes minimal — fix the issue, nothing more
- Do not change public interfaces without confirming with the user

## Execution

1. **Locate** — find the relevant code
2. **Understand** — trace the bug or identify the needed change
3. **Fix** — make the minimal change
4. **Verify** — build, lint, test

Present a brief summary of what changed and why.

$ARGUMENTS
