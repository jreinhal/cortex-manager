# Decision Matrix: Agent + Resource Selection

This document defines the selection pipeline for CORTEX. It blends a deterministic baseline with an optional Qwen2.5 14B Instruct Q4 reranker, and enforces instruction-first guidance from AGENTS.md.

## Goals
- Make selection reproducible and debuggable (deterministic first pass).
- Treat AGENTS.md as the highest-priority instruction source.
- Use Qwen only as a controlled reranker with strict JSON output.
- Preserve manual overrides and safe fallbacks.

## Inputs
- User goal text + analyzed goal metadata (intent, tech stack, complexity).
- Agent profiles + disambiguation rules.
- Resource index (knowledge, skills, tools) and path signals.
- AGENTS.md files (wherever present in repo roots).

## Deterministic Baseline

### Agent Selection
Weights and logic:
- Intent match
- Domain expertise
- Task-type affinity
- Capability match
- Complexity fit
- Signal boosts/penalties
- Contextual disambiguation rules

### Resource Selection
Scoring signals:
- Filename/keyword match
- Tech stack match
- Domain match
- Content summary match
- Quality heuristic (file size)
- Path priority (entrypoints > docs > references)
- Instruction boost for AGENTS.md

## Instruction Priority (AGENTS.md)
AGENTS.md instructions are treated as the highest priority:
- Any AGENTS.md file is always surfaced in required reading.
- AGENTS.md resources receive a strong score boost and sort ahead of skills.
- Skills remain useful for depth, but are secondary to explicit instructions.

## Gating Rules (Safety + Reliability)
- **Low-confidence gate:** If deterministic confidence is low, require human review.
- **Ambiguity gate:** If top 2 scores are too close, flag ambiguity.
- **Instruction gate:** If AGENTS.md exists, it must appear first in required reading.
- **Rerank gate:** LLM rerank only applies when enabled and valid, otherwise fallback.
- **Mismatch gate:** If LLM order conflicts with strong deterministic signals, keep deterministic.

## Optional LLM Rerank (Qwen2.5 14B Instruct Q4)
Rerank only the top N candidates, return strict JSON:

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
