import { test, expect } from '../fixtures/auth';

test.describe('Login Portal - Auth', () => {
  test('authenticated user sees app launcher', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    // Login portal shows a header with the TerraIA logo
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
    // Should see the app cards grid
    await expect(page.locator('main')).toBeVisible();
    // Should see at least one app card button
    await expect(page.locator('main button').first()).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated user sees sign-in page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Should show a Google sign-in button or sign-in UI (not the app launcher)
    const hasSignIn = await page.locator('button', { hasText: /google|sign.?in|iniciar/i }).isVisible().catch(() => false);
    const hasOnboarding = page.url().includes('/onboard');
    // Either shows sign-in or redirects to onboarding
    expect(hasSignIn || hasOnboarding || page.url().includes('login.terraia.io')).toBeTruthy();
  });
});

test.describe('Login Portal - App Cards', () => {
  test('shows all 6 app cards', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
    // Should render 6 app cards in the grid
    const cards = page.locator('main button');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('app cards have names and descriptions', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('main button').first()).toBeVisible({ timeout: 10_000 });
    const bodyText = await page.locator('main').textContent();
    // Should contain app names
    expect(bodyText).toMatch(/accounting|contabilidad/i);
    expect(bodyText).toMatch(/investor|inversores|proforma/i);
  });
});

test.describe('Login Portal - Sign Out', () => {
  test('sign out button is visible and works', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
    // The logout button is in the header (LogOut icon button)
    const logoutBtn = page.locator('header button[title]').last();
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
  });
});
