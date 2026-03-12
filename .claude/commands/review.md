# Review

Review an implementation for correctness, completeness, and safety. No modifications.

$ARGUMENTS may specify a plan file, branch name, or PR number.
If none provided, review the current branch against `main`.

## Constraints
- Only analyze files that changed in the branch
- Read every changed file fully before reviewing
- Identify issues but do not implement fixes

## Execution

### Context
Read any referenced plan file. Determine expected behavior and affected modules.

### Diff Analysis
Group changed files: core logic, UI, configuration, documentation, tests.

### Plan Compliance (if plan exists)
For each planned step: Implemented | Partially implemented | Missing

### Code Quality
- Dead code (unused functions, unreachable code, unused imports)
- Interface consistency (exports, props, schemas applied consistently)
- Propagation completeness (all callers updated when a function/prop changes)
- Convention adherence (per AGENTS.md)

### Risk Assessment
Severity: Critical | Major | Minor
Categories: functional, compatibility, performance, maintenance.

### Documentation
Verify CHANGELOG.md and README.md reflect user-visible changes.

## Output

### Summary
### Plan Compliance (if applicable)
### Findings (grouped by severity)
### Merge Recommendation: APPROVE | APPROVE WITH MINOR FIXES | REQUEST CHANGES

$ARGUMENTS
