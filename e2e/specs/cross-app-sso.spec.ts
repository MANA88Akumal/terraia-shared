import { test, expect } from '../fixtures/auth';

const APPS = [
  { name: 'Portal', url: 'https://investors.terraia.io/dashboard' },
  { name: 'Accounting', url: 'https://accounting.terraia.io/' },
  { name: 'CMS', url: 'https://cms.terraia.io/' },
];

test.describe('Cross-App SSO', () => {
  test('single cookie authenticates across all 3 apps', async ({ authenticatedPage: page }) => {
    for (const app of APPS) {
      await page.goto(app.url);

      // Should NOT redirect to login
      await page.waitForLoadState('networkidle');
      expect(page.url()).not.toContain('login.terraia.io');

      // Should render nav (indicates AuthProvider resolved successfully)
      await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });
    }
  });

  test('dashboard content renders on each app (not loading spinners)', async ({
    authenticatedPage: page,
  }) => {
    for (const app of APPS) {
      await page.goto(app.url);
      await page.waitForLoadState('networkidle');

      // Each app should show some meaningful content beyond the shell
      // Look for text content or data elements that indicate the page loaded
      const bodyText = await page.locator('main, [class*="content"], [class*="dashboard"]').first().textContent();
      expect(bodyText?.length).toBeGreaterThan(0);
    }
  });
});
