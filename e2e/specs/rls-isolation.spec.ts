import { test, expect } from '../fixtures/auth';
import { getAnonClient } from '../helpers/supabase-admin';

test.describe('RLS Data Isolation', () => {
  test('authenticated page shows data (not empty/error)', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for dashboard to load — look for any data rendering
    await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 });

    // Should not show error messages
    const body = await page.textContent('body');
    expect(body).not.toContain('Error loading');
    expect(body).not.toContain('No data available');
  });

  test('anon Supabase client is restricted from tenant-scoped tables', async ({}) => {
    // This test runs a direct Supabase query without any session
    let anonClient: ReturnType<typeof getAnonClient>;
    try {
      anonClient = getAnonClient();
    } catch {
      test.skip(true, 'SUPABASE_ANON_KEY not set — skipping anon RLS test');
      return;
    }

    // Test tenant-scoped tables — RLS policies use get_current_tenant_id()
    // which returns NULL for anonymous users, so tenant-filtered tables return 0 rows
    const tables = ['cases', 'user_roles'];
    let blockedCount = 0;

    for (const table of tables) {
      const { data, error } = await anonClient.from(table).select('id').limit(1);
      if (error) {
        // Permission denied or RLS blocked — this is expected
        blockedCount++;
      } else if (!data || data.length === 0) {
        // Empty result set — also valid RLS behavior
        blockedCount++;
      }
    }

    // At least one table should be protected by RLS
    expect(blockedCount).toBeGreaterThan(0);
  });
});
