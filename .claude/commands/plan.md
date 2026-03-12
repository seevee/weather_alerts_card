# Plan — Implementation Planning

Produce a **complete implementation plan** for a feature or change. This skill **never writes code**.

The plan must be detailed enough for `/implement` to execute without additional design decisions.

---

# Input

`$ARGUMENTS` contains the feature request (free text).

---

# Rules

1. Do not invent architecture that doesn't exist in the repository.
2. Only reference files confirmed to exist.
3. Read files before referencing them.
4. All decisions must be justified.
5. The plan must eliminate ambiguity for implementers.

---

# Execution

## 1 — Orient

Read `AGENTS.md` and scan `src/` to build working context. Determine project type, architecture, and relevant modules.

## 2 — Analyze

Interpret the feature request. Output:

- User-visible behavior
- Internal behavior changes
- Expected inputs and outputs
- Assumptions (if request is ambiguous)

Trace dependencies: `implementation → callers → exported interface`. Every affected file must appear in **Files to Change**.

## 3 — Design

For each major decision, evaluate at least two options:

```
Decision: <what>
Options: <A, B, ...>
Chosen: <which>
Rationale: <why>
```

## 4 — Plan

Produce an ordered implementation plan. Each step:

```
Step N
Files: <paths>
Description: <what to do>
Acceptance: <how to verify>
```

---

# Output Format

The plan must contain these sections in order:

1. **Feature Interpretation**
2. **Architecture Summary**
3. **Impact Analysis**
4. **Design Decisions**
5. **Implementation Steps**
6. **Files to Change** — tables for New Files and Modified Files
7. **Public Interface Changes**
8. **Risk Assessment**
9. **Test Strategy**

Save the plan to `plans/<feature-slug>.md` and present it for approval.

Do **not** begin implementation. The `/implement` skill executes the plan after approval.

---

# Begin

$ARGUMENTS
