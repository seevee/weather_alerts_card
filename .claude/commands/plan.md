# Plan

Produce a complete implementation plan. Never write code.

The plan must be sufficient for `/implement` to execute with zero additional design decisions.

$ARGUMENTS describes the feature or change.

## Constraints
- Only reference files confirmed to exist (read first)
- Every design decision must evaluate ≥2 options with rationale
- Every affected file must appear in Files to Change (trace: implementation → callers → exports)
- Ambiguity in the request must be surfaced as explicit assumptions

## Output → plans/<feature-slug>.md

### Feature Interpretation
User-visible behavior, internal behavior changes, inputs/outputs, assumptions.

### Architecture Summary
Relevant modules and how they relate to the change.

### Impact Analysis
Every part of the repository affected, grouped by: core logic, public APIs, UI, configuration.

### Design Decisions
Decision | Options | Chosen | Rationale

### Implementation Steps
Step | Files | Description | Acceptance Criteria

### Files to Change
New: Path | Purpose
Modified: Path | Change

### Public Interface Changes
Any changes to exports, props, config schemas, or custom elements.

### Risk Assessment
API compatibility, UI regressions, performance, build breakage. Mitigation if applicable.

### Test Strategy
New tests required, existing tests impacted. State explicitly if no tests exist.

Save to `plans/<feature-slug>.md`. Present for approval. Do not implement.

$ARGUMENTS
