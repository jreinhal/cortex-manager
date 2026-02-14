# Reference Implementations and Examples

This document provides example reference repository layouts and example workflows for CORTEX.

## Example reference repo layout
```
reference-repos/
  agents/
    std-agent/
  skills/
    react-best-practices/
    api-design-guidelines/
  knowledge/
    security-guidelines/
    accessibility-guides/
  tools/
    repo-audit-scripts/
  benchmarks/
    retrieval-benchmarks/
```

## Example goals
- "Audit the authentication module for security vulnerabilities."
- "Review the dashboard UI for accessibility and clarity."
- "Generate unit tests for the billing service."

## Example evaluation dataset
Response dataset:
- Input: "Summarize the current RBAC rules."
- Expected: "viewer, editor, admin"
- Expected type: `contains`

Retrieval dataset:
- Input: "Locate the decision matrix specification"
- Expected paths:
  - `docs/decision-matrix.md`

## Example workflow
1. Add the reference repos above.
2. Run a repo scan.
3. Spawn an agent using one of the example goals.
4. Create a dataset and run an evaluation.
