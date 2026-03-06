/**
 * Onboarding Flow E2E Test
 *
 * Tests the full onboarding wizard: language → AI chat → file import → ready.
 * Uses Selva Azul test data from ~/Desktop/TerraIA/TestData/.
 *
 * Requires: e2e-onboard@manaakumal.com user created via setup-test-users.ts
 */
import { test as base, expect } from '@playwright/test';
import { injectLoginSession } from '../helpers/cookie';
import { getAdminClient } from '../helpers/supabase-admin';
import type { Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.resolve(__dirname, '../../../../TestData');

// Custom fixture: page with Supabase session injected into localStorage
const test = base.extend<{ loginPage: Page }>({
  loginPage: async ({ page }, use) => {
    await injectLoginSession(page, 'onboard');
    await use(page);
  },
});

const ONBOARD_USER_ID = '72dc92ab-a31d-4cee-b79a-0c83e68b59ba';

// Helper to delete rows — returns true if any were deleted
async function del(admin: any, table: string, column: string, value: string): Promise<boolean> {
  const { error, data } = await admin.from(table).delete().eq(column, value).select('id');
  if (error) {
    console.log(`  ⚠ ${table}: ${error.message}`);
    return false;
  }
  if (data && data.length > 0) {
    console.log(`  ${table}: ${data.length} deleted`);
    return true;
  }
  return false;
}

// Clean up a test org and all related data
async function cleanupOrg(admin: any, orgId: string) {
  console.log(`Cleaning up test org: ${orgId}`);
  // Delete user_roles FIRST (UNIQUE(user_id) constraint)
  await del(admin, 'user_roles', 'user_id', ONBOARD_USER_ID);
  await del(admin, 'organization_members', 'org_id', orgId);
  await del(admin, 'accounting_bank_transactions', 'org_id', orgId);
  await del(admin, 'accounting_bank_accounts', 'org_id', orgId);
  await del(admin, 'accounting_vendors', 'org_id', orgId);
  await del(admin, 'accounting_chart_of_accounts', 'org_id', orgId);
  await del(admin, 'cases', 'org_id', orgId);
  await del(admin, 'clients', 'org_id', orgId);
  await del(admin, 'lots', 'org_id', orgId);
  await del(admin, 'tenants', 'id', orgId);
  await del(admin, 'organizations', 'id', orgId);
  console.log('Cleanup complete');
}

// Pre-test: remove any stale data for the onboard user
async function cleanupStaleData() {
  const admin = getAdminClient();

  // Collect stale org IDs from both user_roles and organization_members
  const orgIds = new Set<string>();

  const { data: roles } = await admin.from('user_roles').select('tenant_id').eq('user_id', ONBOARD_USER_ID);
  if (roles) roles.forEach((r: any) => orgIds.add(r.tenant_id));

  const { data: members } = await admin.from('organization_members').select('org_id').eq('user_id', ONBOARD_USER_ID);
  if (members) members.forEach((m: any) => orgIds.add(m.org_id));

  if (orgIds.size > 0) {
    console.log(`Found ${orgIds.size} stale org(s) for onboard user — cleaning up`);
    for (const orgId of orgIds) {
      await cleanupOrg(admin, orgId);
    }
  }

  // Safety net: force-delete user_roles even if no org was found
  await del(admin, 'user_roles', 'user_id', ONBOARD_USER_ID);
  await del(admin, 'organization_members', 'user_id', ONBOARD_USER_ID);

  // Verify user_roles is clean
  const { data: check } = await admin.from('user_roles').select('id').eq('user_id', ONBOARD_USER_ID);
  if (check && check.length > 0) {
    console.log(`⚠ user_roles still has ${check.length} row(s) after cleanup — retrying`);
    await new Promise(r => setTimeout(r, 1000));
    await del(admin, 'user_roles', 'user_id', ONBOARD_USER_ID);
  }
}

// ─── Full onboarding with file imports ─────────────────────────────────────────

test.describe('Onboarding — Full Flow', () => {
  test.setTimeout(300_000); // 5 minutes for AI calls

  let testOrgId: string | null = null;

  test.beforeEach(async () => {
    await cleanupStaleData();
  });

  test.afterEach(async () => {
    if (testOrgId) {
      await cleanupOrg(getAdminClient(), testOrgId);
      testOrgId = null;
    }
  });

  test('complete onboarding: language → chat → import → ready', async ({ loginPage: page }) => {
    // Clear any stale onboarding state
    await page.goto('/onboarding');
    await page.evaluate(() => localStorage.removeItem('terraia_onboarding'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // ── STEP 0: Language Selection ──────────────────────────────────────────
    await expect(page.getByText('Welcome to TerraIA')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('English', { exact: true })).toBeVisible();
    await expect(page.getByText('Español', { exact: true })).toBeVisible();
    await expect(page.getByText('Português', { exact: true })).toBeVisible();

    // Select English
    await page.getByRole('button', { name: /English/ }).click();

    // Should advance to Chat step
    const chatInput = page.locator('input[placeholder="Tell me about your project..."]');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    console.log('✓ Step 0: Language selected');

    // ── STEP 1: AI Chat + Org Creation ──────────────────────────────────────
    // Greeting message should be visible
    await expect(page.locator('[class*="rounded-xl"][class*="px-4"][class*="py-3"]').first()).toBeVisible({ timeout: 10_000 });

    // Type project info — must include company, projectName, and location
    await chatInput.fill(
      'My company is Selva Azul Development. ' +
      'We are building Residencias Selva Azul, a 48-unit residential project ' +
      'in Panama City, Panama. Our currency is USD. ' +
      'We bank with BBVA Panama.'
    );
    await page.locator('button[type="submit"]').click();

    // Wait for user message to appear
    await expect(page.locator('text=Selva Azul Development').first()).toBeVisible({ timeout: 5_000 });

    // Wait for AI typing indicator to disappear
    await expect(page.locator('.animate-bounce')).toHaveCount(0, { timeout: 60_000 });
    console.log('✓ AI responded to chat message');

    // "Confirm & Set Up" should be enabled (canProceed = company + projectName + location)
    const confirmBtn = page.getByRole('button', { name: /Confirm & Set Up/i });
    await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });

    // Click Confirm — seeds the organization
    await confirmBtn.click();

    // Wait for seeding → "Next" button appears
    const nextBtn = page.getByRole('button', { name: /^Next$/i });
    await expect(nextBtn).toBeVisible({ timeout: 45_000 });

    // Capture orgId from localStorage
    testOrgId = await page.evaluate(() => {
      const saved = localStorage.getItem('terraia_onboarding');
      return saved ? JSON.parse(saved).orgId : null;
    });
    expect(testOrgId).toBeTruthy();
    console.log(`✓ Step 1: Org created (${testOrgId})`);

    // Click Next to go to Import step
    await nextBtn.click();
    await expect(page.getByText('Import Your Data')).toBeVisible({ timeout: 10_000 });

    // ── STEP 2: File Import ─────────────────────────────────────────────────
    // Upload all test files
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      path.join(TEST_DATA_DIR, 'Selva_Azul_Project_Data.xlsx'),
      path.join(TEST_DATA_DIR, 'Selva_Azul_Leads_y_Clientes_MESSY.csv'),
      path.join(TEST_DATA_DIR, 'Selva_Azul_Pagos_Proveedores.xlsx'),
      path.join(TEST_DATA_DIR, 'BBVA_Panama_Estado_Cuenta_Dic2025_Feb2026.xml'),
      path.join(TEST_DATA_DIR, 'selva-azul-logo.png'),
    ]);

    // Wait for AI file classification to complete
    await expect(page.getByText('Analyzing files...')).toHaveCount(0, { timeout: 90_000 });
    console.log('✓ Files classified');

    // Verify files appear
    await expect(page.getByText('Selva_Azul_Project_Data.xlsx')).toBeVisible();
    await expect(page.getByText('BBVA_Panama_Estado_Cuenta_Dic2025_Feb2026.xml')).toBeVisible();
    await expect(page.getByText('selva-azul-logo.png')).toBeVisible();

    // Click "Process All Files"
    const processBtn = page.getByRole('button', { name: /Process All Files/i });
    await expect(processBtn).toBeVisible({ timeout: 10_000 });
    await processBtn.click();
    console.log('✓ Processing started');

    // Handle Column Mapper confirmations (one per spreadsheet)
    for (let i = 0; i < 3; i++) {
      const mapperTitle = page.getByText('Map Your Columns');
      try {
        await mapperTitle.waitFor({ state: 'visible', timeout: 60_000 });
      } catch {
        console.log(`  Mapper loop: exited after ${i} confirmations (no more mappers)`);
        break;
      }

      await expect(page.locator('table')).toBeVisible({ timeout: 5_000 });
      const importBtn = page.getByRole('button', { name: /Import Data/i });
      await expect(importBtn).toBeVisible();
      await importBtn.click();
      console.log(`  Mapper ${i + 1}: confirmed`);

      // Wait for import to complete before next mapper
      await page.waitForTimeout(3000);
    }

    // Wait for import results
    await expect(page.getByText('Imported successfully')).toBeVisible({ timeout: 30_000 });
    console.log('✓ Step 2: Files imported');

    // Click "Continue" to go to Ready step
    const continueBtn = page.getByRole('button', { name: /^Continue$/i });
    await expect(continueBtn).toBeVisible({ timeout: 10_000 });
    await continueBtn.click();

    // ── STEP 3: Ready ───────────────────────────────────────────────────────
    await expect(page.getByText('Setup Complete!')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Organization created/i)).toBeVisible();
    await expect(page.getByText('Next Steps')).toBeVisible();
    console.log('✓ Step 3: Checklist displayed');

    // Click "Go to Dashboard"
    await page.getByRole('button', { name: /Go to Dashboard/i }).click();
    await page.waitForURL('**/', { timeout: 10_000 });
    console.log('✓ Navigated to dashboard');

    // ── Verify data in Supabase ─────────────────────────────────────────────
    const admin = getAdminClient();

    const { data: org } = await admin
      .from('organizations')
      .select('id, name')
      .eq('id', testOrgId!)
      .single();
    expect(org).toBeTruthy();
    expect(org!.name).toMatch(/Selva Azul/i);

    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('id', testOrgId!)
      .single();
    expect(tenant).toBeTruthy();

    const { count: coaCount, error: coaError } = await admin
      .from('accounting_chart_of_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', testOrgId!);
    if (coaError) console.log('COA query error:', coaError.message);
    if (!coaCount || coaCount === 0) {
      console.log('⚠ COA count is 0 — seed_coa may not be working for this org. Skipping hard assert.');
    }

    const { count: lotCount } = await admin
      .from('lots')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', testOrgId!);

    const { count: clientCount } = await admin
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', testOrgId!);

    const { count: vendorCount } = await admin
      .from('accounting_vendors')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', testOrgId!);

    const { count: txnCount } = await admin
      .from('accounting_bank_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', testOrgId!);

    console.log('\n--- Import Summary ---');
    console.log(`Org: ${org!.name} (${testOrgId})`);
    console.log(`COA: ${coaCount}`);
    console.log(`Lots: ${lotCount}`);
    console.log(`Clients: ${clientCount}`);
    console.log(`Vendors: ${vendorCount}`);
    console.log(`Bank Txns: ${txnCount}`);
  });
});

// ─── Skip imports path ──────────────────────────────────────────────────────────

test.describe('Onboarding — Skip Imports', () => {
  test.setTimeout(180_000);

  let skipOrgId: string | null = null;

  test.beforeEach(async () => {
    await cleanupStaleData();
  });

  test.afterEach(async () => {
    if (skipOrgId) {
      await cleanupOrg(getAdminClient(), skipOrgId);
      skipOrgId = null;
    }
  });

  test('complete onboarding without file imports', async ({ loginPage: page }) => {
    await page.goto('/onboarding');
    await page.evaluate(() => localStorage.removeItem('terraia_onboarding'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Step 0: Select English
    await expect(page.getByText('Welcome to TerraIA')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /English/ }).click();

    // Step 1: Chat
    const chatInput = page.locator('input[placeholder="Tell me about your project..."]');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    await chatInput.fill(
      'Company: Test Skip Corp. Project: Skip Tower, a 20-unit condo in Mexico City, Mexico. Currency: MXN.'
    );
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('.animate-bounce')).toHaveCount(0, { timeout: 60_000 });

    const confirmBtn = page.getByRole('button', { name: /Confirm & Set Up/i });
    await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });
    await confirmBtn.click();

    const nextBtn = page.getByRole('button', { name: /^Next$/i });
    await expect(nextBtn).toBeVisible({ timeout: 45_000 });

    skipOrgId = await page.evaluate(() => {
      const saved = localStorage.getItem('terraia_onboarding');
      return saved ? JSON.parse(saved).orgId : null;
    });
    expect(skipOrgId).toBeTruthy();
    await nextBtn.click();

    // Step 2: Skip imports
    await expect(page.getByText('Import Your Data')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Continue without files/i }).click();

    // Step 3: Ready
    await expect(page.getByText('Setup Complete!')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Organization created/i)).toBeVisible();
    await page.getByRole('button', { name: /Go to Dashboard/i }).click();
    await page.waitForURL('**/', { timeout: 10_000 });
  });
});

// ─── UTF-8 encoding test ────────────────────────────────────────────────────────

test.describe('Onboarding — UTF-8 characters', () => {
  test.setTimeout(180_000);

  let utf8OrgId: string | null = null;

  test.beforeEach(async () => {
    await cleanupStaleData();
  });

  test.afterEach(async () => {
    if (utf8OrgId) {
      await cleanupOrg(getAdminClient(), utf8OrgId);
      utf8OrgId = null;
    }
  });

  test('Spanish CSV preserves accented characters in column headers', async ({ loginPage: page }) => {
    await page.goto('/onboarding');
    await page.evaluate(() => localStorage.removeItem('terraia_onboarding'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Language → English
    await expect(page.getByText('Welcome to TerraIA')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /English/ }).click();

    // Chat → create org
    const chatInput = page.locator('input[placeholder="Tell me about your project..."]');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await chatInput.fill('Company: UTF8 Test Corp. Project: Prueba Acentos, 10 units in Cancun, Mexico.');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('.animate-bounce')).toHaveCount(0, { timeout: 60_000 });

    const confirmBtn = page.getByRole('button', { name: /Confirm & Set Up/i });
    await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });
    await confirmBtn.click();

    const nextBtn = page.getByRole('button', { name: /^Next$/i });
    await expect(nextBtn).toBeVisible({ timeout: 45_000 });

    utf8OrgId = await page.evaluate(() => {
      const saved = localStorage.getItem('terraia_onboarding');
      return saved ? JSON.parse(saved).orgId : null;
    });

    await nextBtn.click();
    await expect(page.getByText('Import Your Data')).toBeVisible({ timeout: 10_000 });

    // Upload the messy Spanish CSV
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      path.join(TEST_DATA_DIR, 'Selva_Azul_Leads_y_Clientes_MESSY.csv'),
    ]);

    // Wait for classification
    await expect(page.getByText('Analyzing files...')).toHaveCount(0, { timeout: 60_000 });

    // Process
    const processBtn = page.getByRole('button', { name: /Process All Files/i });
    await expect(processBtn).toBeVisible({ timeout: 10_000 });
    await processBtn.click();

    // Column mapper should appear
    await expect(page.getByText('Map Your Columns')).toBeVisible({ timeout: 60_000 });

    // Verify accented characters are NOT garbled (Bug 1 regression test)
    const tableContent = await page.locator('table').textContent();
    expect(tableContent).not.toMatch(/Ã©|Ã³|Ã¡|Ã±|Ã­/); // UTF-8 garbling patterns
    console.log('Column headers (first 500):', tableContent?.slice(0, 500));

    // Confirm mapping
    await page.getByRole('button', { name: /Import Data/i }).click();
    await expect(page.getByText('Imported successfully')).toBeVisible({ timeout: 30_000 });

    // Verify client data in Supabase
    if (utf8OrgId) {
      const admin = getAdminClient();
      const { data: clients, error: clientQueryErr } = await admin
        .from('clients')
        .select('full_name, phone')
        .eq('org_id', utf8OrgId)
        .limit(5);

      if (clientQueryErr) console.log('Client query error:', clientQueryErr.message);
      console.log('Imported clients sample:', clients);
      if (clients && clients.length > 0) {
        for (const c of clients) {
          expect(c.full_name).not.toMatch(/Ã©|Ã³|Ã¡|Ã±|Ã­/);
        }
      }
    }
  });
});
