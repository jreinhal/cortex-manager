const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const DEFAULT_REPOS_ROOT = 'D:\\Projects\\reference-repos';
const REPOS_ROOT = process.env.E2E_REPOS_ROOT || DEFAULT_REPOS_ROOT;

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

test.use({ viewport: { width: 1440, height: 900 } });

test('capture product screenshots', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'edge') {
    test.skip();
  }

  const outputDir = path.join(__dirname, '..', '..', 'docs', 'screenshots');
  fs.mkdirSync(outputDir, { recursive: true });

  await page.goto('/');
  await completeSetupIfNeeded(page);

  const capture = async ({ label, navTestId, heading }) => {
    if (navTestId) {
      await page.getByTestId(navTestId).click();
    }
    await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outputDir, `${label}.png`), fullPage: true });
  };

  await capture({ label: 'command-center', navTestId: 'nav-home', heading: 'Command Center' });

  const openChecklist = page.getByRole('button', { name: 'Open checklist' });
  if (await openChecklist.isVisible().catch(() => false)) {
    await openChecklist.click();
    await expect(page.getByRole('heading', { name: 'Quickstart Checklist' })).toBeVisible({ timeout: 15000 });
    const loadingIndicator = page.getByText('Loading checklist…');
    if (await loadingIndicator.isVisible().catch(() => false)) {
      await expect(loadingIndicator).toBeHidden({ timeout: 15000 });
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outputDir, 'quickstart-checklist.png'), fullPage: true });
    await page.getByRole('button', { name: 'Close' }).click();
  }
  await capture({ label: 'agent-factory', navTestId: 'nav-agents', heading: 'Agent Factory' });
  await capture({ label: 'knowledge-base', navTestId: 'nav-knowledge', heading: 'Knowledge Base' });
  await capture({ label: 'evaluations', navTestId: 'nav-evaluations', heading: 'Evaluations' });
  await capture({ label: 'audit-trail', navTestId: 'nav-audit', heading: 'Audit Trail' });
  await capture({ label: 'settings', navTestId: 'nav-settings', heading: 'Settings' });
});
