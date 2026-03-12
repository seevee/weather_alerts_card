# Explore — Repository Discovery

Systematically explore this repository and produce a structured context report.

**No design. No implementation. Discovery only.**

---

# Input

`$ARGUMENTS` optionally contains a feature description. If provided, focus exploration on relevant areas. Otherwise, perform a general survey.

---

# Rules

1. Never assume architecture without reading files.
2. All files referenced in output must be read first.
3. Prioritize source code over generated artifacts.
4. Ignore `node_modules/`, `dist/`, `build/`, `coverage/`.

---

# Execution

## 1 — Inventory

Read these files if they exist:

- `AGENTS.md`
- `README.md`
- `package.json`
- `tsconfig.json`
- `rollup.config.mjs`

Extract: project purpose, language, build system, distribution format, test framework.

## 2 — Source Inspection

Inspect `src/` and any other source directories. For each module: list exports, identify entry points, note responsibilities.

## 3 — Dependency Mapping

Trace import relationships between modules:

```
module A → module B → module C
```

## 4 — Public Interfaces

Identify all externally visible APIs: exported functions, component props, configuration schemas, custom element registrations.

## 5 — Feature-Relevant Mapping (if feature provided)

Search for keywords from the feature description. Trace dependencies outward to identify impact radius.

---

# Output

Present the report directly to the user with these sections:

1. **Repository Summary** — purpose and project type
2. **Directory Structure** — key directories and contents
3. **Architecture Overview** — modules and interactions
4. **Entry Points** — files that start or export functionality
5. **Dependency Graph** — module relationships
6. **Public Interfaces** — externally visible APIs
7. **Build Pipeline** — how code compiles and packages
8. **Feature-Relevant Areas** (if applicable)

Do not save artifacts to disk unless the user requests it.

---

# Begin

$ARGUMENTS
