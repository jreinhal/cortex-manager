# Decision Matrix: Agent + Resource Selection

This document defines the selection pipeline for CORTEX. It blends a deterministic baseline with an LLM-assisted agent router (advisory by default) plus an optional Qwen2.5 14B Instruct Q4 resource reranker, and enforces instruction-first guidance from AGENTS.md.

## Goals
- Make selection reproducible and debuggable (deterministic first pass).
- Treat AGENTS.md as the highest-priority instruction source.
- Use Qwen as a controlled agent router + reranker with strict JSON output.
- Preserve manual overrides and safe fallbacks.

## Inputs
- User goal text + analyzed goal metadata (intent, tech stack, complexity).
- Agent profiles + disambiguation rules.
- Resource index (knowledge, skills, tools) and path signals.
- AGENTS.md files (wherever present in repo roots).

## Deterministic Baseline

### Retrieval Gate
Before any retrieval, CORTEX applies a query‑classification gate:
- Skip retrieval if the goal is too vague (low keyword/tech signals) or the user explicitly opts out.
- Force retrieval for research/analysis intents or explicit research phrasing.

### Query Expansion + Routing
We expand goals deterministically (synonyms + reformulations) and compute an expanded keyword set. When enabled, CORTEX performs multi‑query RAG‑Fusion by running retrieval per variant and fusing results with RRF.

Routing modes:
- **NO_RESOURCES**: Goal is too vague (no keywords + no tech signals). Ask for clarification.
- **DOCUMENT**: Default document-level retrieval.
- **HIGH_RECALL**: Complex or ambiguous goals; broaden the candidate pool.

### Agent Selection
Weights and logic:
- Intent match
- Domain expertise
- Task-type affinity
- Capability match
- Complexity fit
- Signal boosts/penalties
- Contextual disambiguation rules

LLM agent router (advisory by default):
- When enabled, the LLM can reorder top agent candidates.
- By default, it **runs every time** but only overrides deterministic choice when confidence is low or the top score is ambiguous.
- Configure `decisionMatrix.llmRerank.agentMode` to change behavior (`lowConfidence`, `advisory`, `always`, `never`).

### Resource Selection
Scoring signals:
- Filename/keyword match
- Tech stack match
- Domain match
- Content summary match
- Quality heuristic (file size)
- Path priority (entrypoints > docs > references)
- Instruction boost for AGENTS.md
- Hybrid retrieval (sparse + semantic) with RRF fusion.
- RAG‑Fusion across query variants with RRF.
- HyDE fallback: generate a hypothetical query document to boost recall when results are thin.
- Reciprocal Rank Fusion (RRF) across key signals (filename, keywords, tech, domain, content, path).
- Optional vector index (hash or embedding) to boost semantic recall on large repos.

### Uncertainty + Review Gate
We compute an uncertainty score from intent confidence, keyword coverage, tech signals, and complexity. High uncertainty automatically flips **Requires Review** to yes, enforcing a human checkpoint.

### Late Interaction Rerank (ColBERT‑style)
Top‑K results receive a token‑level max‑similarity rerank to improve precision without full LLM cost.

## Instruction Priority (AGENTS.md)
AGENTS.md instructions are treated as the highest priority:
- Any AGENTS.md file is always surfaced in required reading.
- AGENTS.md resources receive a strong score boost and sort ahead of skills.
- Skills remain useful for depth, but are secondary to explicit instructions.

### Why AGENTS.md First
- External evals show instruction-centric context (AGENTS.md) can outperform skills in accuracy and reliability.
- Skills are most effective when explicitly invoked with clear sequencing (e.g., explore context first, then consult skills).
These findings drive the "AGENTS-first + explicit skill usage" policy in this pipeline.

## Gating Rules (Safety + Reliability)
- **Low-confidence gate:** If deterministic confidence is low, require human review.
- **Ambiguity gate:** If top 2 scores are too close, flag ambiguity.
- **Instruction gate:** If AGENTS.md exists, it must appear first in required reading.
- **Agent router gate:** LLM agent routing runs in advisory mode by default; it only overrides when low confidence/ambiguity gates trigger (unless configured to `always`).
- **Resource rerank gate:** LLM resource rerank only applies when enabled and low confidence/uncertainty conditions are met (unless configured to `always`).
- **Mismatch gate:** If LLM order conflicts with strong deterministic signals, keep deterministic.
- **Approval gate:** When confidence/ambiguity triggers, require a human review step before finalizing.
This keeps the selection flow explicit and stateful, with clear fallbacks.

## LLM Agent Router + Resource Rerank (Qwen2.5 14B Instruct Q4)
The LLM can be used in two places:
- **Agent router:** reorders top agent candidates (advisory by default).
- **Resource rerank:** reorders top resources when uncertainty is high.

Rerank only the top N candidates, return strict JSON:

Applied only when the low‑confidence/uncertainty gate is triggered (unless configured to `advisory` / `always` for agents or `always` for resources).

Config keys (decisionMatrix.llmRerank):
- `agentMode`: `advisory` (default), `lowConfidence`, `always`, `never`
- `resourceMode`: `lowConfidence` (default), `always`, `never`

Schema:
```
{
  "order": ["id-or-path-1", "id-or-path-2", "..."],
  "scores": { "id-or-path-1": 0.91, "id-or-path-2": 0.82 }
}
```

Rules for the model:
- Keep AGENTS.md first if present.
- Use minimal output, JSON only.
- Never remove candidates; only reorder.

## Decision Trace
Every run emits a lightweight decision trace summary in the flight plan (goal analysis, routing mode, uncertainty, agent selection, and resource counts). This mirrors structured reasoning traces from RAG systems while keeping output deterministic and auditable.

## D: Drive Installation (Windows)
Install and store all local model artifacts on D:\:
- Model directory: `D:\Models\qwen2.5-14b-instruct-q4`
- Set `LLM_MODEL_DIR` or `OLLAMA_MODELS` to a D:\ path
- Point the local inference server to the D:\ model path

## References (Design Influence)
- https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals
- https://jpcaparas.medium.com/vercel-says-agents-md-matters-more-than-skills-should-we-listen-d83d7dc2d978
- https://medium.com/@tangi.vass/turning-ai-coding-agents-into-senior-engineering-peers-c3d178621c9e
- https://github.com/liza-mas/liza
