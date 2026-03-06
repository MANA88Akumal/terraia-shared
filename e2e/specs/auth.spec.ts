import { test, expect } from '../fixtures/auth';

test.describe('Auth Chain', () => {
  test('authenticated admin lands on dashboard', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    // Should not be stuck on loading — dashboard content should appear
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });
    // Should see dashboard content, not a redirect to login
    await expect(page).not.toHaveURL(/login\.terraia\.io/);
  });

  test('unauthenticated user redirects to login portal', async ({ page }) => {
    // No cookie injected — navigate directly
    await page.goto('https://investors.terraia.io/dashboard');
    // AuthProvider should redirect to login.terraia.io
    await page.waitForURL(/login\.terraia\.io/, { timeout: 15_000 });
    expect(page.url()).toContain('login.terraia.io');
  });

  test('unapproved user sees pending-approval', async ({ unapprovedPage: page }) => {
    await page.goto('/dashboard');
    // Should be redirected to /pending-approval
    await page.waitForURL(/pending-approval/, { timeout: 15_000 });
    expect(page.url()).toContain('pending-approval');
  });

  test('sidebar navigation is visible after auth', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    // Sidebar should render with nav links
    const sidebar = page.locator('nav');
    await expect(sidebar).toBeVisible({ timeout: 15_000 });
    // Should have at least one nav link
    const navLinks = sidebar.locator('a');
    await expect(navLinks.first()).toBeVisible();
  });
});
