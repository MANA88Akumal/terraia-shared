import { test, expect } from '../fixtures/auth';
import { hasSessionCookie } from '../helpers/cookie';

test.describe('Sign Out', () => {
  test('sign out clears cookie and redirects to login', async ({
    authenticatedPage: page,
    context,
  }) => {
    await page.goto('/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });

    // Verify cookie exists before sign out
    expect(await hasSessionCookie(context)).toBe(true);

    // Find and click Sign Out button in the sidebar account menu
    const signOutBtn = page.locator('button', { hasText: /sign.?out|cerrar.?sesi/i });
    await expect(signOutBtn).toBeVisible({ timeout: 5_000 });
    await signOutBtn.click();

    // Should redirect to login portal
    await page.waitForURL(/login\.manaakumal\.com/, { timeout: 15_000 });
    expect(page.url()).toContain('login.manaakumal.com');
  });

  test('after sign out, visiting any app redirects to login', async ({
    authenticatedPage: page,
    context,
  }) => {
    await page.goto('/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });

    // Sign out
    const signOutBtn = page.locator('button', { hasText: /sign.?out|cerrar.?sesi/i });
    await expect(signOutBtn).toBeVisible({ timeout: 5_000 });
    await signOutBtn.click();
    await page.waitForURL(/login\.manaakumal\.com/, { timeout: 15_000 });

    // Now try to visit another app — should redirect to login
    await page.goto('https://accounting.manaakumal.com/');
    await page.waitForURL(/login\.manaakumal\.com/, { timeout: 15_000 });
    expect(page.url()).toContain('login.manaakumal.com');
  });
});
