# CORTEX - Development Guidelines

## Project Overview

**CORTEX** (Centralized Orchestration & Repository Training for Expert eXecution) is a self-hosted AI orchestration platform that generates "Flight Plans" for LLM execution. It's a **local developer tool** running on localhost.

## Critical Context

### Security Model
This is a **local-only** tool:
- Runs on `localhost:3001` (backend) and `localhost:5173` (frontend)
- No authentication required - it's a personal dev tool
- No data leaves the machine
- Security concerns about auth/injection don't apply here

### Architecture
```
cortex/
├── client/                  # React + Vite Frontend
│   └── src/App.jsx         # Main UI (single-file for now)
├── server/                  # Node.js + Express Backend
│   ├── index.js            # API Server
│   ├── orchestrator.js     # Agent Spawning Logic
│   ├── config.js           # Configuration Management
│   └── repo-manager.js     # Cross-platform Git Operations
└── config.json             # User Configuration
```

## Build & Run Commands

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Start both servers (dev mode)
npm start

# Backend only
cd server && node index.js

# Frontend only (Vite)
cd client && npm run dev
```

## Pre-Commit Verification

Before ANY commit:
1. Run `npm start` and verify both servers start
2. Test the Agent Factory spawns correctly
3. Verify no hardcoded paths (use config.js)
4. Check console for errors

## Code Conventions

### Cross-Platform Paths
ALWAYS use Node.js path utilities:
```javascript
// CORRECT
const configPath = path.join(__dirname, '..', 'config.json');
const homeDir = os.homedir();

// WRONG
const configPath = 'D:\\Projects\\config.json';
const homeDir = '/home/user';
```

### Configuration Access
ALWAYS use config.js for paths:
```javascript
const { getConfig } = require('./config');
const config = getConfig();
const reposRoot = config.reposRoot;
```

### API Endpoints
All endpoints return JSON with consistent structure:
```javascript
// Success
res.json({ success: true, data: result });

// Error
res.status(500).json({ success: false, error: message });
```

### Git Operations
Use repo-manager.js, NOT shell commands:
```javascript
const repoManager = require('./repo-manager');
const repos = repoManager.scanRepositories();
```

## Key Files

| File | Purpose |
|------|---------|
| `server/config.js` | Configuration management, first-run detection |
| `server/repo-manager.js` | Cross-platform git operations |
| `server/orchestrator.js` | Flight plan generation |
| `server/index.js` | Express API server |
| `client/src/App.jsx` | React frontend (monolithic for now) |
| `config.json` | User configuration (gitignored) |
| `config.example.json` | Configuration template |

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/repos` | GET | List repositories |
| `/api/spawn` | POST | Generate flight plan |
| `/api/config` | GET/POST | Configuration management |
| `/api/setup` | POST | First-run setup |
| `/api/sessions` | GET/POST | Session history |
| `/api/analytics` | GET | Usage statistics |
| `/api/categories` | GET | Repository categories |

## Common Pitfalls

1. **Hardcoded Paths**: Always use config.js or os.homedir()
2. **PowerShell Scripts**: Removed - use repo-manager.js for cross-platform
3. **Sync I/O in API Handlers**: Acceptable for this local tool
4. **Missing Error Handling**: Always wrap file operations in try/catch

## Testing

No automated tests yet. Manual testing:
1. First-run wizard appears on fresh install
2. Settings panel updates config correctly
3. Agent Factory generates valid flight plans
4. Session history persists

## Future Improvements (Roadmap)

- [ ] Visual Workflow Builder
- [ ] Multi-Agent Teams
- [ ] Built-in API Integration (OpenAI, Anthropic)
- [ ] Human-in-the-Loop Checkpoints
- [ ] Multi-Repo Knowledge Graphs

## Commit Guidelines

- Prefix commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Include `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>` when Claude assists
- Keep commits atomic and focused
