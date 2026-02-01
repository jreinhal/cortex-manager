# CORTEX Manual UI QA

This checklist complements the automated Playwright suite and covers visual, accessibility, and telemetry validation that require human review.

## Preconditions
- Backend running: `node server/index.js`
- Frontend running: `cd client && npm run dev`
- Repos root configured and valid (Settings or Setup Wizard).

## 1) Navigation & Layout
- Sidebar buttons navigate to: Agent Factory, Repositories, System Logs, Settings.
- Active nav state highlights the current page.
- Page header title + subtitle match the view.

## 2) Agent Factory
- Enter goal text and verify:
  - Save Prompt enables.
  - Generate Flight Plan enables.
- Format dropdown changes between Universal / ChatGPT / Claude / Gemini.
- Save Prompt modal:
  - Cancel closes without saving.
  - Save stores the prompt and it appears in Quick Access.
- Generate Flight Plan:
  - Status timeline appears while loading.
  - Flight Plan panel shows output.
  - Copy to Clipboard toggles to “Copied!” then resets.
- Decision Matrix:
  - Flight Plan includes a **Decision Matrix** section.
  - Matrix shows **Query expansion**, **Routing**, **RRF fusion**, and **Uncertainty** lines.
  - If any AGENTS.md is present, it appears first in Required Reading.
  - Skill usage note appears (explore context first, then consult skills).
  - For an ambiguous or low-confidence goal, “Requires Review” is flagged in the plan.
- Saved prompts cleanup:
  - Delete any prompts created only for testing once verification is complete.
- Agent + repo selection quality:
  - Generated Flight Plan selects the **Standard Agent** for general tasks.
  - Required reading includes only **CORTEX-relevant repos/files** (client/server/config), not unrelated knowledge bases.
  - Repo paths in the plan resolve to the configured repos root.
- Recent Sessions:
  - After a spawn, a new session appears.
  - Clicking a session fills the goal input.

## 3) UI Controls Checklist (All Buttons/Toggles)
### Setup Wizard
- **Browse** opens directory browser; selecting a folder fills the repos root input.
- **Create directory structure** toggle updates checkbox state and tooltip text.
- **Complete Setup** disabled until path is non-empty; warnings may appear for invalid paths but do not block.

### Directory Browser
- **Parent** navigates up one level (if available).
- **Select This Folder** enabled only when a path is selected.
- **Cancel** closes the browser without selection.

### Agent Factory
- **Save Prompt** opens modal; **Cancel** closes; **Save** persists prompt.
- **Generate Flight Plan** runs orchestration and renders output.
- **Copy to Clipboard** updates to “Copied!” then resets.
- **Saved Prompt** click fills goal; **Delete** removes the prompt.
- **Recent Session** click fills goal input.

### Repositories
- **Clone** validates URL and logs result.
- **Scan** runs discovery and logs results.
- **Repo notice** appears on success/error.

### Settings
- **Save Settings** persists valid paths and shows saved state.
- **Test Connection** pings the configured LLM endpoint(s) and reports reachability.

## 4) Repositories
- Stats cards show:
  - Correct repo counts per category.
  - Size label (not “—”) updates when folder size changes.
  - Size values match filesystem folder properties (use **Size**, not “Size on disk”), allowing for rounding to the displayed unit.
- Add Repository:
  - Valid URL → success log “Cloned X to <category>”.
  - Duplicate URL → info log “Repo already exists…”.
  - Invalid URL → error log “Invalid repository URL…”.
  - Nonexistent URL → error log “Repository not found or inaccessible”.
- Scan:
  - “Starting System Scan…” + completion log appear.
  - Table updates if new repos exist.

## 5) System Logs
- Latest log entries appear at the top.
- Logs show clone completion with classification folder.
- Logs persist when switching views.

## 6) Settings
- Empty repos root shows validation error.
- Valid path saves successfully and shows “Saved!” state.

## 7) Accessibility & Usability
- Keyboard-only: all controls are reachable; focus ring is visible.
- Contrast: headings, labels, and disabled states are legible.
- Touch targets: buttons feel ≥ 44px (iOS) / 48dp (Android).
- Reduced motion: check animations don’t overwhelm.

## 8) Telemetry / Analytics
**Current implementation:** internal analytics at `/api/analytics`.
- After a successful spawn, `totalSpawns` increments.
- `recentSpawns` contains the latest goal.
- No user content beyond goal preview is stored.

> If PostHog telemetry is later added, validate privacy rules:
> - Only command + version are sent
> - No args/paths, `$ip: null`
> - Opt-out env vars disable events

## 9) Visual Regression
- Quick Access sections visually separated and labeled clearly.
- Cards & tables maintain spacing on mobile and wide layouts.
- Logs view supports long lines without overlap.
