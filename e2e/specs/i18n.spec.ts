import { test, expect } from '../fixtures/auth';

test.describe('Language Toggle (i18n)', () => {
  test('selecting a different language changes dashboard text', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Capture the initial nav text
    const initialText = await page.locator('nav').textContent();

    // The LanguageToggle is a dropdown inside the sidebar footer (outside <nav>)
    // The trigger button contains the current flag emoji
    const langTrigger = page.locator('aside button', { hasText: /🇺🇸|🇲🇽|🇧🇷/ }).first();
    await expect(langTrigger).toBeVisible({ timeout: 5_000 });

    // Open the dropdown
    await langTrigger.click();
    await page.waitForTimeout(300);

    // Click "English" option (or whichever is NOT currently selected)
    // The dropdown buttons also contain flag emojis — pick one that differs
    const currentFlag = await langTrigger.textContent();
    let targetLang: string;
    if (currentFlag?.includes('🇲🇽')) {
      targetLang = 'English';
    } else if (currentFlag?.includes('🇺🇸')) {
      targetLang = 'Português';
    } else {
      targetLang = 'Español';
    }

    const langOption = page.locator('button', { hasText: targetLang });
    await expect(langOption).toBeVisible({ timeout: 3_000 });
    await langOption.click();
    await page.waitForTimeout(500);

    // Nav text should be different now
    const toggledText = await page.locator('nav').textContent();
    expect(toggledText).not.toBe(initialText);
  });

  test('cycling through all languages restores original text', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    const initialText = await page.locator('nav').textContent();
    const langTrigger = page.locator('aside button', { hasText: /🇺🇸|🇲🇽|🇧🇷/ }).first();
    await expect(langTrigger).toBeVisible({ timeout: 5_000 });

    // Determine current language and the cycle order
    const languages = ['Español', 'English', 'Português'];
    const currentFlag = await langTrigger.textContent();
    let currentIdx = 0;
    if (currentFlag?.includes('🇺🇸')) currentIdx = 1;
    else if (currentFlag?.includes('🇧🇷')) currentIdx = 2;

    // Switch to next language
    await langTrigger.click();
    await page.waitForTimeout(300);
    const nextLang = languages[(currentIdx + 1) % 3];
    await page.locator('button', { hasText: nextLang }).click();
    await page.waitForTimeout(500);

    const midText = await page.locator('nav').textContent();
    expect(midText).not.toBe(initialText);

    // Switch to third language
    await langTrigger.click();
    await page.waitForTimeout(300);
    const thirdLang = languages[(currentIdx + 2) % 3];
    await page.locator('button', { hasText: thirdLang }).click();
    await page.waitForTimeout(500);

    // Switch back to original language
    await langTrigger.click();
    await page.waitForTimeout(300);
    const originalLang = languages[currentIdx];
    await page.locator('button', { hasText: originalLang }).click();
    await page.waitForTimeout(500);

    const restoredText = await page.locator('nav').textContent();
    expect(restoredText).toBe(initialText);
  });
});
