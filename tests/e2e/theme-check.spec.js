const { test, expect } = require('@playwright/test');

const views = [
  { key: 'home', label: 'command-center' },
  { key: 'agents', label: 'agent-factory' },
  { key: 'runs', label: 'run-explorer' },
  { key: 'jobs', label: 'jobs' },
  { key: 'evaluations', label: 'evaluations' },
  { key: 'library', label: 'library' },
  { key: 'knowledge', label: 'knowledge-base' },
  { key: 'audit', label: 'audit-trail' },
  { key: 'logs', label: 'system-logs' },
  { key: 'settings', label: 'settings' },
];

test.describe('light mode visual sweep', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('cortex_theme', 'light');
    });
  });

  for (const view of views) {
    test(`light mode - ${view.key}`, async ({ page }) => {
      await page.goto(`/?view=${view.key}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#main-content');
      await page.waitForTimeout(600);
      await page.screenshot({
        path: `test-results/theme-check/light-${view.label}.png`,
        fullPage: true,
      });
      expect(await page.getAttribute('html', 'data-theme')).toBe('light');
    });
  }
});
