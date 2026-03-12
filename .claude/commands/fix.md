# Fix — Lightweight Bug Fix

Fix a bug or make a small change without the full plan/implement cycle.

Use this for changes that are **obvious, localized, and low-risk**. For anything that touches multiple modules, changes public interfaces, or requires design decisions, use `/plan` + `/implement` instead.

---

# Input

`$ARGUMENTS` describes the bug or small change.

---

# Rules

1. Read `AGENTS.md` for project conventions.
2. Read all files before editing them.
3. Keep changes minimal — fix the issue, nothing more.
4. Run `npm run build && npm run lint && npm test` before presenting results.
5. Do not change public interfaces without confirming with the user.

---

# Execution

1. **Locate** — Find the relevant code. Read the files.
2. **Understand** — Trace the bug or identify the change needed.
3. **Fix** — Make the minimal change.
4. **Verify** — Build, lint, test.

Present a brief summary of what changed and why. Do **not** commit, push, or open a PR — leave that to the user or `/commit-push-pr`.

---

# Begin

$ARGUMENTS
