# Claude Long-Term Memory for CORTEX Project

## CRITICAL DIRECTIVES

### Pre-Commit Verification (MANDATORY)
**ALWAYS verify the app runs before ANY commit.**

Before executing `git commit`:
1. Run `npm start` to verify both servers start
2. Open http://localhost:5173 and verify the UI loads
3. Only proceed with commit if app functions correctly
4. Never commit broken code

This applies to EVERY session, EVERY commit, no exceptions.

### Cross-Platform Compliance (MANDATORY)
**NEVER hardcode paths. ALWAYS use config.js.**

Before ANY file operation:
1. Use `path.join()` for all paths
2. Use `os.homedir()` for user directories
3. Use `config.js` for repository root paths
4. Test path operations mentally for Windows/Mac/Linux

---

## Project Context

- **Stack**: React 19 + Vite (frontend), Node.js + Express (backend)
- **Purpose**: Local AI orchestration platform for generating "Flight Plans"
- **Architecture**: Reference-Based RAG (file paths, not content upload)
- **Target Users**: Privacy-conscious developers using any LLM

## Recent Major Changes

### Cross-Platform Support (Jan 2026)
- Replaced PowerShell scripts with `repo-manager.js`
- Added `config.js` for centralized configuration
- Setup wizard for first-run experience
- Settings panel for runtime configuration

### Priority Matrix Implementation (Jan 2026)
- P0: Agent Status Timeline, Resource Preview Cards
- P1: Session Persistence, Tools Registry, Analytics
- P2: Human-in-the-Loop metadata (partial)

## Known Issues

1. **Monolithic App.jsx**: Frontend is a single large file (~1000 lines)
   - Future: Split into components

2. **No Automated Tests**: Manual testing only
   - Future: Add Playwright E2E tests

3. **Sync I/O in Handlers**: File operations are synchronous
   - Acceptable for local tool, but consider async for scale

## Architecture Decisions

1. **Why Markdown Flight Plans?**
   - Human-readable and auditable
   - Works with ANY LLM (no vendor lock-in)
   - Easy to version control

2. **Why Reference-Based RAG?**
   - Privacy: Code never leaves local machine
   - Flexibility: User chooses execution LLM
   - Control: Reproducible AI workflows

3. **Why Single-File Frontend?**
   - Simplicity for initial development
   - Easy to understand full context
   - Will refactor as complexity grows
