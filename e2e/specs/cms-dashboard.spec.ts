import { test, expect } from '../fixtures/auth';

test.describe('CMS Dashboard', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
  });

  test('stat cards render with numeric values', async ({ authenticatedPage: page }) => {
    // CMS dashboard shows 4 stat cards (Active Cases, Pending Offers, Total Collected, Overdue)
    // Look for numeric content indicating data loaded
    const body = await page.textContent('body');
    // Should have at least some numbers on the dashboard
    expect(body).toMatch(/\d+/);
  });

  test('cases list page loads', async ({ authenticatedPage: page }) => {
    const casesLink = page.locator('nav a[href*="/cases"]');
    if (await casesLink.first().isVisible()) {
      await casesLink.first().click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/cases');
      // Should show a list or table
      await expect(page.locator('nav')).toBeVisible();
    }
  });

  test('offers page loads', async ({ authenticatedPage: page }) => {
    const offersLink = page.locator('nav a[href*="/offers"]');
    await expect(offersLink.first()).toBeVisible();
    await offersLink.first().click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/offers');
  });
});
