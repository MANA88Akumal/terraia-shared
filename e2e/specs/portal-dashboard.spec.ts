import { test, expect } from '../fixtures/auth';

test.describe('Portal Dashboard', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
  });

  test('dashboard shows financial metrics', async ({ authenticatedPage: page }) => {
    // The portal dashboard renders 4 key metric cards
    // Look for currency-formatted values ($ or MXN/USD patterns)
    const body = await page.textContent('body');
    expect(body).toMatch(/\$[\d,.]+/);
  });

  test('charts render (Recharts SVG elements)', async ({ authenticatedPage: page }) => {
    // Recharts renders SVG elements for charts
    const svgCharts = page.locator('svg.recharts-surface');
    // Should have at least one chart (Revenue Projection or Cost Breakdown)
    await expect(svgCharts.first()).toBeVisible({ timeout: 10_000 });
  });

  test('nav links work: Returns', async ({ authenticatedPage: page }) => {
    const returnsLink = page.locator('nav a[href*="/returns"]');
    await expect(returnsLink).toBeVisible();
    await returnsLink.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/returns');
  });

  test('nav links work: Sales', async ({ authenticatedPage: page }) => {
    // Use exact href to avoid matching /admin/sales
    const salesLink = page.locator('nav a[href="/sales"]');
    await expect(salesLink).toBeVisible();
    await salesLink.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/sales');
  });

  test('nav links work: Scenarios', async ({ authenticatedPage: page }) => {
    const scenariosLink = page.locator('nav a[href*="/scenarios"]');
    await expect(scenariosLink).toBeVisible();
    await scenariosLink.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/scenarios');
  });
});
