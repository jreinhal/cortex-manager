# Reference Repository Classification Standards

This document defines the definitive taxonomy for `<REPOS_ROOT>`. All cloned repositories must be sorted into one of the following directories.

Placeholder paths:
- `<REPOS_ROOT>`: root folder that holds reference repositories.
- `<BUNDLES_JSON>`: path to bundles.json for prompt bundles.

## Mental Framework
To differentiate between categories, use this analogy:
- **Agents (The Body):** The engine that executes work. It has hands and eyes.
- **Skills (The Training):** The specific procedures the agent knows *how* to do (e.g., "How to audit Java code").
- **Knowledge (The Library):** The reference material the agent looks at to get *information* (e.g., "The official Java Security Spec").

## Classification Scenarios
Use these examples to decide where a new repository belongs:

### Scenario 1: "I found a collection of best-practice system prompts."
*   **Decision:** This is **Training**.
*   **Category:** `/skills`
*   **Why:** It teaches the agent *how* to behave or solve problems.

### Scenario 2: "I found a repo containing 5,000 Java vulnerability signatures."
*   **Decision:** This is **Reference Material**.
*   **Category:** `/knowledge`
*   **Why:** The agent reads this to know *what* to look for, but it doesn't tell the agent *how* to be a security auditor.

### Scenario 3: "I found a new autonomous coding bot like Devin."
*   **Decision:** This is a **Worker**.
*   **Category:** `/agents`
*   **Why:** It is an agent itself, not a part of one.

---

## Typical Structure
What you should expect to see inside these repositories:

### 1. Agents (`/agents`)
**Definition:** Functional software engines, autonomous runners, or complete agent implementations.
**Criteria:** Executable code that *runs* agents.
**Examples:** `Agent-S`, `OpenDevin`, `MetaGPT`.

## 2. Skills (`/skills`)
**Definition:** Modular instruction sets, prompt libraries, or capability bundles designed to be "learned" or used by agents.
**Criteria:** `.md` files, prompt templates, or skill definitions.
**Examples:** `antigravity-awesome-skills`, `claude-skills`, `java-security-audit`.

## 3. Knowledge (`/knowledge`)
**Definition:** Theoretical research, whitepapers, raw data datasets, or academic references.
**Criteria:** Information *about* agents, not the agents themselves.
**Examples:** `Awesome-Agentic-Reasoning`, `Research-Papers`.

## 4. Tools (`/tools`)
**Definition:** Standalone utilities, CLI apps, or helpers that agents *use* but aren't agents themselves.
**Criteria:** Installable packages, CLI tools.
**Examples:** `files-to-prompt`, `token-counter`, `trufflehog`.

## 5. Benchmarks (`/benchmarks`)
**Definition:** Datasets, test harnesses, and exam material for grading agents.
**Criteria:** `evals` folder, leaderboards, test suites.
**Examples:** `SWE-bench`, `HumanEval`, `GAIA`.

---

## Automation Note
The `manage-reference-repos.ps1` script will automatically classify repositories based on their content heuristic.
- **Action:** `.\manage-reference-repos.ps1 -Add "https://github.com/..."`
- The script will scan the repo and place it in the correct folder automatically.

---

## Standard Agent Teams (Cheatsheet)
Use these "Compound Prompts" to spawn agents that are both SKILLED (Code) and SMART (Researched).

### 1. The Core Dev Team (Software & Code)
**Use for:** Building features, debugging, and high-quality software engineering.
**Prompt:**
> "Act as the **Core Dev Team**.
> 1. Load the `core-dev` bundle from `<BUNDLES_JSON>`.
> 2. Read `<REPOS_ROOT>\knowledge\Awesome-Agentic-Reasoning\README.md` to ground your logic in the latest research.
> 3. Apply 'Self-Correction' and 'Chain-of-Thought' principles from that research to this objective: [Insert Task Here]"

### 2. The Security Team (Red Team / Audit)
**Use for:** Finding vulnerabilities, penetration testing, security reviews.
**Prompt:**
> "Act as the **Security Team**.
> 1. Load the `security-core` bundle from `<BUNDLES_JSON>`.
> 2. Read `<REPOS_ROOT>\knowledge\Awesome-Agentic-Reasoning\README.md` and focus on the 'Security' and 'Robustness' papers.
> 3. Audit the following files/architecture for vulnerabilities..."

### 3. The Ops Team (DevOps & Infrastructure)
**Use for:** Docker, CI/CD, Kubernetes, Cloud Deployment.
**Prompt:**
> "Act as the **Ops Team**.
> 1. Load the `ops-core` bundle from `<BUNDLES_JSON>`.
> 2. Read `<REPOS_ROOT>\knowledge\Awesome-Agentic-Reasoning\README.md` and look for 'Self-Evolving' infrastructure patterns.
> 3. Create a deployment plan for..."

### 4. The Data Team (Database & Analytics)
**Use for:** SQL, Schemas, Vectors, Data Pipelines.
**Prompt:**
> "Act as the **Data Team**.
> 1. Load the `data-core` bundle from `<BUNDLES_JSON>`.
> 2. Read `<REPOS_ROOT>\knowledge\Awesome-Agentic-Reasoning\README.md` to reference 'Reasoning with Large Language Models'.
> 3. Optimize the database structure for..."

### 5. The Kubernetes Team (K8s Specialists)
**Use for:** Advanced cluster management, Helm charts, Service Mesh.
**Prompt:**
> "Act as the **K8s Team**.
> 1. Load the `k8s-core` bundle from `<BUNDLES_JSON>`.
> 2. Read `<REPOS_ROOT>\knowledge\Awesome-Agentic-Reasoning\README.md` for context on 'Orchestration'.
> 3. Generate the manifests for..."
