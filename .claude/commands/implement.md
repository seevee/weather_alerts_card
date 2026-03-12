# Implement — Feature Implementation

Implement a feature or change following a strict lifecycle.

**Orient → Plan → Implement → Verify → Document**

You **must not write code until the user approves the plan.**

---

# Input

`$ARGUMENTS` contains one of:

### Feature request (free text)
Build context, produce a plan, get approval, then implement.

### Pre-approved plan reference
If `$ARGUMENTS` references a file in `plans/`, skip planning — the plan is pre-approved.

---

# Rules

1. Always read before editing a file.
2. Only modify files listed in the plan.
3. Never introduce unrelated refactors.
4. Never fix pre-existing lint errors outside modified files.
5. Do not invent architecture not described in the plan.

---

# Step 1 — Orient

Read `AGENTS.md` and scan `src/` for code relevant to the feature. Trace any public API or prop changes through callers to exported interfaces.

Output a brief context report: feature interpretation, relevant modules, files likely to change.

---

# Step 2 — Plan

If a pre-approved plan exists, skip this step.

Otherwise, produce a plan following the same format as `/plan`:

1. Feature Interpretation
2. Design Decisions
3. Implementation Steps (ordered, with files and acceptance criteria)
4. Files to Change
5. Risk Assessment

Present the plan and wait for approval before proceeding.

---

# Step 3 — Implement

Follow dependency order:

1. Types/interfaces
2. Utilities/helpers
3. Core logic
4. UI/components
5. Configuration
6. Documentation

Create a feature branch if not already on one:

```
git checkout -b feat/<slug>
```

---

# Step 4 — Verify

Run build and lint:

```
npm run build
npm run lint
npm test
```

Build must pass. Fix any new lint errors or test failures.

---

# Step 5 — Document

- Add entry to `CHANGELOG.md`
- Update `README.md` if configuration or user-visible behavior changed

---

# Completion

Present a summary of all changes made. Do **not** commit, push, or open a PR — leave that to the user or `/commit-push-pr`.

---

# Begin

$ARGUMENTS
