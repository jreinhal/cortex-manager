# Testing Checklist

## Manual Smoke
- First-run wizard appears on fresh install
- Settings panel updates config correctly
- Agent Factory generates valid flight plans
- Command Center loads with run/eval/prompt counts
- Run Explorer shows recent run details + comparison deltas
- Evaluations view can create a dataset + evaluation with per-item grading (LLM rubric if enabled)
- Library view shows saved prompts + agent templates
- Session history persists
- Decision Matrix section appears in generated plans
- Decision Trace summary appears in generated plans
- Retrieval gate + query expansion + RAG-Fusion + hybrid retrieval + RRF lines appear in Decision Matrix
- AGENTS.md appears first in Required Reading when present
- Telemetry increments after a successful spawn
- Repository size totals reflect actual folder sizes (spot-check against OS properties)

## UI Visual Checks
- Repos view: "Add Repository" label does not overlap border or focus ring
- Repos view: input focus ring stays within the field and doesn't obscure text

## Automated E2E (Playwright)
- Navigation between all primary views (Command Center, Runs, Evaluations, Library, Knowledge Base)
- Save Prompt flow + Quick Access rendering
- Repository size labels populate (not “—”)
- Invalid repo URL shows log error
- Duplicate repo shows notice + log entry
- Scan action emits log entries
- Spawn generates flight plan (Decision Matrix + AGENTS in output) and telemetry updates

## Cleanup
- Delete any saved prompts created solely for testing after verification completes.
