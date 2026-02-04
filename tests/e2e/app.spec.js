const { test, expect } = require('@playwright/test');

const DEFAULT_REPOS_ROOT = 'D:\\Projects\\reference-repos';
const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3002/api';
const REPOS_ROOT = process.env.E2E_REPOS_ROOT || DEFAULT_REPOS_ROOT;
const TEST_PROMPT_PREFIX = '[E2E]';
const TEST_PROMPT_TITLE = `${TEST_PROMPT_PREFIX} Test Creation`;
const TEST_PROMPT_QUERY = `${TEST_PROMPT_PREFIX} Test Creation prompt`;
const SPAWN_GOAL = `${TEST_PROMPT_PREFIX} Review AGENTS.md for the skills CLI and create a thorough e2e test plan for the CORTEX UI. Validate telemetry results.`;

async function completeSetupIfNeeded(page) {
  const wizardHeading = page.getByRole('heading', { name: 'Welcome to CORTEX' });
  const visible = await wizardHeading.isVisible().catch(() => false);
  if (!visible) return;

  const reposInput = page.locator('#repos-root');
  await reposInput.fill(REPOS_ROOT);
  await page.waitForTimeout(600);

  const completeButton = page.getByRole('button', { name: /Complete Setup/i });
  const disabled = await completeButton.isDisabled();
  if (disabled) {
    throw new Error(
      `Setup wizard active but repos root is invalid. Set E2E_REPOS_ROOT to a valid path (current: ${REPOS_ROOT}).`
    );
  }

  await completeButton.click();
  await expect(wizardHeading).toBeHidden({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
}

async function cleanupTestPrompts(request) {
  try {
    const res = await request.get(`${API_BASE}/prompts`);
    if (!res.ok()) return;
    const prompts = await res.json();
    const targets = prompts.filter((prompt) => {
      const title = prompt?.title || '';
      const query = prompt?.query || '';
      return title.startsWith(TEST_PROMPT_PREFIX) || query.includes(TEST_PROMPT_PREFIX);
    });

    for (const prompt of targets) {
      await request.delete(`${API_BASE}/prompts/${prompt.id}`);
    }
  } catch {
    // Best-effort cleanup; do not fail tests on cleanup errors.
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await completeSetupIfNeeded(page);
});

test.afterEach(async ({ request }) => {
  await cleanupTestPrompts(request);
});

test('navigate between primary views', async ({ page }) => {
  await page.getByTestId('nav-home').click();
  await expect(page.getByRole('heading', { name: 'Command Center', level: 1 })).toBeVisible();

  await page.getByTestId('nav-knowledge').click();
  await expect(page.getByRole('heading', { name: 'Knowledge Base', level: 1 })).toBeVisible();

  await page.getByTestId('nav-runs').click();
  await expect(page.getByRole('heading', { name: 'Run Explorer', level: 1 })).toBeVisible();

  await page.getByTestId('nav-evaluations').click();
  await expect(page.getByRole('heading', { name: 'Evaluations', level: 1 })).toBeVisible();

  await page.getByTestId('nav-library').click();
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible();

  await page.getByTestId('nav-logs').click();
  await expect(page.getByRole('heading', { name: 'System Logs', level: 1 })).toBeVisible();

  await page.getByTestId('nav-settings').click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

  await page.getByTestId('nav-agents').click();
  await expect(page.getByRole('heading', { name: 'Agent Factory' })).toBeVisible();
});

test('save prompt appears in Quick Access', async ({ page }) => {
  await page.getByTestId('nav-agents').click();
  await page.getByTestId('goal-input').fill(TEST_PROMPT_QUERY);
  await page.getByTestId('save-prompt-btn').click();

  await expect(page.getByTestId('save-prompt-modal')).toBeVisible();
  await page.getByTestId('prompt-title-input').fill(TEST_PROMPT_TITLE);
  await page.getByTestId('confirm-save-prompt').click();

  await expect(page.getByTestId('quick-access')).toBeVisible();
  await expect(page.getByTestId('saved-prompts-section')).toContainText(TEST_PROMPT_TITLE);
});

test('repositories show size labels', async ({ page }) => {
  await page.getByTestId('nav-knowledge').click();

  const sizeLabels = page.locator('[data-testid^="stat-size-"]');
  await expect(sizeLabels.first()).toBeVisible();
  const count = await sizeLabels.count();
  for (let i = 0; i < count; i += 1) {
    const sizeLabel = sizeLabels.nth(i);
    await expect(sizeLabel).toBeVisible();
    await expect.poll(async () => (await sizeLabel.textContent()) || '', { timeout: 30000 }).not.toContain('—');
  }
});

test('invalid repo URL logs an error', async ({ page }) => {
  await page.getByTestId('nav-knowledge').click();
  await page.getByTestId('repo-url-input').fill('not-a-url');
  await page.getByTestId('repo-clone-btn').click();

  await page.getByTestId('nav-logs').click();
  await expect(page.getByTestId('system-logs')).toContainText('Invalid repository URL');
});

test('duplicate repo is ignored with notice', async ({ page, request }) => {
  const res = await request.get(`${API_BASE}/repos`);
  if (!res.ok()) test.skip('No repos available to validate duplicate handling.');
  const repos = await res.json();
  if (!Array.isArray(repos) || repos.length === 0) {
    test.skip('No repos available to validate duplicate handling.');
  }

  const existingRepo = repos[0];
  const existingPath = existingRepo.Path || existingRepo.path;
  if (!existingPath) test.skip('Repo entry missing path.');

  await page.getByTestId('nav-knowledge').click();
  await page.getByTestId('repo-url-input').fill(existingPath);
  await page.getByTestId('repo-clone-btn').click();

  await expect(page.getByTestId('repo-notice')).toContainText('already exists');

  await page.getByTestId('nav-logs').click();
  await expect(page.getByTestId('system-logs')).toContainText('Repo already exists');
});

test('scan repositories emits logs', async ({ page }) => {
  await page.getByTestId('nav-knowledge').click();
  await page.getByTestId('repo-scan-btn').click();

  await page.getByTestId('nav-logs').click();
  await expect(page.getByTestId('system-logs')).toContainText('Scan');
});

test('settings rejects empty repos root', async ({ page }) => {
  await page.getByTestId('nav-settings').click();
  const input = page.getByTestId('settings-repos-root');
  await input.fill('');
  await page.getByTestId('settings-save').click();
  await expect(page.getByTestId('settings-error')).toContainText('Repository root path cannot be empty');
});

test('settings allow testing LLM endpoint connectivity', async ({ page }) => {
  await page.getByTestId('nav-settings').click();
  await expect(page.locator('#settings-llm-endpoint')).toBeVisible();
  await page.getByRole('button', { name: 'Test Connection' }).click();
});

test('spawn generates flight plan and telemetry updates', async ({ page, request }) => {
  test.setTimeout(360000);

  const beforeRes = await request.get(`${API_BASE}/analytics`);
  expect(beforeRes.ok()).toBeTruthy();
  const before = await beforeRes.json();

  await page.getByTestId('nav-agents').click();
  await page.getByTestId('goal-input').fill(SPAWN_GOAL);
  await page.getByTestId('format-select').click();
  await page.getByTestId('format-option-chatgpt').click();
  await page.getByTestId('generate-flight-plan').click();

  const output = page.getByTestId('flight-plan-output');
  await expect(output).toBeVisible({ timeout: 300000 });
  await expect(output).toContainText('BEGIN DIRECTIVE');
  await expect(output).toContainText('# MODEL: ChatGPT');
  await expect(output).toContainText('DECISION MATRIX');
  await expect(output).toContainText('Query expansion');
  await expect(output).toContainText('DECISION TRACE');
  await expect(output).toContainText('AGENTS.md');

  await page.getByTestId('copy-flight-plan').click();
  await expect(page.getByTestId('copy-flight-plan')).toContainText('Copied');

  await expect(page.getByTestId('recent-sessions-section')).toBeVisible();
  await expect(page.getByTestId('recent-sessions-section')).toContainText(TEST_PROMPT_PREFIX);

  const afterRes = await request.get(`${API_BASE}/analytics`);
  expect(afterRes.ok()).toBeTruthy();
  const after = await afterRes.json();
  expect(after.totalSpawns).toBeGreaterThan(before.totalSpawns);
  expect(after.recentSpawns.some((spawn) => spawn.goal && spawn.goal.includes(TEST_PROMPT_PREFIX))).toBeTruthy();
});
