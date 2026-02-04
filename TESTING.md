# Testing Checklist

## Manual Smoke
- First-run wizard appears on fresh install
- Settings panel updates config correctly
- Agent Factory generates valid flight plans
- Command Center loads with run/eval/prompt counts
- Run Explorer shows recent run details + comparison deltas
- Jobs view lists queued/active jobs
- Observability panel shows token + cost aggregates
- Evaluations view can create a dataset + evaluation with per-item grading (LLM rubric if enabled)
- Evaluations view can create retrieval benchmarks with precision/recall/MRR
- Library view shows saved prompts + agent templates
- Session history persists
- Decision Matrix section appears in generated plans
- Decision Trace summary appears in generated plans
- Retrieval gate + query expansion + RAG-Fusion + hybrid retrieval + RRF lines appear in Decision Matrix
- Semantic index line appears in Decision Matrix
- AGENTS.md appears first in Required Reading when present
- Telemetry increments after a successful spawn
- Repository size totals reflect actual folder sizes (spot-check against OS properties)
- Vector index rebuild succeeds (Settings → Rebuild index)
- Auth bootstrap + login flow works when auth is enabled
- RBAC policy editor saves valid JSON and blocks forbidden actions
- Audit Trail view lists recent events with user/workspace metadata
- Audit Trail export downloads CSV/JSON without errors
- Workspaces can be created, switched, and deleted (admin only)

## UI Visual Checks
- Repos view: "Add Repository" label does not overlap border or focus ring
- Repos view: input focus ring stays within the field and doesn't obscure text
- Jobs view shows status pill and cancel button for queued/running jobs
- Audit Trail filter/search stays responsive with >50 entries
- Evaluation Trends panel renders response + retrieval sparklines

## Automated E2E (Playwright)
- Navigation between all primary views (Command Center, Runs, Evaluations, Library, Knowledge Base)
- Save Prompt flow + Quick Access rendering
- Repository size labels populate (not “—”)
- Invalid repo URL shows log error
- Duplicate repo shows notice + log entry
- Scan action emits log entries
- Spawn generates flight plan (Decision Matrix + AGENTS in output) and telemetry updates

### Run in Edge (Manual UI Pass)
- `npm run e2e:edge` (headed Edge run)
- `npm run e2e:edge:ui` (Playwright UI runner using Edge)
- `npm run e2e:edge -- tests/e2e/screenshots.spec.js` (capture docs screenshots)

### LLM Rubric (Optional)
- Start a local OpenAI-compatible endpoint:
  - **Ollama**: `ollama serve` then `ollama pull qwen2.5:14b-instruct` (or any model)
    - Endpoint: `http://localhost:11434/v1/chat/completions`
  - **LM Studio**: start server
    - Endpoint: `http://localhost:1234/v1/chat/completions`
- Update **Settings → LLM Endpoint** to match.
- Use **Test Connection** in Settings.
- Re-run an evaluation with LLM rubric items.

## Cleanup
- Delete any saved prompts created solely for testing after verification completes.
