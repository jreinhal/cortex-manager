# Marketability Demo Report

Generated: 2026-02-04T19:25:51.874Z
API Base: http://localhost:3003/api
Flags: scan=true spawn=true eval=true start-server=true

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
- Spawn (queued): ok
- Spawn job status: completed
- Evaluation run: ok

## Status

```json
{
  "status": "Online",
  "reposRoot": "D:\\Projects\\reference-repos",
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

- Total spawns: 59
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

- Total runs: 55
- Latest run: [DEMO] Marketability walkthrough spawn

## Observability Summary

```json
{
  "runs": {
    "total": 55,
    "last30Days": 55,
    "totalTokens": 112534,
    "totalCost": 0,
    "avgDurationMs": 76744
  },
  "evaluations": {
    "total": 2,
    "last30Days": 2,
    "totalTokens": 0,
    "totalCost": 0
  }
}
```

## Scan Result

```json
{
  "success": true,
  "output": "Found 48 repositories (0 new)",
  "results": {
    "found": [
      {
        "Name": "Agent-S",
        "Path": "D:\\Projects\\reference-repos\\agents\\Agent-S",
        "Branch": "main",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-04T19:26:04.360Z"
      },
      {
        "Name": "agent-skills",
        "Path": "D:\\Projects\\reference-repos\\agents\\agent-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-04T19:26:04.413Z"
      },
      {
        "Name": "Awesome-AI-Agents-for-Healthcare",
        "Path": "D:\\Projects\\reference-repos\\agents\\Awesome-AI-Agents-for-Healthcare",
        "Branch": "main",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-04T19:26:04.467Z"
      },
      {
        "Name": "hive",
        "Path": "D:\\Projects\\reference-repos\\agents\\hive",
        "Branch": "main",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-04T19:26:04.523Z"
      },
      {
        "Name": "open-ralph-wiggum",
        "Path": "D:\\Projects\\reference-repos\\agents\\open-ralph-wiggum",
        "Branch": "master",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-04T19:26:04.583Z"
      },
      {
        "Name": "openclaw-skills",
        "Path": "D:\\Projects\\reference-repos\\agents\\openclaw-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-04T19:26:04.642Z"
      },
      {
        "Name": "SwiftUI-Agent-Skill",
        "Path": "D:\\Projects\\reference-repos\\agents\\SwiftUI-Agent-Skill",
        "Branch": "main",
        "Enabled": true,
        "Category": "agents",
        "LastScanned": "2026-02-04T19:26:04.708Z"
      },
      {
        "Name": "antigravity-awesome-skills",
        "Path": "D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "skills",
        "LastScanned": "2026-02-04T19:26:04.769Z"
      },
      {
        "Name": "awesome-local-ai",
        "Path": "D:\\Projects\\reference-repos\\skills\\awesome-local-ai",
        "Branch": "main",
        "Enabled": true,
        "Category": "skills",
        "LastScanned": "2026-02-04T19:26:04.831Z"
      },
      {
        "Name": "2e07727fb37e7301247e568b6634beff",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\2e07727fb37e7301247e568b6634beff",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:04.889Z"
      },
      {
        "Name": "AeyeGuard_cmd",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\AeyeGuard_cmd",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:04.944Z"
      },
      {
        "Name": "andrej-karpathy-skills",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\andrej-karpathy-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.001Z"
      },
      {
        "Name": "angular-skills",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\angular-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.054Z"
      },
      {
        "Name": "Awesome-Agentic-Reasoning",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\Awesome-Agentic-Reasoning",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.114Z"
      },
      {
        "Name": "background-agents",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\background-agents",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.171Z"
      },
      {
        "Name": "content",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\content",
        "Branch": "master",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.224Z"
      },
      {
        "Name": "copilot-sdk",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\copilot-sdk",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.282Z"
      },
      {
        "Name": "DISA-STIGs",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\DISA-STIGs",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.337Z"
      },
      {
        "Name": "google-genai-skills",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\google-genai-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.392Z"
      },
      {
        "Name": "hydra",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\hydra",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.449Z"
      },
      {
        "Name": "nist-sp-800-53-r5-data",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\nist-sp-800-53-r5-data",
        "Branch": "master",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.506Z"
      },
      {
        "Name": "OpenSpec",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\OpenSpec",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.559Z"
      },
      {
        "Name": "phileas",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\phileas",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.610Z"
      },
      {
        "Name": "ralphex",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\ralphex",
        "Branch": "master",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.663Z"
      },
      {
        "Name": "sandbox-agent",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\sandbox-agent",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.714Z"
      },
      {
        "Name": "skills",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.766Z"
      },
      {
        "Name": "skills-hub",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\skills-hub",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.821Z"
      },
      {
        "Name": "solid-skills",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\solid-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.879Z"
      },
      {
        "Name": "StigRepo",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\StigRepo",
        "Branch": "master",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.935Z"
      },
      {
        "Name": "wg-best-practices-os-developers",
        "Path": "D:\\Projects\\reference-repos\\knowledge\\wg-best-practices-os-developers",
        "Branch": "main",
        "Enabled": true,
        "Category": "knowledge",
        "LastScanned": "2026-02-04T19:26:05.993Z"
      },
      {
        "Name": "agent-trace",
        "Path": "D:\\Projects\\reference-repos\\tools\\agent-trace",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-04T19:26:06.049Z"
      },
      {
        "Name": "awesome-agent-skills",
        "Path": "D:\\Projects\\reference-repos\\tools\\awesome-agent-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-04T19:26:06.106Z"
      },
      {
        "Name": "awesome-openclaw-skills",
        "Path": "D:\\Projects\\reference-repos\\tools\\awesome-openclaw-skills",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-04T19:26:06.160Z"
      },
      {
        "Name": "burp-ai-agent",
        "Path": "D:\\Projects\\reference-repos\\tools\\burp-ai-agent",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-04T19:26:06.217Z"
      },
      {
        "Name": "claude-supermemory",
        "Path": "D:\\Projects\\reference-repos\\tools\\claude-supermemory",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-04T19:26:06.269Z"
      },
      {
        "Name": "knowledge-work-plugins",
        "Path": "D:\\Projects\\reference-repos\\tools\\knowledge-work-plugins",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-04T19:26:06.326Z"
      },
      {
        "Name": "lm-kit-net-samples",
        "Path": "D:\\Projects\\reference-repos\\tools\\lm-kit-net-samples",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-04T19:26:06.381Z"
      },
      {
        "Name": "lobehub",
        "Path": "D:\\Projects\\reference-repos\\tools\\lobehub",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-04T19:26:06.434Z"
      },
      {
        "Name": "pii-redaction",
        "Path": "D:\\Projects\\reference-repos\\tools\\pii-redaction",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-04T19:26:06.488Z"
      },
      {
        "Name": "RedactAI",
        "Path": "D:\\Projects\\reference-repos\\tools\\RedactAI",
        "Branch": "main",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-04T19:26:06.542Z"
      },
      {
        "Name": "temp-test-tool",
        "Path": "D:\\Projects\\reference-repos\\tools\\temp-test-tool",
        "Branch": "master",
        "Enabled": true,
        "Category": "tools",
        "LastScanned": "2026-02-04T19:26:06.597Z"
      },
      {
        "Name": "agentic-healthcare-ai",
        "Path": "D:\\Projects\\reference-repos\\benchmarks\\agentic-healthcare-ai",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-04T19:26:06.651Z"
      },
      {
        "Name": "cai",
        "Path": "D:\\Projects\\reference-repos\\benchmarks\\cai",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-04T19:26:06.716Z"
      },
      {
        "Name": "everything-claude-code",
        "Path": "D:\\Projects\\reference-repos\\benchmarks\\everything-claude-code",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-04T19:26:06.773Z"
      },
      {
        "Name": "liza",
        "Path": "D:\\Projects\\reference-repos\\benchmarks\\liza",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-04T19:26:06.828Z"
      },
      {
        "Name": "PentestGPT",
        "Path": "D:\\Projects\\reference-repos\\benchmarks\\PentestGPT",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-04T19:26:06.884Z"
      },
      {
        "Name": "skill-scanner",
        "Path": "D:\\Projects\\reference-repos\\benchmarks\\skill-scanner",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-04T19:26:06.937Z"
      },
      {
        "Name": "voicetree",
        "Path": "D:\\Projects\\reference-repos\\benchmarks\\voicetree",
        "Branch": "main",
        "Enabled": true,
        "Category": "benchmarks",
        "LastScanned": "2026-02-04T19:26:06.991Z"
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
    "id": "job-1770233167054-imivug",
    "type": "spawn",
    "payload": {
      "goal": "[DEMO] Marketability walkthrough spawn",
      "format": "universal",
      "workspaceId": "default",
      "reposRoot": "D:\\Projects\\reference-repos",
      "outputDir": "D:\\Projects\\reference-manager\\spawned_agents"
    },
    "status": "queued",
    "createdAt": "2026-02-04T19:26:07.054Z",
    "updatedAt": "2026-02-04T19:26:07.054Z",
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
  "id": "job-1770233167054-imivug",
  "type": "spawn",
  "payload": {
    "goal": "[DEMO] Marketability walkthrough spawn",
    "format": "universal",
    "workspaceId": "default",
    "reposRoot": "D:\\Projects\\reference-repos",
    "outputDir": "D:\\Projects\\reference-manager\\spawned_agents"
  },
  "status": "completed",
  "createdAt": "2026-02-04T19:26:07.054Z",
  "updatedAt": "2026-02-04T19:26:42.712Z",
  "createdBy": "local",
  "workspaceId": "default",
  "lockedBy": "inline",
  "lockedAt": "2026-02-04T19:26:07.085Z",
  "heartbeatAt": "2026-02-04T19:26:39.109Z",
  "workerPid": 5960,
  "attempts": 1,
  "result": {
    "stdout": "\n🤖 CORTEX ORCHESTRATOR v2.0\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📋 Goal: \"[DEMO] Marketability walkthrough spawn\"\n\n🔄 Updating Resource Index...\n🔍 Analyzing goal...\n   Intent: coding (10% confidence)\n   Complexity: moderate (~10 steps)\n\n🎯 Selecting agent...\n   Selected: Standard Agent (score: 78)\n     • Intent match: coding\n   Alternatives: Agent-S(21)\n\n📚 Searching resources...\n   Knowledge: 12 matches\n     + AGENTS.md (score: 67)\n     + AGENTS.md (score: 66)\n     + AGENTS.md (score: 65)\n   Skills: 12 matches\n     + AGENTS.md (score: 61)\n     + AGENTS.md (score: 55)\n     + agents.md (score: 53, tech: prisma,database)\n   Tools: 0 matches\n\n✅ FLIGHT PLAN GENERATED!\n   Saved to: D:\\Projects\\reference-manager\\spawned_agents\\spawned_agent_2026-02-04T19-26-42-255Z.md\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n--- PREVIEW ---\n\nBEGIN DIRECTIVE\nROLE: You are the execution agent for this Flight Plan.\nOBJECTIVE: [DEMO] Marketability walkthrough spawn\nMANDATORY STEPS:\n1) Read REQUIRED READING.\n2) Follow EXECUTION steps exactly.\n3) If conflict, prioritize this directive.\nDO NOT:\n- Skip required reading\n- Add unrelated tasks\nIF REQUIRED READING IS UNAVAILABLE:\n- Ask the user to provide access or files\n- Pause execution until required reading is available\nEND DIRECTIVE\n\n# AGENT MISSION ORDER: [DEMO] Marketability walkthrough spawn\n\n## REQUIRED READING\n\nYou must open and use these files before responding. If any file is inaccessible, ask the user to provide it.\n\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\sandbox-agent\\AGENTS.md`\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\sandbox-agent\\frontend\\AGENTS.md`\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\sandbox-agent\\server\\AGENTS.md`\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\skills\\AGENTS.md`\n      _\"This file provides guidance to AI coding agents working on the skills CLI codebase. skills is the CL...\"_\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\google-genai-skills\\skills\\google-adk-python\\references\\agents.md`\n      _\"- Agents Overview(https://raw.githubusercontent.com/google/adk-docs/refs/heads/main/docs/agents/inde...\"_\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\OpenSpec\\AGENTS.md`\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\react-best-practices\\AGENTS.md`\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\postgres-best-practices\\AGENTS.md`\n      _\"Postgres Best Practices > This document is optimized for AI agents and LLMs. Rules are prioritized b...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\references\\agents.md`\n      _\"Agent Type Definitions Complete specifications for all 37 specialized agent types in the Loki Mode m...\"_\n      **Tech:** prisma, database, orm, mongodb, testing, devops, containers\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\background-agents\\packages\\web\\tsconfig.json`\n      _\"\"lib\": \"dom\", \"dom.iterable\", \"ES2022\", \"skipLibCheck\": true, \"esModuleInterop\": true,...\"_\n      **Tech:** typescript\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\background-agents\\packages\\web\\package-lock.json`\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\hydra\\hydra-ext\\demos\\genpg\\README.md`\n      _\"GenPG demo - property graph generation from CSV tables This demo demonstrates end-to-end transformat...\"_\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\hydra\\hydra-haskell\\src\\gen-main\\json\\hydra\\util.json`\n      _\"\"description\": \"General-purpose utility types used across Hydra.\", \"name\": \"hydra.util.CaseConventio...\"_\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\hydra\\hydra-haskell\\src\\gen-main\\json\\hydra\\extract\\json.json`\n      _\"\"description\": \"Utilities for extracting values from JSON objects\", \"name\": \"hydra.extract.json.expe...\"_\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\phileas\\src\\main\\resources\\en\\finance.yml`\n      **Tech:** yaml, devops\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\demo\\README.md`\n      _\"Video demonstration of Loki Mode - Multi-agent autonomous startup system. The record-full-demo.sh sc...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\ai-product\\SKILL.md`\n      _\"description: \"Every product will be AI-powered. The question is whether you'll build it right or shi...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\demo\\voice-over-script.md`\n      _\"Loki Mode Voice-Over Script Complete narration for Loki Mode demo video. Introduction (0:00 - 0:30)...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\azure-functions\\SKILL.md`\n      _\"name: azure-functions description: \"Expert patterns for Azure Functions development including isolat...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\CHANGELOG.md`\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\theme-factory\\themes\\sunset-boulevard.md`\n      _\"A warm and vibrant theme inspired by golden hour sunsets, perfect for energetic and creative present...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\theme-factory\\themes\\botanical-garden.md`\n      _\"A fresh and organic theme featuring vibrant garden-inspired colors for lively presentations. - Fern ...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\form-cro\\SKILL.md`\n      _\"Optimize any form that is NOT signup or account registration — including lead capture, contact, demo...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\database-cloud-optimization-cost-optimize\\resources\\implementation-playbook.md`\n> AGENTS.md instructions are highest priority and should be read first.\n\n> If skills are listed, explore project context first, then consult skills as reference.\n\n\n## 1. IDENTITY ASSIGNMENT\n\n**Selected Agent:** Standard Agent\n**Agent ID:** std-agent\n**Selection Score:** 78/100 (93% confidence)\n\n**Directive:** Read and adopt the persona defined in:\n`D:\\Projects\\reference-repos\\agents\\std-agent\\template.md`\n\n### Selection Rationale\n- Intent match: coding\n\n### Alternative Agents\n- **Agent-S** (score: 21) - Generalist OS Agent for GUI, Browser, and Desktop interaction.\n\n## 2. GOAL ANALYSIS\n\n| Dimension | Value |\n|-----------|-------|\n| **Primary Intent** | coding |\n| **Confidence** | 10% |\n| **Complexity** | moderate |\n| **Estimated Steps** | ~10 |\n| **Action Type** | unknown |\n| **Destructive** | No |\n| **Requires Review** | ✋ Yes |\n\n\n### Required Capabilities\n- fileSystem\n\n\n## 2.5 DECISION MATRIX\n\n- Instruction priority: AGENTS.md first\n- Retrieval gate: enabled (signals present)\n- Query expansion: 0 variants, 5 keywords\n- RAG-Fusion: not used\n- HyDE fallback: not used\n- Hybrid retrieval: enabled\n- Semantic index: not used\n- Routing: HIGH_RECALL (Low intent confidence)\n- RRF fusion: enabled\n- Late interaction rerank: used\n- LLM agent mode: advisory\n- LLM agent router: not used (fetch failed)\n- LLM resource mode: lowConfidence\n- Resource rerank: not used\n- Uncertainty: 98%\n- Low confidence: no\n- Ambiguous top score: no\n\n## 2.6 DECISION TRACE (SUMMARY)\n- goal_analysis: intent=coding, confidence=0.1, keywords=5, expandedKeywords=5, routing=HIGH_RECALL, uncertainty=0.98\n- retrieval_gate: enabled=true, reason=signals present, forced=false\n- agent_llm_router: mode=advisory, used=false, forced=true, accepted=false, reason=fetch failed\n- agent_selection: selected=std-agent, lowConfidence=false, ambiguous=false, rerankUsed=false, rerankAccepted=false, rerankMode=advisory\n- resource_selection: knowledge=12, skills=12, tools=0, rrfUsed=true, ragFusionUsed=false, hydeUsed=false, hybridUsed=true, lateInteractionUsed=true, retrievalEnabled=true, routingMode=HIGH_RECALL\n\n## 3. INTELLIGENCE BRIEFING\n\nThe Orchestrator has identified the following resources using **semantic matching** and **tech stack filtering**.\n**ACTION:** Use your file reading tools to ingest these documents.\n\n### KNOWLEDGE (Context)\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\sandbox-agent\\AGENTS.md`\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\sandbox-agent\\frontend\\AGENTS.md`\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\sandbox-agent\\server\\AGENTS.md`\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\skills\\AGENTS.md`\n      _\"This file provides guidance to AI coding agents working on the skills CLI codebase. skills is the CL...\"_\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\google-genai-skills\\skills\\google-adk-python\\references\\agents.md`\n      _\"- Agents Overview(https://raw.githubusercontent.com/google/adk-docs/refs/heads/main/docs/agents/inde...\"_\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\OpenSpec\\AGENTS.md`\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\background-agents\\packages\\web\\tsconfig.json`\n      _\"\"lib\": \"dom\", \"dom.iterable\", \"ES2022\", \"skipLibCheck\": true, \"esModuleInterop\": true,...\"_\n      **Tech:** typescript\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\background-agents\\packages\\web\\package-lock.json`\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\hydra\\hydra-ext\\demos\\genpg\\README.md`\n      _\"GenPG demo - property graph generation from CSV tables This demo demonstrates end-to-end transformat...\"_\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\hydra\\hydra-haskell\\src\\gen-main\\json\\hydra\\util.json`\n      _\"\"description\": \"General-purpose utility types used across Hydra.\", \"name\": \"hydra.util.CaseConventio...\"_\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\hydra\\hydra-haskell\\src\\gen-main\\json\\hydra\\extract\\json.json`\n      _\"\"description\": \"Utilities for extracting values from JSON objects\", \"name\": \"hydra.extract.json.expe...\"_\n- [ ] `D:\\Projects\\reference-repos\\knowledge\\phileas\\src\\main\\resources\\en\\finance.yml`\n      **Tech:** yaml, devops\n\n### SKILLS (Procedures)\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\react-best-practices\\AGENTS.md`\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\postgres-best-practices\\AGENTS.md`\n      _\"Postgres Best Practices > This document is optimized for AI agents and LLMs. Rules are prioritized b...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\references\\agents.md`\n      _\"Agent Type Definitions Complete specifications for all 37 specialized agent types in the Loki Mode m...\"_\n      **Tech:** prisma, database, orm, mongodb, testing, devops, containers\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\demo\\README.md`\n      _\"Video demonstration of Loki Mode - Multi-agent autonomous startup system. The record-full-demo.sh sc...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\ai-product\\SKILL.md`\n      _\"description: \"Every product will be AI-powered. The question is whether you'll build it right or shi...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\demo\\voice-over-script.md`\n      _\"Loki Mode Voice-Over Script Complete narration for Loki Mode demo video. Introduction (0:00 - 0:30)...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\azure-functions\\SKILL.md`\n      _\"name: azure-functions description: \"Expert patterns for Azure Functions development including isolat...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\loki-mode\\CHANGELOG.md`\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\theme-factory\\themes\\sunset-boulevard.md`\n      _\"A warm and vibrant theme inspired by golden hour sunsets, perfect for energetic and creative present...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\theme-factory\\themes\\botanical-garden.md`\n      _\"A fresh and organic theme featuring vibrant garden-inspired colors for lively presentations. - Fern ...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\form-cro\\SKILL.md`\n      _\"Optimize any form that is NOT signup or account registration — including lead capture, contact, demo...\"_\n- [ ] `D:\\Projects\\reference-repos\\skills\\antigravity-awesome-skills\\skills\\database-cloud-optimization-cost-optimize\\resources\\implementation-playbook.md`\n\n### TOOLS (Capabilities)\n_No matching tool resources found._\n\n## 4. EXECUTION\n\nOnce you have read the above files, proceed to execute the objective:\n\n> [DEMO] Marketability walkthrough spawn\n\n### Execution Guidelines\n1. Follow the intent: **coding**\n2. Complexity level: **moderate** - plan accordingly\n3. ✋ This task requires human review before finalizing\n\n\n---\n_Generated by CORTEX Orchestrator v2.0_\n_Timestamp: 2026-02-04T19:26:42.255Z_\n_Agent: std-agent_\n_Intent: coding (10% confidence)_\n_Complexity: moderate_\n_Format: universal_\n_Resources: 24 files_\n\n",
    "stderr": ""
  },
  "error": null,
  "runId": "run-1770233202257-dbndt3",
  "outputPath": "D:\\Projects\\reference-manager\\spawned_agents\\spawned_agent_2026-02-04T19-26-42-255Z.md",
  "durationMs": 35594,
  "startedAt": "2026-02-04T19:26:07.085Z"
}
```

## Evaluation Result

```json
{
  "success": true,
  "evaluation": {
    "id": "eval-1770233203923-iruso8",
    "name": "Marketability Demo Retrieval Evaluation",
    "type": "retrieval",
    "datasetId": "dataset-1770233203842-q552c7",
    "datasetName": "Marketability Demo 2026-02-04T19:26:43.808Z",
    "datasetVersion": 2,
    "datasetUpdatedAt": "2026-02-04T19:26:43.878Z",
    "runId": null,
    "runGoal": null,
    "createdAt": "2026-02-04T19:26:43.923Z",
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
        "id": "item-1770233203878-zehowy",
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
