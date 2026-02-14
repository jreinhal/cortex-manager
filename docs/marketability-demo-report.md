# Marketability Demo Report

Generated: 2026-02-06T01:33:28.688Z
API Base: http://localhost:3003/api
Flags: scan=true spawn=true eval=true index=true start-server=true

Note: local paths are redacted; replace `<REPOS_ROOT>` and `<OUTPUT_DIR>` with your environment.

## Health Checks

- Status: ok
- Config read: ok
- Analytics: ok
- Repo registry: ok
- Repo categories: ok
- Repo sizes: ok
- Runs: ok
- Observability summary: ok
- Repo scan: ok
- Vector index rebuild: ok
- Spawn (queued): ok
- Spawn job status: completed
- Evaluation run: ok

## Status

```json
{
  "status": "Online",
  "reposRoot": "<REPOS_ROOT>",
  "workspaceId": "default",
  "isFirstRun": false,
  "gitAvailable": true
}
```

## Config Snapshot

- Theme: dark
- LLM Provider: openai-compatible
- LLM Model: qwen2.5-14b-instruct-q4
- LLM Endpoint: http://localhost:8080/v1/chat/completions

## Analytics

- Total spawns: 64
- Recent spawns: 10

## Repository Coverage

- Registered repositories: 48

## Repository Categories

```json
[
  "agents",
  "benchmarks",
  "knowledge",
  "skills",
  "tools"
]
```

## Repository Sizes

```json
{
  "agents": 82754587,
  "benchmarks": 697471657,
  "knowledge": 1114530568,
  "skills": 71239605,
  "tools": 796122237
}
```

## Runs Snapshot

- Total runs: 62
- Latest run: Test the clipboard copy functionality

## Observability Summary

```json
{
  "runs": {
    "total": 62,
    "last30Days": 62,
    "totalTokens": 127794,
    "totalCost": 0,
    "avgDurationMs": 79560
  },
  "evaluations": {
    "total": 4,
    "last30Days": 4,
    "totalTokens": 0,
    "totalCost": 0
  }
}
```

## Timing Summary

- Repo scan: 4111 ms
- Spawn (job duration): 43202 ms
- Evaluation run: 147 ms
- Vector index rebuild: 4756 ms

## Scan Result

```json
{
  "success": true,
  "output": "Found 48 repositories (0 new)",
  "results": {
    "found": [
      {
        "Name": "Agent-S",
        "Path": "<REPOS_ROOT>\\agents\\Agent-S",
        "Branch": "main",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-06T01:33:30.225Z"
      },
      {
        "Name": "agent-skills",
        "Path": "<REPOS_ROOT>\\agents\\agent-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-06T01:33:30.297Z"
      },
      {
        "Name": "Awesome-AI-Agents-for-Healthcare",
        "Path": "<REPOS_ROOT>\\agents\\Awesome-AI-Agents-for-Healthcare",
        "Branch": "main",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-06T01:33:30.377Z"
      },
      {
        "Name": "hive",
        "Path": "<REPOS_ROOT>\\agents\\hive",
        "Branch": "main",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-06T01:33:30.441Z"
      },
      {
        "Name": "open-ralph-wiggum",
        "Path": "<REPOS_ROOT>\\agents\\open-ralph-wiggum",
        "Branch": "master",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-06T01:33:30.508Z"
      },
      {
        "Name": "openclaw-skills",
        "Path": "<REPOS_ROOT>\\agents\\openclaw-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-06T01:33:30.570Z"
      },
      {
        "Name": "SwiftUI-Agent-Skill",
        "Path": "<REPOS_ROOT>\\agents\\SwiftUI-Agent-Skill",
        "Branch": "main",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-06T01:33:30.632Z"
      },
      {
        "Name": "antigravity-awesome-skills",
        "Path": "<REPOS_ROOT>\\skills\\antigravity-awesome-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "skills",
        "LastScanned": "2026-02-06T01:33:30.703Z"
      },
      {
        "Name": "awesome-local-ai",
        "Path": "<REPOS_ROOT>\\skills\\awesome-local-ai",
        "Branch": "main",
        "Enabled": true,
        "Category": "skills",
        "LastScanned": "2026-02-06T01:33:30.775Z"
      },
      {
        "Name": "2e07727fb37e7301247e568b6634beff",
        "Path": "<REPOS_ROOT>\\knowledge\\2e07727fb37e7301247e568b6634beff",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:30.848Z"
      },
      {
        "Name": "AeyeGuard_cmd",
        "Path": "<REPOS_ROOT>\\knowledge\\AeyeGuard_cmd",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:30.924Z"
      },
      {
        "Name": "andrej-karpathy-skills",
        "Path": "<REPOS_ROOT>\\knowledge\\andrej-karpathy-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:30.982Z"
      },
      {
        "Name": "angular-skills",
        "Path": "<REPOS_ROOT>\\knowledge\\angular-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:31.046Z"
      },
      {
        "Name": "Awesome-Agentic-Reasoning",
        "Path": "<REPOS_ROOT>\\knowledge\\Awesome-Agentic-Reasoning",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:31.105Z"
      },
      {
        "Name": "background-agents",
        "Path": "<REPOS_ROOT>\\knowledge\\background-agents",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:31.167Z"
      },
      {
        "Name": "content",
        "Path": "<REPOS_ROOT>\\knowledge\\content",
        "Branch": "master",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:31.236Z"
      },
      {
        "Name": "copilot-sdk",
        "Path": "<REPOS_ROOT>\\knowledge\\copilot-sdk",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:31.305Z"
      },
      {
        "Name": "DISA-STIGs",
        "Path": "<REPOS_ROOT>\\knowledge\\DISA-STIGs",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:31.411Z"
      },
      {
        "Name": "google-genai-skills",
        "Path": "<REPOS_ROOT>\\knowledge\\google-genai-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:31.491Z"
      },
      {
        "Name": "hydra",
        "Path": "<REPOS_ROOT>\\knowledge\\hydra",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:31.700Z"
      },
      {
        "Name": "nist-sp-800-53-r5-data",
        "Path": "<REPOS_ROOT>\\knowledge\\nist-sp-800-53-r5-data",
        "Branch": "master",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:31.816Z"
      },
      {
        "Name": "OpenSpec",
        "Path": "<REPOS_ROOT>\\knowledge\\OpenSpec",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:31.983Z"
      },
      {
        "Name": "phileas",
        "Path": "<REPOS_ROOT>\\knowledge\\phileas",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:32.092Z"
      },
      {
        "Name": "ralphex",
        "Path": "<REPOS_ROOT>\\knowledge\\ralphex",
        "Branch": "master",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:32.201Z"
      },
      {
        "Name": "sandbox-agent",
        "Path": "<REPOS_ROOT>\\knowledge\\sandbox-agent",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:32.287Z"
      },
      {
        "Name": "skills",
        "Path": "<REPOS_ROOT>\\knowledge\\skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:32.370Z"
      },
      {
        "Name": "skills-hub",
        "Path": "<REPOS_ROOT>\\knowledge\\skills-hub",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:32.458Z"
      },
      {
        "Name": "solid-skills",
        "Path": "<REPOS_ROOT>\\knowledge\\solid-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:32.551Z"
      },
      {
        "Name": "StigRepo",
        "Path": "<REPOS_ROOT>\\knowledge\\StigRepo",
        "Branch": "master",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:32.645Z"
      },
      {
        "Name": "wg-best-practices-os-developers",
        "Path": "<REPOS_ROOT>\\knowledge\\wg-best-practices-os-developers",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-06T01:33:32.730Z"
      },
      {
        "Name": "agent-trace",
        "Path": "<REPOS_ROOT>\\tools\\agent-trace",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-06T01:33:32.805Z"
      },
      {
        "Name": "awesome-agent-skills",
        "Path": "<REPOS_ROOT>\\tools\\awesome-agent-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-06T01:33:32.885Z"
      },
      {
        "Name": "awesome-openclaw-skills",
        "Path": "<REPOS_ROOT>\\tools\\awesome-openclaw-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-06T01:33:32.959Z"
      },
      {
        "Name": "burp-ai-agent",
        "Path": "<REPOS_ROOT>\\tools\\burp-ai-agent",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-06T01:33:33.041Z"
      },
      {
        "Name": "claude-supermemory",
        "Path": "<REPOS_ROOT>\\tools\\claude-supermemory",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-06T01:33:33.124Z"
      },
      {
        "Name": "knowledge-work-plugins",
        "Path": "<REPOS_ROOT>\\tools\\knowledge-work-plugins",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-06T01:33:33.215Z"
      },
      {
        "Name": "lm-kit-net-samples",
        "Path": "<REPOS_ROOT>\\tools\\lm-kit-net-samples",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-06T01:33:33.296Z"
      },
      {
        "Name": "lobehub",
        "Path": "<REPOS_ROOT>\\tools\\lobehub",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-06T01:33:33.430Z"
      },
      {
        "Name": "pii-redaction",
        "Path": "<REPOS_ROOT>\\tools\\pii-redaction",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-06T01:33:33.516Z"
      },
      {
        "Name": "RedactAI",
        "Path": "<REPOS_ROOT>\\tools\\RedactAI",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-06T01:33:33.595Z"
      },
      {
        "Name": "temp-test-tool",
        "Path": "<REPOS_ROOT>\\tools\\temp-test-tool",
        "Branch": "master",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-06T01:33:33.674Z"
      },
      {
        "Name": "agentic-healthcare-ai",
        "Path": "<REPOS_ROOT>\\benchmarks\\agentic-healthcare-ai",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-06T01:33:33.743Z"
      },
      {
        "Name": "cai",
        "Path": "<REPOS_ROOT>\\benchmarks\\cai",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-06T01:33:33.810Z"
      },
      {
        "Name": "everything-claude-code",
        "Path": "<REPOS_ROOT>\\benchmarks\\everything-claude-code",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-06T01:33:33.876Z"
      },
      {
        "Name": "liza",
        "Path": "<REPOS_ROOT>\\benchmarks\\liza",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-06T01:33:33.945Z"
      },
      {
        "Name": "PentestGPT",
        "Path": "<REPOS_ROOT>\\benchmarks\\PentestGPT",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-06T01:33:34.025Z"
      },
      {
        "Name": "skill-scanner",
        "Path": "<REPOS_ROOT>\\benchmarks\\skill-scanner",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-06T01:33:34.102Z"
      },
      {
        "Name": "voicetree",
        "Path": "<REPOS_ROOT>\\benchmarks\\voicetree",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-06T01:33:34.174Z"
      }
    ],
    "errors": [],
    "newRepos": 0,
    "existingRepos": 48
  }
}
```

## Spawn Result

```json
{
  "success": true,
  "queued": true,
  "job": {
    "id": "job-1770341619223-qszoee",
    "type": "spawn",
    "payload": {
      "goal": "[DEMO] Marketability walkthrough spawn",
      "format": "universal",
      "workspaceId": "default",
      "reposRoot": "<REPOS_ROOT>",
      "outputDir": "<OUTPUT_DIR>"
    },
    "status": "queued",
    "createdAt": "2026-02-06T01:33:39.223Z",
    "updatedAt": "2026-02-06T01:33:39.223Z",
    "createdBy": "local",
    "workspaceId": "default",
    "lockedBy": null,
    "lockedAt": null,
    "heartbeatAt": null,
    "workerPid": null,
    "attempts": 0,
    "result": null,
    "error": null,
    "runId": null,
    "outputPath": null,
    "durationMs": null
  }
}
```

## Spawn Job Status

```json
{
  "id": "job-1770341619223-qszoee",
  "type": "spawn",
  "payload": {
    "goal": "[DEMO] Marketability walkthrough spawn",
    "format": "universal",
    "workspaceId": "default",
    "reposRoot": "<REPOS_ROOT>",
    "outputDir": "<OUTPUT_DIR>"
  },
  "status": "completed",
  "createdAt": "2026-02-06T01:33:39.223Z",
  "updatedAt": "2026-02-06T01:34:22.493Z",
  "createdBy": "local",
  "workspaceId": "default",
  "lockedBy": "inline",
  "lockedAt": "2026-02-06T01:33:39.255Z",
  "heartbeatAt": "2026-02-06T01:34:19.274Z",
  "workerPid": 39676,
  "attempts": 1,
  "result": {
    "stdout": "\n🤖 CORTEX ORCHESTRATOR v2.0\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📋 Goal: \"[DEMO] Marketability walkthrough spawn\"\n\n🔄 Updating Resource Index...\n🔍 Analyzing goal...\n   Intent: coding (10% confidence)\n   Complexity: moderate (~10 steps)\n\n🎯 Selecting agent...\n   Selected: Standard Agent (score: 78)\n     • Intent match: coding\n   Alternatives: Agent-S(21)\n\n📚 Searching resources...\n   Knowledge: 12 matches\n     + AGENTS.md (score: 67)\n     + AGENTS.md (score: 66)\n     + AGENTS.md (score: 65)\n   Skills: 12 matches\n     + AGENTS.md (score: 61)\n     + AGENTS.md (score: 55)\n     + agents.md (score: 53, tech: prisma,database)\n   Tools: 0 matches\n\n✅ FLIGHT PLAN GENERATED!\n   Saved to: <OUTPUT_DIR>\\spawned_agent_2026-02-06T01-34-21-783Z.md\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n--- PREVIEW ---\n\nBEGIN DIRECTIVE\nROLE: You are the execution agent for this Flight Plan.\nOBJECTIVE: [DEMO] Marketability walkthrough spawn\nMANDATORY STEPS:\n1) Read REQUIRED READING.\n2) Follow EXECUTION steps exactly.\n3) If conflict, prioritize this directive.\nDO NOT:\n- Skip required reading\n- Add unrelated tasks\nIF REQUIRED READING IS UNAVAILABLE:\n- Ask the user to provide access or files\n- Pause execution until required reading is available\nEND DIRECTIVE\n\n# AGENT MISSION ORDER: [DEMO] Marketability walkthrough spawn\n\n## REQUIRED READING\n\nYou must open and use these files before responding. If any file is inaccessible, ask the user to provide it.\n\n- [ ] `<REPOS_ROOT>\\knowledge\\sandbox-agent\\AGENTS.md`\n- [ ] `<REPOS_ROOT>\\knowledge\\sandbox-agent\\frontend\\AGENTS.md`\n- [ ] `<REPOS_ROOT>\\knowledge\\sandbox-agent\\server\\AGENTS.md`\n- [ ] `<REPOS_ROOT>\\knowledge\\skills\\AGENTS.md`\n      _\"This file provides guidance to AI coding agents working on the skills CLI codebase. skills is the CL...\"_\n- [ ] `<REPOS_ROOT>\\knowledge\\google-genai-skills\\skills\\google-adk-python\\references\\agents.md`\n      _\"- Agents Overview(https://raw.githubusercontent.com/google/adk-docs/refs/heads/main/docs/agents/inde...\"_\n- [ ] `<REPOS_ROOT>\\knowledge\\OpenSpec\\AGENTS.md`\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\react-best-practices\\AGENTS.md`\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\postgres-best-practices\\AGENTS.md`\n      _\"Postgres Best Practices > This document is optimized for AI agents and LLMs. Rules are prioritized b...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\references\\agents.md`\n      _\"Agent Type Definitions Complete specifications for all 37 specialized agent types in the Loki Mode m...\"_\n      **Tech:** prisma, database, orm, mongodb, testing, devops, containers\n- [ ] `<REPOS_ROOT>\\knowledge\\background-agents\\packages\\web\\tsconfig.json`\n      _\"\"lib\": \"dom\", \"dom.iterable\", \"ES2022\", \"skipLibCheck\": true, \"esModuleInterop\": true,...\"_\n      **Tech:** typescript\n- [ ] `<REPOS_ROOT>\\knowledge\\content\\controls\\hipaa.yml`\n      **Tech:** yaml, devops\n- [ ] `<REPOS_ROOT>\\knowledge\\background-agents\\packages\\web\\package-lock.json`\n- [ ] `<REPOS_ROOT>\\knowledge\\hydra\\hydra-ext\\demos\\genpg\\README.md`\n      _\"GenPG demo - property graph generation from CSV tables This demo demonstrates end-to-end transformat...\"_\n- [ ] `<REPOS_ROOT>\\knowledge\\hydra\\hydra-haskell\\src\\gen-main\\json\\hydra\\util.json`\n      _\"\"description\": \"General-purpose utility types used across Hydra.\", \"name\": \"hydra.util.CaseConventio...\"_\n- [ ] `<REPOS_ROOT>\\knowledge\\hydra\\hydra-haskell\\src\\gen-main\\json\\hydra\\extract\\json.json`\n      _\"\"description\": \"Utilities for extracting values from JSON objects\", \"name\": \"hydra.extract.json.expe...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\demo\\README.md`\n      _\"Video demonstration of Loki Mode - Multi-agent autonomous startup system. The record-full-demo.sh sc...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\ai-product\\SKILL.md`\n      _\"description: \"Every product will be AI-powered. The question is whether you'll build it right or shi...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\demo\\voice-over-script.md`\n      _\"Loki Mode Voice-Over Script Complete narration for Loki Mode demo video. Introduction (0:00 - 0:30)...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\azure-functions\\SKILL.md`\n      _\"name: azure-functions description: \"Expert patterns for Azure Functions development including isolat...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\CHANGELOG.md`\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\theme-factory\\themes\\sunset-boulevard.md`\n      _\"A warm and vibrant theme inspired by golden hour sunsets, perfect for energetic and creative present...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\theme-factory\\themes\\botanical-garden.md`\n      _\"A fresh and organic theme featuring vibrant garden-inspired colors for lively presentations. - Fern ...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\form-cro\\SKILL.md`\n      _\"Optimize any form that is NOT signup or account registration — including lead capture, contact, demo...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\database-cloud-optimization-cost-optimize\\resources\\implementation-playbook.md`\n> AGENTS.md instructions are highest priority and should be read first.\n\n> If skills are listed, explore project context first, then consult skills as reference.\n\n\n## 1. IDENTITY ASSIGNMENT\n\n**Selected Agent:** Standard Agent\n**Agent ID:** std-agent\n**Selection Score:** 78/100 (93% confidence)\n\n**Directive:** Read and adopt the persona defined in:\n`<REPOS_ROOT>\\agents\\std-agent\\template.md`\n\n### Selection Rationale\n- Intent match: coding\n\n### Alternative Agents\n- **Agent-S** (score: 21) - Generalist OS Agent for GUI, Browser, and Desktop interaction.\n\n## 2. GOAL ANALYSIS\n\n| Dimension | Value |\n|-----------|-------|\n| **Primary Intent** | coding |\n| **Confidence** | 10% |\n| **Complexity** | moderate |\n| **Estimated Steps** | ~10 |\n| **Action Type** | unknown |\n| **Destructive** | No |\n| **Requires Review** | ✋ Yes |\n\n\n### Required Capabilities\n- fileSystem\n\n\n## 2.5 DECISION MATRIX\n\n- Instruction priority: AGENTS.md first\n- Retrieval gate: enabled (signals present)\n- Query expansion: 0 variants, 5 keywords\n- RAG-Fusion: not used\n- HyDE fallback: not used\n- Hybrid retrieval: enabled\n- Semantic index: used\n- Routing: HIGH_RECALL (Low intent confidence)\n- RRF fusion: enabled\n- Late interaction rerank: used\n- LLM agent mode: advisory\n- LLM agent router: not used (LLM HTTP 500)\n- LLM resource mode: lowConfidence\n- Resource rerank: not used\n- Uncertainty: 98%\n- Low confidence: no\n- Ambiguous top score: no\n\n## 2.6 DECISION TRACE (SUMMARY)\n- goal_analysis: intent=coding, confidence=0.1, keywords=5, expandedKeywords=5, routing=HIGH_RECALL, uncertainty=0.98\n- retrieval_gate: enabled=true, reason=signals present, forced=false\n- agent_llm_router: mode=advisory, used=false, forced=true, accepted=false, reason=LLM HTTP 500\n- agent_selection: selected=std-agent, lowConfidence=false, ambiguous=false, rerankUsed=false, rerankAccepted=false, rerankMode=advisory\n- resource_selection: knowledge=12, skills=12, tools=0, rrfUsed=true, ragFusionUsed=false, hydeUsed=false, hybridUsed=true, lateInteractionUsed=true, retrievalEnabled=true, routingMode=HIGH_RECALL\n\n## 3. INTELLIGENCE BRIEFING\n\nThe Orchestrator has identified the following resources using **semantic matching** and **tech stack filtering**.\n**ACTION:** Use your file reading tools to ingest these documents.\n\n### KNOWLEDGE (Context)\n- [ ] `<REPOS_ROOT>\\knowledge\\sandbox-agent\\AGENTS.md`\n- [ ] `<REPOS_ROOT>\\knowledge\\sandbox-agent\\frontend\\AGENTS.md`\n- [ ] `<REPOS_ROOT>\\knowledge\\sandbox-agent\\server\\AGENTS.md`\n- [ ] `<REPOS_ROOT>\\knowledge\\skills\\AGENTS.md`\n      _\"This file provides guidance to AI coding agents working on the skills CLI codebase. skills is the CL...\"_\n- [ ] `<REPOS_ROOT>\\knowledge\\google-genai-skills\\skills\\google-adk-python\\references\\agents.md`\n      _\"- Agents Overview(https://raw.githubusercontent.com/google/adk-docs/refs/heads/main/docs/agents/inde...\"_\n- [ ] `<REPOS_ROOT>\\knowledge\\OpenSpec\\AGENTS.md`\n- [ ] `<REPOS_ROOT>\\knowledge\\background-agents\\packages\\web\\tsconfig.json`\n      _\"\"lib\": \"dom\", \"dom.iterable\", \"ES2022\", \"skipLibCheck\": true, \"esModuleInterop\": true,...\"_\n      **Tech:** typescript\n- [ ] `<REPOS_ROOT>\\knowledge\\content\\controls\\hipaa.yml`\n      **Tech:** yaml, devops\n- [ ] `<REPOS_ROOT>\\knowledge\\background-agents\\packages\\web\\package-lock.json`\n- [ ] `<REPOS_ROOT>\\knowledge\\hydra\\hydra-ext\\demos\\genpg\\README.md`\n      _\"GenPG demo - property graph generation from CSV tables This demo demonstrates end-to-end transformat...\"_\n- [ ] `<REPOS_ROOT>\\knowledge\\hydra\\hydra-haskell\\src\\gen-main\\json\\hydra\\util.json`\n      _\"\"description\": \"General-purpose utility types used across Hydra.\", \"name\": \"hydra.util.CaseConventio...\"_\n- [ ] `<REPOS_ROOT>\\knowledge\\hydra\\hydra-haskell\\src\\gen-main\\json\\hydra\\extract\\json.json`\n      _\"\"description\": \"Utilities for extracting values from JSON objects\", \"name\": \"hydra.extract.json.expe...\"_\n\n### SKILLS (Procedures)\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\react-best-practices\\AGENTS.md`\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\postgres-best-practices\\AGENTS.md`\n      _\"Postgres Best Practices > This document is optimized for AI agents and LLMs. Rules are prioritized b...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\references\\agents.md`\n      _\"Agent Type Definitions Complete specifications for all 37 specialized agent types in the Loki Mode m...\"_\n      **Tech:** prisma, database, orm, mongodb, testing, devops, containers\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\demo\\README.md`\n      _\"Video demonstration of Loki Mode - Multi-agent autonomous startup system. The record-full-demo.sh sc...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\ai-product\\SKILL.md`\n      _\"description: \"Every product will be AI-powered. The question is whether you'll build it right or shi...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\demo\\voice-over-script.md`\n      _\"Loki Mode Voice-Over Script Complete narration for Loki Mode demo video. Introduction (0:00 - 0:30)...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\azure-functions\\SKILL.md`\n      _\"name: azure-functions description: \"Expert patterns for Azure Functions development including isolat...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\CHANGELOG.md`\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\theme-factory\\themes\\sunset-boulevard.md`\n      _\"A warm and vibrant theme inspired by golden hour sunsets, perfect for energetic and creative present...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\theme-factory\\themes\\botanical-garden.md`\n      _\"A fresh and organic theme featuring vibrant garden-inspired colors for lively presentations. - Fern ...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\form-cro\\SKILL.md`\n      _\"Optimize any form that is NOT signup or account registration — including lead capture, contact, demo...\"_\n- [ ] `<REPOS_ROOT>\\skills\\antigravity-awesome-skills\\skills\\database-cloud-optimization-cost-optimize\\resources\\implementation-playbook.md`\n\n### TOOLS (Capabilities)\n_No matching tool resources found._\n\n## 4. EXECUTION\n\nOnce you have read the above files, proceed to execute the objective:\n\n> [DEMO] Marketability walkthrough spawn\n\n### Execution Guidelines\n1. Follow the intent: **coding**\n2. Complexity level: **moderate** - plan accordingly\n3. ✋ This task requires human review before finalizing\n\n\n---\n_Generated by CORTEX Orchestrator v2.0_\n_Timestamp: 2026-02-06T01:34:21.783Z_\n_Agent: std-agent_\n_Intent: coding (10% confidence)_\n_Complexity: moderate_\n_Format: universal_\n_Resources: 24 files_\n\n",
    "stderr": ""
  },
  "error": null,
  "runId": "run-1770341661785-0fw13d",
  "outputPath": "<OUTPUT_DIR>\\spawned_agent_2026-02-06T01-34-21-783Z.md",
  "durationMs": 43202,
  "startedAt": "2026-02-06T01:33:39.255Z"
}
```

## Evaluation Result

```json
{
  "success": true,
  "evaluation": {
    "id": "eval-1770341664498-gm3g36",
    "name": "Marketability Demo Retrieval Evaluation",
    "type": "retrieval",
    "datasetId": "dataset-1770341664397-5miq2v",
    "datasetName": "Marketability Demo 2026-02-06T01:34:24.355Z",
    "datasetVersion": 2,
    "datasetUpdatedAt": "2026-02-06T01:34:24.441Z",
    "runId": null,
    "runGoal": null,
    "createdAt": "2026-02-06T01:34:24.498Z",
    "workspaceId": "default",
    "status": "needs-review",
    "metrics": {
      "topK": 5,
      "itemCount": 1,
      "scoredCount": 0,
      "precisionAtK": 0,
      "recallAtK": 0,
      "mrr": 0,
      "score": 0,
      "passRate": 0,
      "status": "needs-review"
    },
    "usage": {
      "tokensEstimated": 0,
      "costEstimated": 0,
      "currency": "USD",
      "llmCalls": 0
    },
    "items": [
      {
        "id": "item-1770341664441-g5f2nk",
        "input": "Locate AGENTS.md in the knowledge skills repository",
        "expectedPaths": [],
        "status": "needs-review",
        "precision": 0,
        "recall": 0,
        "mrr": 0,
        "matches": []
      }
    ]
  }
}
```

## Vector Index Rebuild Result

```json
{
  "success": true,
  "queued": true,
  "job": {
    "id": "job-1770341614271-u865xh",
    "type": "vector-index",
    "payload": {
      "workspaceId": "default",
      "reposRoot": "<REPOS_ROOT>"
    },
    "status": "queued",
    "createdAt": "2026-02-06T01:33:34.271Z",
    "updatedAt": "2026-02-06T01:33:34.271Z",
    "createdBy": "local",
    "workspaceId": "default",
    "lockedBy": null,
    "lockedAt": null,
    "heartbeatAt": null,
    "workerPid": null,
    "attempts": 0,
    "result": null,
    "error": null,
    "runId": null,
    "outputPath": null,
    "durationMs": null
  }
}
```

## Vector Index Job Status

```json
{
  "id": "job-1770341614271-u865xh",
  "type": "vector-index",
  "payload": {
    "workspaceId": "default",
    "reposRoot": "<REPOS_ROOT>"
  },
  "status": "completed",
  "createdAt": "2026-02-06T01:33:34.271Z",
  "updatedAt": "2026-02-06T01:33:39.081Z",
  "createdBy": "local",
  "workspaceId": "default",
  "lockedBy": "inline",
  "lockedAt": "2026-02-06T01:33:34.304Z",
  "heartbeatAt": "2026-02-06T01:33:34.304Z",
  "workerPid": 39676,
  "attempts": 1,
  "result": {
    "enabled": true,
    "mode": "hash",
    "builtAt": "2026-02-06T01:33:38.429Z",
    "docCount": 6203,
    "vectorDim": 512
  },
  "error": null,
  "runId": null,
  "outputPath": null,
  "durationMs": 4756,
  "startedAt": "2026-02-06T01:33:34.304Z"
}
```
