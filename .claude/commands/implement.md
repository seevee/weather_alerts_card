# Implement

Implement a feature or change. Do not write code until the user approves a plan.

$ARGUMENTS contains either:
- A feature request (free text) → build context, plan, get approval, then implement
- A reference to `plans/<file>.md` → plan is pre-approved, skip to implementation

## Constraints
- Only modify files listed in the approved plan
- If no pre-approved plan exists, produce one (same format as `/plan`) and wait for approval

## Execution

### Orient
Scan for code relevant to the feature. Output a brief context report: feature interpretation, relevant modules, files likely to change.

### Plan (skip if pre-approved)
Produce plan per `/plan` format. Present and wait for approval.

### Implement
Write code following the approved plan. Create a feature branch if not already on one.

### Verify
Build, lint, test. Fix any failures introduced.

### Document
Update CHANGELOG.md. Update README.md if user-visible behavior or configuration changed.

### Complete
Present a summary of all changes made.

$ARGUMENTS
