# Evaluation Methodology

This document describes how CORTEX scores evaluation datasets, including response grading and retrieval benchmarks.

## Evaluation types
Datasets can be created as:
- Response evaluations: score generated flight plan output against expected text or rubric.
- Retrieval evaluations: score resource matching against expected file paths.

## Response evaluation (default)
Each dataset item can include:
- `input`: the prompt or instruction
- `expected`: the expected text or pattern
- `expectedType`: `contains` (default) or `regex`
- `rubric`: optional rubric text
- `weight`: numeric weight for the item

Scoring rules:
- If `expected` is provided, CORTEX checks for a match:
  - `contains`: normalized output must include normalized expected text.
  - `regex`: output must match the regex pattern.
- If `expected` is empty, CORTEX uses a token overlap heuristic and marks the item `needs-review`.
- Each match returns a score of 1 (pass) or 0 (fail), weighted by `weight`.

### LLM rubric grading (optional)
If `expectedType` is `llm` or a `rubric` is present, CORTEX can use an LLM grader:
- Enabled by `evaluation.llmGraderEnabled` (default `true`).
- Limited by `evaluation.llmMaxItems` (default `12`).
- Uses the configured LLM endpoint and returns a JSON score, status, and rationale.

## Retrieval evaluation
Retrieval datasets store `expectedPaths` for each item. CORTEX retrieves top-K resources and computes:
- Precision@K
- Recall@K
- Mean Reciprocal Rank (MRR)

Defaults:
- `evaluation.benchmarkTopK` is 5 unless configured.

## Pass, warn, fail thresholds
Response evaluations use weighted pass rates:
- Pass threshold: `evaluation.passThreshold` (default `0.75`)
- Warn threshold: `evaluation.warnThreshold` (default `0.60`)
- Below warn is `fail`

## Cost and token estimates
When LLM grading is used, CORTEX estimates:
- Tokens used (from prompt + output snippet)
- Cost (based on `llm.costPer1kTokens`)

These estimates appear in evaluation records and the Observability summary.
