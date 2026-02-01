const { test, expect } = require('@playwright/test');

const DEFAULT_REPOS_ROOT = 'D:\\Projects\\reference-repos';
const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3002/api';
const REPOS_ROOT = process.env.E2E_REPOS_ROOT || DEFAULT_REPOS_ROOT;
const TEST_PROMPT_PREFIX = '[E2E]';
const TEST_PROMPT_TITLE = `${TEST_PROMPT_PREFIX} Test Creation`;
const TEST_PROMPT_QUERY = `${TEST_PROMPT_PREFIX} Test Creation prompt`;

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
  await expect(page.getByRole('heading', { name: 'Agent Factory' })).toBeVisible();
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
  await page.getByTestId('nav-repos').click();
  await expect(page.getByRole('heading', { name: 'Repositories', level: 1 })).toBeVisible();

  await page.getByTestId('nav-logs').click();
  await expect(page.getByRole('heading', { name: 'System Logs', level: 1 })).toBeVisible();

  await page.getByTestId('nav-settings').click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

  await page.getByTestId('nav-agents').click();
  await expect(page.getByRole('heading', { name: 'Agent Factory', level: 1 })).toBeVisible();
});

test('save prompt appears in Quick Access', async ({ page }) => {
  await page.getByTestId('goal-input').fill(TEST_PROMPT_QUERY);
  await page.getByTestId('save-prompt-btn').click();

  await expect(page.getByTestId('save-prompt-modal')).toBeVisible();
  await page.getByTestId('prompt-title-input').fill(TEST_PROMPT_TITLE);
  await page.getByTestId('confirm-save-prompt').click();

  await expect(page.getByTestId('quick-access')).toBeVisible();
  await expect(page.getByTestId('saved-prompts-section')).toContainText(TEST_PROMPT_TITLE);
});

test('repositories show size labels', async ({ page }) => {
  await page.getByTestId('nav-repos').click();

  const cards = page.locator('[data-testid^="stat-card-"]');
  await expect(cards.first()).toBeVisible();

  const count = await cards.count();
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    const testId = await card.getAttribute('data-testid');
    if (!testId) continue;
    const sizeTestId = testId.replace('stat-card-', 'stat-size-');
    const sizeLabel = page.getByTestId(sizeTestId);
    await expect(sizeLabel).toBeVisible();
    await expect.poll(async () => (await sizeLabel.textContent()) || '', { timeout: 30000 }).not.toContain('—');
  }
});

test('invalid repo URL logs an error', async ({ page }) => {
  await page.getByTestId('nav-repos').click();
  await page.getByTestId('repo-url-input').fill('not-a-url');
  await page.getByTestId('repo-clone-btn').click();

  await page.getByTestId('nav-logs').click();
  await expect(page.getByTestId('system-logs')).toContainText('Invalid repository URL');
});

test('settings rejects empty repos root', async ({ page }) => {
  await page.getByTestId('nav-settings').click();
  const input = page.getByTestId('settings-repos-root');
  await input.fill('');
  await page.getByTestId('settings-save').click();
  await expect(page.getByTestId('settings-error')).toContainText('Repository root path cannot be empty');
});

test('analytics endpoint returns expected shape', async ({ request }) => {
  const res = await request.get(`${API_BASE}/analytics`);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(typeof data.totalSpawns).toBe('number');
  expect(typeof data.thisMonthSpawns).toBe('number');
  expect(data).toHaveProperty('recentSpawns');
});
