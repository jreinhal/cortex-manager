# CORTEX Zero-Gap E2E Test Plan (Living Document)

Purpose
- Perform a rigorous, end-to-end QA + UX audit of CORTEX.
- Capture reproducible steps, clear pass/fail criteria, and actionable UX findings.
- Keep this document as the canonical test plan and refine it over time.

Scope
- React 19 / Tailwind CSS 4 frontend
- Node.js / Express backend
- Core workflows: Agent Factory, Knowledge Base, Run Explorer, Evaluations, Settings

Required Reading (AGENTS.md first if present)
- `AGENTS.md` (this repo, if present)
- `D:\Projects\reference-repos\knowledge\skills\AGENTS.md`
- `D:\Projects\reference-repos\knowledge\google-genai-skills\skills\google-adk-python\references\agents.md`
- `D:\Projects\reference-repos\knowledge\OpenSpec\AGENTS.md`
- `D:\Projects\reference-repos\skills\antigravity-awesome-skills\skills\postgres-best-practices\AGENTS.md`
- `D:\Projects\reference-repos\skills\antigravity-awesome-skills\skills\react-best-practices\AGENTS.md`
- `D:\Projects\reference-repos\knowledge\wg-best-practices-os-developers\docs\Secure-Coding-Guide-for-Python\08_coding_standards\pyscg-0035\README.md`
- `D:\Projects\reference-repos\knowledge\OpenSpec\openspec\changes\archive\2025-08-11-add-complexity-guidelines\specs\openspec-docs\README.md`
- `D:\Projects\reference-repos\knowledge\wg-best-practices-os-developers\docs\Secure-Coding-Guide-for-Python\08_coding_standards\pyscg-0034\README.md`
- `D:\Projects\reference-repos\knowledge\google-genai-skills\skills\deep-research\SKILL.md`
- `D:\Projects\reference-repos\knowledge\wg-best-practices-os-developers\docs\Secure-Coding-Guide-for-Python\08_coding_standards\pyscg-0033\README.md`
- `D:\Projects\reference-repos\knowledge\google-genai-skills\skills\nano-banana-use\SKILL.md`
- `D:\Projects\reference-repos\knowledge\wg-best-practices-os-developers\docs\Existing Guidelines for Developing and Distributing Secure Software.md`
- `D:\Projects\reference-repos\knowledge\AeyeGuard_cmd\react\README.md`
- `D:\Projects\reference-repos\knowledge\wg-best-practices-os-developers\docs\Secure-Coding-Guide-for-Python\08_coding_standards\pyscg-0037\README.md`
- `D:\Projects\reference-repos\skills\antigravity-awesome-skills\skills\javascript-typescript-typescript-scaffold\SKILL.md`
- `D:\Projects\reference-repos\skills\antigravity-awesome-skills\skills\frontend-dev-guidelines\SKILL.md`
- `D:\Projects\reference-repos\skills\antigravity-awesome-skills\skills\ui-ux-designer\SKILL.md`
- `D:\Projects\reference-repos\skills\antigravity-awesome-skills\skills\mobile-design\SKILL.md`
- `D:\Projects\reference-repos\skills\antigravity-awesome-skills\skills\mobile-design\platform-android.md`
- `D:\Projects\reference-repos\skills\antigravity-awesome-skills\skills\mobile-design\platform-ios.md`
- `D:\Projects\reference-repos\skills\antigravity-awesome-skills\skills\react-best-practices\SKILL.md`
- `D:\Projects\reference-repos\skills\antigravity-awesome-skills\skills\ios-developer\SKILL.md`
- `D:\Projects\reference-repos\skills\antigravity-awesome-skills\skills\tailwind-design-system\SKILL.md`
- `D:\Projects\reference-repos\skills\antigravity-awesome-skills\skills\tailwind-design-system\resources\implementation-playbook.md`
- `D:\Projects\reference-repos\tools\lobehub\src\features\CommandMenu\README.md`
- `D:\Projects\reference-repos\tools\lobehub\packages\builtin-agents\src\agents\page-agent\README.md`
- `D:\Projects\reference-repos\tools\knowledge-work-plugins\product-management\skills\metrics-tracking\SKILL.md`
- `D:\Projects\reference-repos\tools\lobehub\src\tools\artifacts\systemRole.ts`
- `D:\Projects\reference-repos\tools\knowledge-work-plugins\customer-support\skills\knowledge-management\SKILL.md`
- `D:\Projects\reference-repos\tools\knowledge-work-plugins\marketing\skills\brand-voice\SKILL.md`
- `D:\Projects\reference-repos\tools\knowledge-work-plugins\customer-support\skills\ticket-triage\SKILL.md`
- `D:\Projects\reference-repos\tools\knowledge-work-plugins\product-management\skills\user-research-synthesis\SKILL.md`
- `D:\Projects\reference-repos\tools\knowledge-work-plugins\customer-support\skills\customer-research\SKILL.md`
- `D:\Projects\reference-repos\tools\knowledge-work-plugins\product-management\skills\competitive-analysis\SKILL.md`
- `D:\Projects\reference-repos\tools\knowledge-work-plugins\legal\skills\contract-review\SKILL.md`
- `D:\Projects\reference-repos\tools\knowledge-work-plugins\product-management\skills\roadmap-management\SKILL.md`

Environment / Preconditions
- Backend running (node server/index.js)
- Frontend running (client dev server)
- Local repos root configured (Settings or First-Run Wizard)
- Test data: at least one valid reference repo available for scanning

Test Data
- Valid repo URL: ___________________________
- Invalid repo URL: `https://invalid.invalid/repo`
- Duplicate repo URL: use a repo already cloned above
- Agent Factory complex goal:
  - `Audit auth module for security`
- Ambiguous goal:
  - `Handle it`

Critical Path & Functional Logic
1) Setup & Config
   - Action: Open app → Settings (or First-Run Wizard).
   - Input: Repos root path: _________________________
   - Expected:
     - config.json updated
     - Connection succeeds (Status shows Online)

2) Agent Factory Flow
   - Action: Agent Factory → enter complex goal → Spawn.
   - Input: `Audit auth module for security`
   - Expected:
     - Status timeline updates in real time
     - Flight Plan generated
     - Copy to Clipboard works

3) Decision Matrix Validation
   - Action: Open Run Explorer → select latest run → Decision Matrix.
   - Expected Decision Matrix includes:
     - Retrieval gate
     - Query expansion
     - RAG-Fusion
     - Hybrid retrieval
     - RRF fusion
     - LLM agent mode + LLM agent router (when LLM enabled)

4) Repository Management
   - Action: Knowledge Base → Smart Clone → System Scan.
   - Expected:
     - Repos categorized correctly (Agents, Skills, Knowledge, Tools)
     - Folder sizes displayed and accurate

5) Evaluations & Runs
   - Action: Evaluations → create dataset → add items → create evaluation against latest run.
   - Expected:
     - Scorecard shows per-item grading
     - LLM rubric grading works (if enabled)
     - Evaluation Trends panel renders response + retrieval sparkline
   - Retrieval benchmark:
     - Create retrieval dataset with expected paths
     - Evaluation returns precision/recall/MRR

6) Audit Trail
   - Action: Open Audit Trail → filter by event → search user/IP
   - Expected: entries render with timestamps, user, workspace, metadata
   - Export CSV/JSON downloads without errors

Manual UI & Visual Integrity Audit
1) Boundary & Focus Checks
   - Knowledge Base: “Add Repository” label does not overlap border or focus ring
   - Input focus rings remain inside fields (no text overlap)

2) Navigation State
   - Sidebar active state matches current view
   - Page header title/subtitle update correctly

3) Real-Time Feedback
   - System Logs persist across view changes
   - Telemetry increments after successful spawns

Manual Edge Pass (Playwright)
- `npm run e2e:edge` (headed Edge run)
- `npm run e2e:edge:ui` (Playwright UI runner using Edge)

UX & Edge Case Hunting
1) Ambiguity Handling
   - Input ambiguous goal → verify “Requires Review” or low-confidence routing flags

2) Error States
   - Invalid repo URL → notice + log entry
   - Duplicate repo → notice + log entry

Reference-Driven Extensions (from required reading)
1) React / Frontend Performance (react-best-practices + frontend-dev-guidelines)
   - Check for network waterfalls in spawn/run/evaluation flows (parallelize where possible).
   - Verify heavy views/components are lazy-loaded (Runs, Evaluations, Knowledge Base).
   - Watch for re-render storms (typing in prompt, switching views) and UI jank.
   - Confirm no hydration mismatch/flicker and that long lists use content-visibility or similar.

2) Design System & Accessibility (ui-ux-designer + tailwind-design-system)
   - Run a WCAG 2.1/2.2 AA pass: color contrast, focus order, keyboard navigation.
   - Verify focus rings are visible and not clipped; no overlap with labels or borders.
   - Check consistent spacing, typography hierarchy, and semantic color token usage.
   - Validate dark mode and reduced-motion behavior (if available).

3) Security & Secure Coding Checks (OpenSSF + pyscg-0033/0034/0035/0037 + AeyeGuard)
   - Run static analysis on frontend code for XSS/auth/token storage issues (AeyeGuard).
   - Ensure input/response validation does not rely on `assert` for runtime checks.
   - Confirm null/undefined guards are in place for user inputs and API responses.
   - Verify temporary files (if any) are cleaned up or managed by OS-safe patterns.
   - Cross-check web app security basics against OWASP guidance (input validation, auth, logging).

4) Telemetry & Metrics (metrics-tracking)
   - Define the North Star + L1 metrics for the test run (e.g., totalSpawns, passRate).
   - Verify metrics increment after key workflows; capture baseline vs post-run values.
   - Note any anomalies, missing events, or inconsistent deltas.

5) UX Research & Competitive Context (user-research-synthesis + competitive-analysis)
   - Synthesize UX findings into themes (usability, clarity, trust, speed).
   - Capture 2–3 representative user quotes from observations (or proxies).
   - Maintain a lightweight competitor comparison matrix if benchmarking alternatives.

6) Support Operations & Documentation (ticket-triage + knowledge-management + brand-voice)
   - Classify bugs by severity (P1–P4) and route accordingly.
   - Draft/update KB entries for recurring issues and user-facing fixes.
   - Check UI copy for tone consistency, clarity, and customer-facing terminology.

7) Mobile/Responsive Validation (mobile-design + platform guides)
   - Validate responsive layout on small breakpoints; ensure touch targets ≥ 44–48px.
   - Check reduced motion and accessibility settings on mobile-sized viewports.
   - If native mobile apps exist, apply iOS/Android platform checklists.

8) Optional Feature-Specific Tests (CommandMenu + Page Agent)
   - If a command palette exists: verify Cmd/Ctrl+K, search, context commands, and escape/back behavior.
   - If a page-editor agent exists: verify context injection and document tool actions.

9) Process Alignment (OpenSpec)
   - If test findings require non-trivial changes (>100 LOC or architecture changes), create an OpenSpec change proposal before implementation.

Execution Log (fill during test)
- Timestamp:
- Page:
- Action (clicks, inputs):
- Input string:
- Result:

Functional Pass/Fail Summary
- Spawn: ☐ Pass ☐ Fail
- Clone: ☐ Pass ☐ Fail
- Scan: ☐ Pass ☐ Fail
- Evaluate: ☐ Pass ☐ Fail

Visual / UX Bug Log
- ID:
- Location:
- Description:
- Severity:
- Screenshot:

Telemetry Check
- totalSpawns incremented? ☐ Yes ☐ No
- recent sessions updated? ☐ Yes ☐ No
- Notes:

Follow-ups / Refinements
- 
