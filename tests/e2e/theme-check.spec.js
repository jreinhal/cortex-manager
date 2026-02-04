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

const themes = [
  { key: 'light', storage: 'light' },
  { key: 'dark', storage: 'dark' },
  { key: 'system', storage: 'system' },
];

test.describe('theme visual sweep', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const theme of themes) {
    test.describe(`${theme.key} mode`, () => {
      test.beforeEach(async ({ page }) => {
        await page.addInitScript((value) => {
          window.localStorage.setItem('cortex_theme', value);
        }, theme.storage);
      });

      for (const view of views) {
        test(`${theme.key} - ${view.key}`, async ({ page }) => {
          await page.goto(`/?view=${view.key}`, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('#main-content');
          await page.waitForTimeout(600);
          await page.screenshot({
            path: `test-results/theme-check/${theme.key}-${view.label}.png`,
            fullPage: true,
          });

          const themeAttr = await page.getAttribute('html', 'data-theme');
          if (theme.key === 'system') {
            expect(['light', 'dark']).toContain(themeAttr);
          } else {
            expect(themeAttr).toBe(theme.key);
          }
        });
      }
    });
  }
});
