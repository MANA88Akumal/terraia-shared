import { test, expect } from '../fixtures/auth';

test.describe('Role-Based Access', () => {
  test('investor cannot access /admin routes', async ({ investorPage: page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    // Should be redirected away from admin — either to dashboard or forbidden
    await expect(page).not.toHaveURL(/\/admin$/);
  });

  test('admin can access /admin routes', async ({ authenticatedPage: page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    // Admin should stay on admin page
    expect(page.url()).toContain('/admin');
    // Should see admin content
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });
  });

  test('admin sidebar shows admin section', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });

    // Admin sidebar should contain admin-related links
    const sidebar = page.locator('nav');
    const adminLink = sidebar.locator('a[href*="/admin"]');
    await expect(adminLink.first()).toBeVisible({ timeout: 5_000 });
  });

  test('investor sidebar hides admin section', async ({ investorPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });

    // Investor sidebar should NOT contain admin links
    const sidebar = page.locator('nav');
    const adminLinks = sidebar.locator('a[href*="/admin"]');
    await expect(adminLinks).toHaveCount(0);
  });
});
