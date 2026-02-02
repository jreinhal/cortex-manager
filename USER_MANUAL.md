# CORTEX User Manual

**Version 1.0.0**  
**Last Updated: January 2026**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Getting Started](#getting-started)
4. [Command Center](#command-center)
5. [Agent Factory](#agent-factory)
6. [Knowledge Base](#knowledge-base)
7. [Run Explorer](#run-explorer)
8. [Evaluations](#evaluations)
9. [Library](#library)
10. [Advanced Workflows](#advanced-workflows)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

---

## Introduction

### What is CORTEX?

CORTEX (Centralized Orchestration & Repository Training for Expert eXecution) is a local-first AI orchestration platform designed for development teams who need powerful AI assistance with flexible deployment options.

### Key Benefits

- **Model Agnostic**: Works with any LLM (GPT-4, Claude, Gemini, Llama)
- **Local-First**: Your code stays local by default; optional remote LLM endpoints are supported
- **Cost Efficient**: "Lazy loading" reduces token usage by 10x
- **Auditable**: Every AI operation is documented and reviewable
- **Team Ready**: Standardize AI workflows across your organization

---

## Installation

### System Requirements

- **Operating System**: Windows 10+, macOS 12+, or Linux
- **Node.js**: Version 18.0 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 500MB for application, additional space for repositories

### Step-by-Step Installation

#### 1. Install Node.js

Download and install from [nodejs.org](https://nodejs.org/). Verify installation:

```bash
node --version
npm --version
```

#### 2. Clone CORTEX

```bash
git clone https://github.com/your-org/cortex.git
cd cortex
```

#### 3. Install Dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

#### 4. Configure Repository Path

Edit `server/index.js` and set your reference repository location:

```javascript
let REPOS_ROOT = "D:\\Projects\\reference-repos"; // Windows
// or
let REPOS_ROOT = "/Users/yourname/Projects/reference-repos"; // Mac/Linux
```

#### 5. Start CORTEX

**Windows**: Double-click `start.bat`

**Mac/Linux**:
```bash
npm start
```

#### 6. Verify Installation

Open your browser to [http://localhost:5173](http://localhost:5173). You should see the CORTEX Command Center.

---

## Getting Started

### Creating Your First Reference Repository

CORTEX organizes knowledge into "Reference Repositories". Here's how to set one up:

#### 1. Create the Root Folder

```bash
mkdir -p ~/Projects/reference-repos
cd ~/Projects/reference-repos
```

#### 2. Clone Your First Repository

Use the CORTEX UI or command line:

```bash
git clone https://github.com/your-org/security-guidelines.git
```

#### 3. Let CORTEX Categorize It

CORTEX automatically analyzes the repository's README and assigns it to a category:
- **Agents**: Pre-configured AI personas
- **Skills**: Procedural knowledge (how to test, deploy, etc.)
- **Knowledge**: Reference materials (guidelines, docs)
- **Tools**: Utility scripts

#### 4. Verify in Knowledge Base

Open the Knowledge Base view. Your new repository should appear in the appropriate category card.

---

## Command Center

### Navigation

The sidebar contains the primary workspace areas:

1. **🏠 Command Center**: Overview of runs, evaluations, and knowledge coverage
2. **🏭 Agent Factory**: Spawn specialized AI agents
3. **🧭 Runs**: Trace explorer with decision matrices and performance signals
4. **🧪 Evaluations**: Dataset management and run scoring
5. **📦 Library**: Saved prompts, agent templates, and tools
6. **📚 Knowledge Base**: Manage reference repositories
7. **📜 Logs**: Real-time operation logs
8. **⚙️ Settings**: Configuration options

### Command Center Cards

Each card shows key operational totals (runs, evaluations, prompts, repositories).

### Activity Panels

Recent runs and recent sessions appear on the right to help you pick up where you left off.

---

## Agent Factory

### What is an Agent?

An "Agent" in CORTEX is a specialized AI configuration designed for a specific task. The Agent Factory generates a "Flight Plan"—a structured prompt that tells your chosen LLM exactly what to do.

### How to Spawn an Agent

#### Step 1: Navigate to Agent Factory

Click **"Agent Factory"** in the sidebar.

#### Step 2: Describe Your Objective

In the chat-style input box, describe what you need:

**Examples**:
- *"Audit my authentication module for security vulnerabilities"*
- *"Refactor the user service to follow clean architecture"*
- *"Generate unit tests for the payment processing logic"*

#### Step 3: Spawn

Click the **circular send button** in the bottom-right of the input area.

#### Step 4: Review the Flight Plan

CORTEX will:
1. Scan your reference repositories
2. Identify relevant knowledge, skills, and tools
3. Generate a Markdown "Flight Plan"

The plan includes:
- **Mission Objective**: Clear statement of the task
- **Required Reading**: File paths to relevant documentation
- **Execution Steps**: Structured instructions

#### Step 5: Execute

Click **"Copy to Clipboard"** and paste the Flight Plan into:

- **Gemini** (if you have file access enabled)
- **Claude Desktop** (with your project folder open)
- **ChatGPT** (via web or API)
- **Local Llama** (using Ollama or similar)

The LLM will read the referenced files and execute the mission.

### Understanding Flight Plans

**Example Flight Plan**:

```markdown
# AGENT MISSION ORDER: Audit authentication module

## 1. IDENTITY ASSIGNMENT
**Selected Personnel:** Standard Agent

## 2. INTELLIGENCE BRIEFING
### KNOWLEDGE
- [ ] D:\Projects\reference-repos\knowledge\security-guidelines\auth-best-practices.md
- [ ] D:\Projects\reference-repos\knowledge\owasp-top-10.md

### SKILLS
- [ ] D:\Projects\reference-repos\skills\security-audit\checklist.md

## 3. EXECUTION
> Audit the authentication module for vulnerabilities including:
> - SQL injection risks
> - Session management flaws
> - Password storage compliance
```

### Agent Types

CORTEX supports multiple agent templates:

1. **Standard Agent**: General-purpose reasoning and coding
2. **Agent-S**: OS-level automation with browser/file system access
3. **Custom Agents**: Add your own templates in `reference-repos/agents/`

---

## Knowledge Base

### Adding Repositories

#### Via UI

1. Navigate to **Knowledge Base**
2. Click **"Add Repository"**
3. Paste GitHub URL
4. Click **"Smart Clone"**

CORTEX will:
- Clone the repository
- Analyze its purpose
- Categorize automatically
- Update the Knowledge Base view

#### Via Command Line

```bash
cd ~/Projects/reference-repos
git clone https://github.com/your/repo.git
```

Then refresh the Knowledge Base view.

### Updating Repositories

CORTEX displays each repository's last update time. To pull the latest changes:

```bash
cd ~/Projects/reference-repos/your-repo
git pull
```

### Removing Repositories

Simply delete the folder from your reference repositories directory:

```bash
rm -rf ~/Projects/reference-repos/old-repo
```

Refresh the Knowledge Base view to update the list.

---

## Run Explorer

The Run Explorer aggregates every spawn with its decision matrix and performance signals.

### Reviewing a Run
1. Open **Runs** from the sidebar.
2. Select a run from the left-hand list.
3. Review the **Decision Matrix**, **Trace**, and **Issues** panels to understand routing choices.
4. Use the comparison dropdown to compare quality, duration, and uncertainty against a baseline.

### Code Context
Each run captures git metadata (branch, commit, dirty status) to make run reviews traceable.

---

## Evaluations

Evaluations let you score runs against curated datasets.

### Create a Dataset
1. Go to **Evaluations**.
2. Name a dataset and add prompt/expected outcome pairs (use `regex:` or switch the type to Regex).
3. Use datasets to standardize regression testing.

### Import/Export Datasets
- Use **Export** to download a dataset JSON file for sharing or versioning.
- Use **Import** to upload a previously exported dataset (JSON).

### Score a Run
1. Select a dataset and a recent run.
2. Click **Create Evaluation** to store the scorecard.
3. Results include per‑item grading and pass/fail thresholds.

### LLM Rubric Grading
- Set the item type to **LLM Rubric** and include a rubric for qualitative grading.
- LLM grading uses your configured local/remote LLM endpoint and respects D: drive enforcement on Windows.

### Rubric Templates
- Use the rubric template dropdown to prefill common grading criteria (clarity, groundedness, actionability).

---

## Library

The Library keeps reusable assets in one place.

### Saved Prompts
- Save prompts from Agent Factory.
- Reuse them directly from the Library.

### Agent Templates & Tools
- Browse available agent templates from your reference repos.
- Review tools and utilities registered in the tools folder.

---

## Advanced Workflows

### Workflow 1: Security Audit Pipeline

**Objective**: Run a comprehensive security audit on a new codebase

1. **Prepare Knowledge Base**
   - Add OWASP guidelines to `knowledge/`
   - Add security checklist to `skills/`

2. **Spawn Audit Agent**
   - Input: *"Perform OWASP Top 10 security audit on my codebase"*
   - CORTEX generates a Flight Plan with all OWASP files

3. **Execute with Claude**
   - Paste into Claude Desktop
   - Claude reads your code + OWASP docs
   - Generates detailed vulnerability report

4. **Fix Issues**
   - Spawn a second agent: *"Fix the SQL injection vulnerabilities identified"*
   - Execute the fix agent

### Workflow 2: Onboarding New Developers

**Objective**: Help junior developers understand your architecture

1. **Build Architecture Knowledge Base**
   - Add architecture diagrams to `knowledge/architecture/`
   - Add coding standards to `knowledge/standards/`

2. **Create "Onboarding Agent"**
   - Template in `agents/onboarding/template.md`
   - References all key documentation

3. **Junior Dev Spawns Agent**
   - Input: *"Explain how the authentication flow works"*
   - Flight Plan includes architecture docs + code

4. **Consistent Training**
   - Every new hire uses the same agent
   - Knowledge stays up-to-date in repos

### Workflow 3: Code Review Automation

**Objective**: Get AI-assisted code reviews before merge

1. **Add Review Guidelines**
   - `skills/code-review/checklist.md`
   - Include performance, security, style checks

2. **Pre-Merge Agent Spawn**
   - Input: *"Review my pull request for merge readiness"*
   - Include PR diff file path in reference repos

3. **Execute Review**
   - LLM uses checklist + your code
   - Generates review report

4. **Fix and Re-Review**
   - Address feedback
   - Spawn again to verify fixes

---

## Troubleshooting

### Issue: "Cannot find module 'express'"

**Cause**: Dependencies not installed

**Solution**:
```bash
cd server
npm install
```

### Issue: Knowledge Base shows empty

**Cause**: `REPOS_ROOT` path is incorrect

**Solution**:
1. Open `server/index.js`
2. Verify the `REPOS_ROOT` path exists:
   ```javascript
   let REPOS_ROOT = "YOUR_ACTUAL_PATH";
   ```
3. Restart CORTEX

### Issue: "Port 3001 already in use"

**Cause**: Another process is using the backend port

**Solution**:

**Windows**:
```powershell
netstat -ano | findstr :3001
taskkill /F /PID <PID>
```

**Mac/Linux**:
```bash
lsof -i :3001
kill -9 <PID>
```

### Issue: Flight Plans reference wrong files

**Cause**: CORTEX's keyword matching is too broad

**Solution**:
- Improve your repository README files with specific keywords
- Manually edit the Flight Plan before execution
- Add an "ignore list" in `server/orchestrator.js`

### Issue: Browser shows "Cannot connect to server"

**Cause**: Backend not running

**Solution**:
```bash
cd server
node index.js
```

Verify the server started on port 3001.

---

## Best Practices

### 1. Organize Repositories by Domain

Group related knowledge:

```
reference-repos/
├── knowledge/
│   ├── backend/
│   ├── frontend/
│   └── devops/
├── skills/
│   ├── testing/
│   └── deployment/
```

### 2. Keep READMEs Descriptive

CORTEX uses README content for categorization. Include:
- **Purpose**: What this repository does
- **Keywords**: "Security", "Testing", "API", etc.
- **Usage examples**

### 3. Version Control Your Knowledge Base

Your `reference-repos` folder *is* a codebase. Use Git:

```bash
cd ~/Projects/reference-repos
git init
git add .
git commit -m "Initial knowledge base"
```

### 4. Use Consistent Naming

Name folders clearly:
- ✅ `security-guidelines/`
- ✅ `react-testing-patterns/`
- ❌ `stuff/`
- ❌ `misc/`

### 5. Curate Regularly

Remove outdated repositories. CORTEX is only as good as your knowledge base.

### 6. Share Flight Plans

Copy successful Flight Plans into your `agents/` folder as templates for reuse.

### 7. Test with Small Requests First

Before spawning complex audit agents, test with simple requests like:
- *"List all files in my project"*
- *"Explain what this function does"*

This helps you understand how your LLM interprets CORTEX plans.

### 8. Use the Testing Checklist

Manual QA steps are tracked in `TESTING.md`. Use it to verify UI polish issues (like label/border overlaps) and core workflows after changes.

---

## Appendix: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Focus Agent Factory input |
| `Ctrl + Shift + L` | Open Logs view |
| `Ctrl + Shift + D` | Return to Command Center |
| `Ctrl + Shift + C` | Copy last Flight Plan |

---

## Appendix: API Reference

CORTEX exposes a REST API on `http://localhost:3001`:

### `GET /api/status`
Returns server health status.

**Response**:
```json
{
  "status": "Online",
  "message": "CORTEX API is running"
}
```

### `GET /api/repos`
Returns all repositories.

**Response**:
```json
{
  "repos": [
    {
      "Name": "security-guidelines",
      "Purpose": "OWASP security best practices",
      "LastUpdate": "2026-01-31"
    }
  ],
  "categories": ["Agents", "Skills", "Knowledge", "Tools"]
}
```

### `GET /api/runs`
Returns recent run history (decision matrix + metrics).

### `GET /api/datasets`
Returns evaluation datasets.

### `GET /api/datasets/:id/export`
Returns a JSON export for a single dataset.

### `POST /api/datasets/import`
Imports a dataset JSON payload.

### `GET /api/evaluations`
Returns evaluation results.

### `GET /api/evaluations/compare?left=<id>&right=<id>`
Returns delta metrics between two evaluations.

### `GET /api/agents`
Returns available agent templates from the reference repos.

### `POST /api/spawn`
Spawns an agent and returns a Flight Plan.

**Request**:
```json
{
  "goal": "Audit authentication module"
}
```

**Response**:
```json
{
  "success": true,
  "output": "# AGENT MISSION ORDER: ..."
}
```

---

## Support & Community

- **GitHub Issues**: [Report bugs](https://github.com/your-org/cortex/issues)
- **Discussions**: [Ask questions](https://github.com/your-org/cortex/discussions)
- **Email**: support@cortex.ai

---

**End of User Manual**
