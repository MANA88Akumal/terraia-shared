import { test, expect } from '../fixtures/auth';

test.describe('Accounting Dashboard', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
  });

  test('dashboard heading is visible', async ({ authenticatedPage: page }) => {
    // Accounting dashboard should show a heading or title
    const heading = page.locator('h1, h2, [class*="heading"], [class*="title"]').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('cash position cards render', async ({ authenticatedPage: page }) => {
    // DashboardCashPosition renders cards with bank balances
    // Look for currency values on the page
    const body = await page.textContent('body');
    expect(body).toMatch(/\$[\d,.]+/);
  });

  test('currency values (MXN/USD) present', async ({ authenticatedPage: page }) => {
    const body = await page.textContent('body');
    // Should see at least one currency indicator
    const hasCurrency = /MXN|USD|\$/.test(body || '');
    expect(hasCurrency).toBe(true);
  });

  test('sidebar navigation to Transactions works', async ({ authenticatedPage: page }) => {
    const txLink = page.locator('nav a[href*="/transactions"]');
    await expect(txLink.first()).toBeVisible();
    await txLink.first().click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/transactions');
  });
});
