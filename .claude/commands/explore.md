# Explore

Produce a structured context report for this repository.
No design. No implementation. Discovery only.

$ARGUMENTS optionally narrows focus to a feature area.

## Constraints
- All files referenced in output must be read first
- Prioritize source code over generated artifacts
- Ignore node_modules/, dist/, build/, coverage/

## Output

### Repository Summary
Purpose, project type, language, build system, distribution format.

### Directory Structure
Key directories and what they contain.

### Architecture Overview
Major modules, how they interact, entry points.

### Dependency Graph
Import relationships: `module A → module B`

### Public Interfaces
Exported functions, component props, config schemas, custom element registrations.

### Build Pipeline
Build tools, scripts, compilation targets.

### Feature-Relevant Areas (if feature provided)
Modules in the impact radius of the described feature.

$ARGUMENTS
