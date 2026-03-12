# Review — Implementation Audit

Review an implementation for correctness, completeness, and safety. **Code review only — no modifications.**

---

# Input

`$ARGUMENTS` may specify:

- A plan file in `plans/` to validate against
- A branch name to review
- A PR number

If none provided, review the current branch against `main`.

---

# Rules

1. Only analyze files that changed.
2. Read every changed file fully before reviewing.
3. Do not assume behavior without verifying code.
4. Identify issues but do not implement fixes.

---

# Execution

## 1 — Context

Read `AGENTS.md` and any referenced plan file. Determine expected behavior and affected modules.

## 2 — Diff Analysis

Compare feature branch against base. Group changed files:

- Core logic
- UI/components
- Configuration
- Documentation
- Tests

## 3 — Plan Compliance (if plan exists)

For each planned step: `Implemented` | `Partially implemented` | `Missing`

## 4 — Code Quality

Check for:

- Dead code (unused functions, unreachable code, unused imports)
- Interface consistency (exported APIs, props, config schemas applied consistently)
- Propagation completeness (all callers updated when a function/prop changes)
- Convention adherence (file naming, directory layout, module boundaries per `AGENTS.md`)

## 5 — Risk Assessment

Categorize issues by severity (`Critical` | `Major` | `Minor`):

- **Functional** — incorrect behavior
- **Compatibility** — breaking public APIs or configuration
- **Performance** — inefficient code paths
- **Maintenance** — unclear logic or unnecessary complexity

## 6 — Documentation

Verify `CHANGELOG.md` and `README.md` reflect user-visible changes.

---

# Output

### Summary
Short description of feature and implementation quality.

### Plan Compliance (if applicable)
Status of each planned step.

### Findings
Issues discovered, grouped by severity.

### Merge Recommendation
One of: `APPROVE` | `APPROVE WITH MINOR FIXES` | `REQUEST CHANGES`

---

# Begin

$ARGUMENTS
