import { test, expect } from '../fixtures/auth';

test.describe('Language Toggle (i18n)', () => {
  test('clicking toggle changes dashboard heading text', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Capture the initial page text
    const initialText = await page.locator('nav').textContent();

    // Find the language toggle button (shows a flag emoji)
    const langToggle = page.locator('button', { hasText: /🇺🇸|🇲🇽|🇧🇷/ }).first();
    await expect(langToggle).toBeVisible({ timeout: 5_000 });

    // Click to toggle language
    await langToggle.click();
    await page.waitForTimeout(500); // Brief wait for re-render

    // Get the text again — it should be different
    const toggledText = await page.locator('nav').textContent();
    expect(toggledText).not.toBe(initialText);
  });

  test('toggling back restores original text', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    const initialText = await page.locator('nav').textContent();

    // Toggle language (3-way cycle: es→en→pt→es)
    const langToggle = page.locator('button', { hasText: /🇺🇸|🇲🇽|🇧🇷/ }).first();
    await expect(langToggle).toBeVisible({ timeout: 5_000 });

    await langToggle.click();
    await page.waitForTimeout(500);

    const midText = await page.locator('nav').textContent();
    expect(midText).not.toBe(initialText);

    // Click twice more to cycle back (en→pt→es)
    await langToggle.click();
    await page.waitForTimeout(500);
    await langToggle.click();
    await page.waitForTimeout(500);

    const restoredText = await page.locator('nav').textContent();
    expect(restoredText).toBe(initialText);
  });
});
