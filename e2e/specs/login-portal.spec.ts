import { test, expect } from '../fixtures/auth';

test.describe('Login Portal', () => {
  test('unauthenticated user sees sign-in page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Should show the login page with Google sign-in, or the sign-in form
    // The page should NOT show a loading spinner forever
    const body = await page.locator('body').textContent({ timeout: 15_000 });
    // Login page should have some auth-related content
    const hasAuthContent = /google|sign.?in|iniciar|log.?in|email|password/i.test(body || '');
    expect(hasAuthContent).toBeTruthy();
  });

  test('login page loads without errors', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // Should not show a blank page or error
    const body = await page.locator('body');
    await expect(body).not.toBeEmpty();
    // Verify no JS errors caused a white screen
    const text = await body.textContent();
    expect(text?.length).toBeGreaterThan(10);
  });

  test('unknown routes redirect to root', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await page.waitForLoadState('networkidle');
    // Should redirect to / (login page for unauth) or /login
    expect(page.url()).toMatch(/\/$|\/login/);
  });
});
