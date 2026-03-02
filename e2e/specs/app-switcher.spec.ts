import { test, expect } from '../fixtures/auth';

test.describe('App Switcher', () => {
  test('app switcher dropdown shows all 3 apps', async ({ authenticatedPage: page }) => {
    await page.goto('https://investors.manaakumal.com/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });

    // The app switcher button contains the current app name
    const appSwitcherBtn = page.locator('button', { hasText: 'Investor Portal' });
    await expect(appSwitcherBtn).toBeVisible({ timeout: 5_000 });
    await appSwitcherBtn.click();

    // Dropdown renders with zIndex 1000, width 240
    const dropdown = page.locator('div[style*="z-index"]');
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    const text = await dropdown.textContent();
    expect(text).toContain('Accounting');
    expect(text).toContain('Client Management');
    expect(text).toContain('Investor Portal');
  });

  test('current app is marked', async ({ authenticatedPage: page }) => {
    await page.goto('https://investors.manaakumal.com/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });

    const appSwitcherBtn = page.locator('button', { hasText: 'Investor Portal' });
    await appSwitcherBtn.click();

    const dropdown = page.locator('div[style*="z-index"]');
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // Current app (Investor Portal) should have "Current" badge
    const currentBadge = dropdown.locator('span', { hasText: 'Current' });
    await expect(currentBadge).toBeVisible();
  });

  test('clicking another app navigates with session intact', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('https://investors.manaakumal.com/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });

    const appSwitcherBtn = page.locator('button', { hasText: 'Investor Portal' });
    await appSwitcherBtn.click();

    const dropdown = page.locator('div[style*="z-index"]');
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // Click on Accounting button (app switcher items are buttons, not links)
    const accountingBtn = dropdown.locator('button', { hasText: 'Accounting' });
    await expect(accountingBtn).toBeVisible();
    await accountingBtn.click();

    // Should navigate to accounting app
    await page.waitForURL(/accounting\.manaakumal\.com/, { timeout: 15_000 });
    expect(page.url()).toContain('accounting.manaakumal.com');
    expect(page.url()).not.toContain('login.manaakumal.com');

    // Session should be intact — nav should render
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });
  });
});
