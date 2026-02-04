const { test, expect } = require('@playwright/test');

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

function intersects(a, b) {
  if (!a || !b) return false;
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;
  const bBottom = b.y + b.height;
  return !(
    aRight <= b.x ||
    a.x >= bRight ||
    aBottom <= b.y ||
    a.y >= bBottom
  );
}

test('manual UI audit smoke (edge)', async ({ page }) => {
  await page.goto('/');
  await completeSetupIfNeeded(page);

  await page.getByTestId('nav-knowledge').click();
  await expect(page.getByTestId('nav-knowledge')).toHaveAttribute('aria-current', 'page');

  await page.getByTestId('nav-runs').click();
  await expect(page.getByTestId('nav-runs')).toHaveAttribute('aria-current', 'page');

  await page.getByTestId('nav-knowledge').click();
  const label = page.locator('label[for="repo-url"]');
  const input = page.locator('#repo-url');
  await expect(label).toBeVisible();
  await expect(input).toBeVisible();

  const labelBox = await label.boundingBox();
  const inputBox = await input.boundingBox();
  expect(labelBox).not.toBeNull();
  expect(inputBox).not.toBeNull();
  expect(intersects(labelBox, inputBox)).toBeFalsy();

  await input.focus();
  await page.waitForTimeout(150);

  await page.getByTestId('nav-logs').click();
  const logs = page.getByTestId('system-logs');
  await expect(logs).toBeVisible();
  const initialText = (await logs.textContent()) || '';

  await page.getByTestId('nav-home').click();
  await page.getByTestId('nav-logs').click();
  await expect(logs).toBeVisible();
  const followupText = (await logs.textContent()) || '';

  if (initialText.trim().length > 0) {
    await expect(logs).toContainText(initialText.trim().slice(0, 12));
  } else {
    await expect(logs).toContainText('No activity recorded');
  }
});
