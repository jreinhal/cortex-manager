# Marketability Readiness Checklist (Living)

Audience: Data Engineers, AI Scientists, Software Engineers

## 1. Positioning & Messaging
- [ ] Clear 1-sentence value proposition focused on local-first orchestration + auditable flight plans
- [ ] Competitive differentiation (local-first, auditability, deterministic routing, evaluation lab)
- [x] Target personas documented with primary jobs-to-be-done (docs/personas.md)

## 2. Core Product Fit
- [ ] Agent Factory produces repeatable flight plans (Decision Matrix + Required Reading)
- [ ] Knowledge/Skills/Tools repos can be added, scanned, categorized, and size-audited
- [ ] Evaluation Lab supports dataset creation + rubric grading (LLM optional)
- [x] Run Explorer shows trace timelines + artifacts with export

## 3. Integrations & Extensibility
- [x] OpenAI-compatible LLM endpoints (Ollama/LM Studio/hosted) with clear setup (docs/llm-endpoints-setup.md)
- [ ] Pluggable retrieval backends (hybrid + rerank) documented
- [ ] CLI or API for automation (spawn, scan, evaluate)

## 4. Reliability & Performance
- [x] End-to-end spawn latency benchmarks published (docs/performance-benchmarks.md)
- [x] Repos scan + index rebuild timings are visible (docs/marketability-demo-report.md)
- [ ] Background queue operational for long-running spawns

## 5. Security & Compliance
- [x] Local-first storage controls and encrypted-at-rest guidance (docs/storage-security.md)
- [ ] Audit Trail provides exportable logs and metadata
- [ ] RBAC policy editor with validation and guardrails

## 6. UX & Onboarding
- [ ] First-run wizard is robust and unblocks quickly
- [ ] Quickstart checklist is accessible in-app
- [ ] Glassbox generation chain shows transparent steps + durations

## 7. Documentation & Proof
- [x] Setup guide for local LLM endpoints with screenshots (docs/llm-endpoints-setup.md)
- [x] Evaluation methodology documented (precision/recall/MRR, LLM rubric) (docs/evaluation-methodology.md)
- [x] Reference implementation projects/examples (docs/reference-implementations.md)

## 8. Sales Readiness
- [ ] Demo script with datasets and expected outputs
- [x] Pricing model aligned to local-first + enterprise needs (docs/pricing-and-support.md)
- [x] Support/SLAs and deployment requirements specified (docs/pricing-and-support.md)

## Notes
- Treat this checklist as a living document and update after every release.
