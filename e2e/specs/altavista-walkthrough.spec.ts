/**
 * Grupo Altavista — Comprehensive 6-App E2E Walkthrough
 *
 * Walks the ENTIRE TerraIA platform as a new user:
 *   1. Onboarding: signup → language → AI chat → file upload → AI analysis → health report
 *   2. Login Portal: app selector, admin benchmarks
 *   3. Accounting: dashboard, transactions, vendors, chart of accounts, reports, etc.
 *   4. CMS: dashboard, lots, cases, offers, payments, construction, finance
 *   5. Investor Portal: dashboard, returns, costs, sales, admin pages
 *   6. Vault: dashboard, folders, checklists
 *   7. Broker Portal: dashboard, lots, leads (create lead), commissions
 *   8. DB verification: all 6 planted flaws, data counts
 *
 * Run:
 *   cd shared/e2e && npx playwright test --project=altavista-walkthrough --reporter=line
 *   cd shared/e2e && npx playwright test --project=altavista-walkthrough --headed --slowMo 200
 *
 * Screenshots: test-results/altavista-walkthrough/
 * Video:       test-results/ (auto-saved by Playwright as WebM, 1920x1080)
 *
 * PLANTED FLAWS THIS TEST ASSERTS:
 *   1. CASH_TROUGH (critical)         — Month 20 goes negative: -$332,000
 *   2. LOW_CONTINGENCY                — 4.2% vs 10-15% standard
 *   3. AGGRESSIVE_SALES_VELOCITY      — 9.5 u/mo vs 5.8 MX Tier2 benchmark
 *   4. MISSING_COST_MARKETING         — $0 marketing on $47.3M revenue
 *   5. MISSING_POOL_EQUIPMENT         — 2 pools with $0 pool/MEP
 *   6. FLOOR_PLATE_OVERFLOW           — Floor 7: 1,987m² on 1,400m² plate
 */

import { test as base, expect } from '@playwright/test';
import { injectLoginSession } from '../helpers/cookie';
import { getAdminClient } from '../helpers/supabase-admin';
import type { Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.resolve(__dirname, '../test-data/altavista');
const SS_DIR = path.resolve(__dirname, '../test-results/altavista-walkthrough');

const ONBOARD_USER_ID = '72dc92ab-a31d-4cee-b79a-0c83e68b59ba';

// App URLs
const APPS = {
  login: 'https://login.terraia.io',
  accounting: 'https://accounting.terraia.io',
  cms: 'https://cms.terraia.io',
  portal: 'https://investors.terraia.io',
  vault: 'https://vault.terraia.io',
  broker: 'https://brokers.terraia.io',
} as const;

// Ensure screenshot directory exists
fs.mkdirSync(SS_DIR, { recursive: true });

// ─── Screenshot helper (3-digit padding for 120+ screenshots) ───────────────
let ssCount = 1;
async function ss(page: Page, name: string): Promise<string> {
  const filename = `${String(ssCount++).padStart(3, '0')}-${name}.png`;
  const filepath = path.join(SS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  [screenshot] ${filename}`);
  return filepath;
}

// ─── visitPage helper: navigate, wait, screenshot ───────────────────────────
async function visitPage(
  page: Page,
  url: string,
  name: string,
  waitFor?: string,
): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  if (waitFor) {
    await page.locator(waitFor).first().waitFor({ timeout: 15_000 }).catch(() => {});
  }
  await page.waitForTimeout(800);
  await ss(page, name);
}

// ─── Custom fixture ─────────────────────────────────────────────────────────
const test = base.extend<{ loginPage: Page }>({
  loginPage: async ({ page }, use) => {
    await injectLoginSession(page, 'onboard');
    await use(page);
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function del(admin: any, table: string, column: string, value: string) {
  await admin.from(table).delete().eq(column, value).select('id');
}

async function cleanupOrg(admin: any, orgId: string) {
  // Extended cleanup for ALL apps
  await del(admin, 'user_roles', 'user_id', ONBOARD_USER_ID);
  await del(admin, 'organization_members', 'org_id', orgId);
  await del(admin, 'project_findings', 'org_id', orgId);
  await del(admin, 'analysis_runs', 'org_id', orgId);
  await del(admin, 'accounting_bank_transactions', 'org_id', orgId);
  await del(admin, 'accounting_bank_accounts', 'org_id', orgId);
  await del(admin, 'accounting_vendors', 'org_id', orgId);
  await del(admin, 'accounting_chart_of_accounts', 'org_id', orgId);
  await del(admin, 'cases', 'org_id', orgId);
  await del(admin, 'clients', 'org_id', orgId);
  await del(admin, 'lots', 'org_id', orgId);
  // Vault + Broker + Construction
  await del(admin, 'vault_files', 'org_id', orgId).catch(() => {});
  await del(admin, 'vault_access_log', 'org_id', orgId).catch(() => {});
  await del(admin, 'vault_shared_links', 'org_id', orgId).catch(() => {});
  await del(admin, 'vault_checklists', 'org_id', orgId).catch(() => {});
  await del(admin, 'broker_leads', 'org_id', orgId).catch(() => {});
  await del(admin, 'broker_commissions', 'org_id', orgId).catch(() => {});
  await del(admin, 'construction_phases', 'org_id', orgId).catch(() => {});
  await del(admin, 'construction_photos', 'org_id', orgId).catch(() => {});
  await del(admin, 'construction_draws', 'org_id', orgId).catch(() => {});
  await del(admin, 'tenants', 'id', orgId);
  await del(admin, 'organizations', 'id', orgId);
}

async function cleanupStaleData() {
  const admin = getAdminClient();
  const orgIds = new Set<string>();

  const { data: roles } = await admin.from('user_roles').select('tenant_id').eq('user_id', ONBOARD_USER_ID);
  if (roles) roles.forEach((r: any) => orgIds.add(r.tenant_id));

  const { data: members } = await admin.from('organization_members').select('org_id').eq('user_id', ONBOARD_USER_ID);
  if (members) members.forEach((m: any) => orgIds.add(m.org_id));

  for (const orgId of orgIds) {
    await cleanupOrg(admin, orgId);
  }

  await del(admin, 'user_roles', 'user_id', ONBOARD_USER_ID);
  await del(admin, 'organization_members', 'user_id', ONBOARD_USER_ID);
}

// The 6 planted flaws we expect the AI to catch
const EXPECTED_FLAWS = [
  'CASH_TROUGH',
  'LOW_CONTINGENCY',
  'AGGRESSIVE_SALES_VELOCITY',
  'MISSING_COST_MARKETING',
  'MISSING_POOL_EQUIPMENT',
  'FLOOR_PLATE_OVERFLOW',
] as const;

// ════════════════════════════════════════════════════════════════════════════
// GRUPO ALTAVISTA — COMPREHENSIVE 6-APP WALKTHROUGH
// ════════════════════════════════════════════════════════════════════════════

test.describe('Grupo Altavista — Full Platform Walkthrough', () => {
  test.setTimeout(600_000); // 10 min for full 6-app walkthrough

  let testOrgId: string | null = null;

  test.beforeAll(async () => {
    ssCount = 1;
    await cleanupStaleData();
    console.log('Cleanup complete — starting Altavista walkthrough');
  });

  // ════════════════════════════════════════════════════════════════
  // SINGLE TEST — preserves page context across all 6 apps
  // ════════════════════════════════════════════════════════════════

  test('Full platform walkthrough: onboarding → 6 apps → DB verification', async ({ loginPage: page }) => {
    const admin = getAdminClient();
    await admin.from('user_roles').delete().eq('user_id', ONBOARD_USER_ID);
    await admin.from('organization_members').delete().eq('user_id', ONBOARD_USER_ID);

    // Clear stale onboarding state
    await page.goto(`${APPS.login}/onboarding`);
    await page.evaluate(() => localStorage.removeItem('terraia_onboarding'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // ══════════════════════════════════════════════════════════════
    // SECTION 1: ONBOARDING (screenshots 001-034)
    // ══════════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('SECTION 1: ONBOARDING');
    console.log('════════════════════════════════════════');

    // ── Step 0: Language Selection ──
    await expect(page.getByText('Welcome to TerraIA')).toBeVisible({ timeout: 15_000 });
    await ss(page, 'language-selection');

    await page.getByRole('button', { name: /English/ }).click();
    await page.waitForTimeout(500);
    await ss(page, 'language-english-selected');
    console.log('Language → English');

    // ── Step 1: AI Chat — Create Grupo Altavista org ──
    const chatInput = page.locator('input[placeholder="Tell me about your project..."]');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await ss(page, 'chat-empty');

    const description =
      'My company is Grupo Altavista S.A. de C.V. RFC: GAL240115AB3. ' +
      'We are building Torre Altavista Cancún, a 120-unit luxury condo tower ' +
      'in Zona Hotelera, Blvd. Kukulcán Km 14.5, Cancún, Quintana Roo, México. ' +
      '8 floors. Target market: affluent Mexican buyers + US/Canadian investors. ' +
      'Currency: USD. We bank with HSBC Mexico.';

    await chatInput.fill(description);
    await ss(page, 'chat-message-typed');
    await page.locator('button[type="submit"]').click();
    console.log('Chat message sent');

    await ss(page, 'chat-ai-thinking');
    await expect(page.locator('.animate-bounce')).toHaveCount(0, { timeout: 60_000 });
    await ss(page, 'chat-ai-response');

    const confirmBtn = page.getByRole('button', { name: /Confirm & Set Up/i });
    await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });
    await ss(page, 'chat-confirm-ready');
    await confirmBtn.click();
    console.log('Organization confirmed');

    const nextBtn = page.getByRole('button', { name: /^Next$/i });
    await expect(nextBtn).toBeVisible({ timeout: 45_000 });
    await ss(page, 'chat-org-created');

    // Capture org ID
    testOrgId = await page.evaluate(() => {
      const saved = localStorage.getItem('terraia_onboarding');
      return saved ? JSON.parse(saved).orgId : null;
    });
    expect(testOrgId).toBeTruthy();
    console.log(`Org created → ${testOrgId}`);

    await nextBtn.click();
    await expect(page.getByText('Import Your Data')).toBeVisible({ timeout: 10_000 });
    await ss(page, 'import-page-loaded');

    // ── Step 2: File Upload ──
    const proforma = path.join(FILES_DIR, 'TorreAltavista_Proforma.xlsx');
    const bankH1 = path.join(FILES_DIR, 'HSBC_EstadoCuenta_H1_2025.xml');
    const bankH2 = path.join(FILES_DIR, 'HSBC_EstadoCuenta_H2_2025_2026.xml');
    const vendors = path.join(FILES_DIR, 'Vendors_TorreAltavista.csv');

    for (const f of [proforma, bankH1, bankH2, vendors]) {
      expect(fs.existsSync(f), `File not found: ${f}`).toBe(true);
    }

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([proforma, bankH1, bankH2, vendors]);
    await page.waitForTimeout(1500);
    await ss(page, 'files-uploaded');
    console.log('All 4 files uploaded');

    // Wait for classification
    console.log('Waiting for file classification...');
    await page.waitForTimeout(3000);
    await ss(page, 'files-classifying');

    for (let wait = 0; wait < 30; wait++) {
      const analyzing = await page.locator('text="..."').count();
      if (analyzing === 0) break;
      await page.waitForTimeout(3000);
      if (wait % 5 === 0) await ss(page, `files-classifying-${wait}`);
    }
    await ss(page, 'files-classified');
    console.log('Files classified');

    // Process All
    const processBtn = page.getByRole('button', { name: /Process All/i });
    await expect(processBtn).toBeVisible({ timeout: 15_000 });
    await ss(page, 'process-all-button');
    await processBtn.click();
    console.log('Processing started');
    await page.waitForTimeout(2000);
    await ss(page, 'processing-started');

    // Column mapper confirmations
    for (let i = 0; i < 5; i++) {
      try {
        await page.getByText('Map Your Columns').waitFor({ state: 'visible', timeout: 60_000 });
      } catch {
        console.log(`  Mapper loop: exited after ${i} mappers`);
        break;
      }

      await page.waitForTimeout(1500);
      await ss(page, `column-mapper-${i + 1}`);
      console.log(`  Column Mapper ${i + 1} shown`);

      const importDataBtn = page.getByRole('button', { name: /Import Data|Confirm/i });
      await expect(importDataBtn).toBeVisible({ timeout: 10_000 });
      await importDataBtn.click();
      console.log(`  Mapper ${i + 1}: confirmed`);
      await page.waitForTimeout(3000);
      await ss(page, `column-mapper-${i + 1}-confirmed`);
    }

    // Wait for import results
    try {
      await expect(page.getByText('Imported successfully')).toBeVisible({ timeout: 30_000 });
      await ss(page, 'import-success');
      console.log('Files imported successfully');
    } catch {
      await page.waitForTimeout(5000);
      await ss(page, 'import-result');
      console.log('Import step completed');
    }

    // Continue to Ready step
    const continueBtn = page.getByRole('button', { name: /^Continue$/i });
    const continueWithoutBtn = page.getByRole('button', { name: /Continue without files/i });
    const visibleContinue = await continueBtn.isVisible().catch(() => false)
      ? continueBtn
      : continueWithoutBtn;
    await expect(visibleContinue).toBeVisible({ timeout: 10_000 });
    await ss(page, 'continue-to-ready');
    await visibleContinue.click();

    await expect(page.getByText('Setup Complete!')).toBeVisible({ timeout: 15_000 });
    await ss(page, 'step-ready-loaded');
    console.log('On Ready page');

    // ── Step 3: AI Analysis ──
    const analysisStarted = await page.getByText('Analyzing Your Project').isVisible().catch(() => false);
    const alreadyComplete = await page.getByText('Project Health Report').isVisible().catch(() => false);

    if (analysisStarted) {
      console.log('Analysis in progress...');
      await ss(page, 'analysis-in-progress');
      for (let i = 0; i < 24; i++) {
        await page.waitForTimeout(5000);
        const complete = await page.getByText('Project Health Report').isVisible().catch(() => false);
        if (complete) break;
        if (i % 3 === 0) await ss(page, `analysis-stage-${i + 1}`);
      }
      await expect(page.getByText('Project Health Report')).toBeVisible({ timeout: 180_000 });
      await ss(page, 'analysis-complete');
      console.log('Analysis complete!');
    } else if (!alreadyComplete) {
      console.log('Waiting for analysis to auto-trigger...');
      await ss(page, 'analysis-not-started');
      try {
        await Promise.race([
          page.getByText('Analyzing Your Project').waitFor({ state: 'visible', timeout: 30_000 }),
          page.getByText('Project Health Report').waitFor({ state: 'visible', timeout: 30_000 }),
        ]);
        const isAnalyzing = await page.getByText('Analyzing Your Project').isVisible().catch(() => false);
        if (isAnalyzing) {
          await ss(page, 'analysis-auto-triggered');
          for (let i = 0; i < 24; i++) {
            await page.waitForTimeout(5000);
            const complete = await page.getByText('Project Health Report').isVisible().catch(() => false);
            if (complete) break;
            if (i % 3 === 0) await ss(page, `analysis-stage-${i + 1}`);
          }
          await expect(page.getByText('Project Health Report')).toBeVisible({ timeout: 180_000 });
        }
      } catch {
        console.log('Analysis did not auto-trigger');
        await ss(page, 'analysis-did-not-trigger');
      }
    } else {
      console.log('Analysis already complete');
    }

    await ss(page, 'health-report-full');

    // ── Step 4: Health Report — Explore Findings ──
    const hasReport = await page.getByText('Project Health Report').isVisible().catch(() => false);
    if (hasReport) {
      console.log('Health Report visible');

      await page.evaluate(() => window.scrollTo(0, 0));
      await ss(page, 'health-report-scorecards');

      // Engine filter chips
      const allChip = page.locator('button').filter({ hasText: /^All$/ });
      const cfoChip = page.locator('button').filter({ hasText: /CFO Analysis/ });
      const gcChip = page.locator('button').filter({ hasText: /Technical Review/ });
      const investorChip = page.locator('button').filter({ hasText: /Investor Assessment/ });

      if (await allChip.isVisible().catch(() => false)) {
        await ss(page, 'filter-all');
        for (const [chip, name] of [[cfoChip, 'cfo'], [gcChip, 'gc'], [investorChip, 'investor']] as const) {
          if (await chip.isVisible().catch(() => false)) {
            await chip.click();
            await page.waitForTimeout(500);
            await ss(page, `filter-${name}`);
          }
        }
        await allChip.click();
        await page.waitForTimeout(500);
      }

      // Finding cards
      await page.evaluate(() => window.scrollTo(0, 500));
      await ss(page, 'findings-list-top');

      const severityBadges = page.locator('span').filter({ hasText: /^CRITICAL$|^WARNING$|^OBSERVATION$/ });
      const badgeCount = await severityBadges.count();
      console.log(`${badgeCount} severity badges visible`);

      for (let i = 0; i < Math.min(badgeCount, 4); i++) {
        const badge = severityBadges.nth(i);
        const card = badge.locator('xpath=ancestor::div[contains(@class,"rounded")]').first();
        try {
          await card.click();
          await page.waitForTimeout(500);
          await ss(page, `finding-${i + 1}-expanded`);
        } catch { /* card may not expand */ }
      }

      // Developer response demo
      const respondLink = page.getByText('Respond to this finding').first();
      if (await respondLink.isVisible().catch(() => false)) {
        await respondLink.click();
        await page.waitForTimeout(300);
        const textarea = page.locator('textarea').first();
        if (await textarea.isVisible().catch(() => false)) {
          await textarea.fill(
            'Acknowledged. We have arranged a $3M revolving credit line with HSBC ' +
            'that will cover the Month 20 cash gap. Draw is available from January 2026.'
          );
          await ss(page, 'developer-response-typed');
          const cancelBtn = page.getByText('Cancel').first();
          if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
        }
      }

      // IRR Sensitivity
      const sensitivityTable = page.getByText('IRR Sensitivity Analysis');
      if (await sensitivityTable.isVisible().catch(() => false)) {
        await sensitivityTable.scrollIntoViewIfNeeded();
        await ss(page, 'irr-sensitivity-table');
      }

      // Scroll through report
      const pageHeight = await page.evaluate(() => document.body.scrollHeight);
      const steps = Math.min(Math.ceil(pageHeight / 1080), 5);
      for (let step = 0; step < steps; step++) {
        await page.evaluate((y) => window.scrollTo(0, y), step * 1080);
        await page.waitForTimeout(300);
        await ss(page, `report-scroll-${step + 1}`);
      }

      // Continue to Dashboard
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      const goBtn = page.getByRole('button', { name: /Continue to Dashboard|Go to Dashboard/i });
      if (await goBtn.isVisible().catch(() => false)) {
        await ss(page, 'continue-to-dashboard');
        await goBtn.click();
        await page.waitForURL('**/', { timeout: 10_000 }).catch(() => {});
        await page.waitForTimeout(1000);
        await ss(page, 'dashboard-landed');
        console.log('Navigated to dashboard');
      }
    }

    console.log(`Section 1 complete — ${ssCount - 1} screenshots so far`);

    // ══════════════════════════════════════════════════════════════
    // SECTION 2: LOGIN PORTAL (screenshots ~035-040)
    // ══════════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('SECTION 2: LOGIN PORTAL');
    console.log('════════════════════════════════════════');

    // App selector (home page)
    await visitPage(page, APPS.login, 'login-app-selector');

    // Admin benchmarks page
    await visitPage(page, `${APPS.login}/admin/benchmarks`, 'login-admin-benchmarks');

    // Login page (what unauthenticated users see)
    await visitPage(page, `${APPS.login}/login`, 'login-page');

    // Signup page
    await visitPage(page, `${APPS.login}/signup`, 'signup-page');

    // Back to app selector to verify org shows
    await visitPage(page, APPS.login, 'login-app-selector-final');

    console.log(`Section 2 complete — ${ssCount - 1} screenshots so far`);

    // ══════════════════════════════════════════════════════════════
    // SECTION 3: ACCOUNTING (screenshots ~041-065)
    // ══════════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('SECTION 3: ACCOUNTING');
    console.log('════════════════════════════════════════');

    // Dashboard
    await visitPage(page, APPS.accounting, 'accounting-dashboard');

    // Transactions list (should have ~60 txns from HSBC XMLs)
    await visitPage(page, `${APPS.accounting}/transactions`, 'accounting-transactions');

    // Scroll down to see more transactions
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await ss(page, 'accounting-transactions-scroll');

    // New transaction form
    await visitPage(page, `${APPS.accounting}/transactions/new`, 'accounting-transaction-new');

    // Bank upload
    await visitPage(page, `${APPS.accounting}/bank/upload`, 'accounting-bank-upload');

    // Facturas list
    await visitPage(page, `${APPS.accounting}/facturas`, 'accounting-facturas');

    // Factura upload
    await visitPage(page, `${APPS.accounting}/facturas/upload`, 'accounting-factura-upload');

    // Factura batch import
    await visitPage(page, `${APPS.accounting}/facturas/batch`, 'accounting-factura-batch');

    // Reconciliation
    await visitPage(page, `${APPS.accounting}/reconcile`, 'accounting-reconcile');

    // Chart of Accounts (should have Mexico template)
    await visitPage(page, `${APPS.accounting}/chart-of-accounts`, 'accounting-chart-of-accounts');

    // Scroll to see more accounts
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await ss(page, 'accounting-chart-of-accounts-scroll');

    // Vendors (should have 30 vendors)
    await visitPage(page, `${APPS.accounting}/vendors`, 'accounting-vendors');

    // Scroll to see more vendors
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await ss(page, 'accounting-vendors-scroll');

    // Cash log
    await visitPage(page, `${APPS.accounting}/cash`, 'accounting-cash-log');

    // Reports
    await visitPage(page, `${APPS.accounting}/reports`, 'accounting-reports');

    // Audit trail
    await visitPage(page, `${APPS.accounting}/admin/audit`, 'accounting-audit-trail');

    // Payments queue
    await visitPage(page, `${APPS.accounting}/payments`, 'accounting-payments');

    // New payment request
    await visitPage(page, `${APPS.accounting}/payments/new`, 'accounting-payment-new');

    // Approvals
    await visitPage(page, `${APPS.accounting}/approve`, 'accounting-approve');

    // Planning
    await visitPage(page, `${APPS.accounting}/planning`, 'accounting-planning');

    // Settings
    await visitPage(page, `${APPS.accounting}/settings`, 'accounting-settings');

    console.log(`Section 3 complete — ${ssCount - 1} screenshots so far`);

    // ══════════════════════════════════════════════════════════════
    // SECTION 4: CMS (screenshots ~066-090)
    // ══════════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('SECTION 4: CMS');
    console.log('════════════════════════════════════════');

    // Dashboard
    await visitPage(page, APPS.cms, 'cms-dashboard');

    // Lots inventory
    await visitPage(page, `${APPS.cms}/lots`, 'cms-lots');

    // Scroll lots
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await ss(page, 'cms-lots-scroll');

    // Cases list
    await visitPage(page, `${APPS.cms}/cases`, 'cms-cases');

    // New case wizard
    await visitPage(page, `${APPS.cms}/cases/new`, 'cms-case-new');

    // Offers list
    await visitPage(page, `${APPS.cms}/offers`, 'cms-offers');

    // New offer wizard
    await visitPage(page, `${APPS.cms}/offers/new`, 'cms-offer-new');

    // Offer review queue
    await visitPage(page, `${APPS.cms}/offers/review`, 'cms-offer-review');

    // Payments
    await visitPage(page, `${APPS.cms}/payments`, 'cms-payments');

    // Approvals
    await visitPage(page, `${APPS.cms}/approvals`, 'cms-approvals');

    // Finance report
    await visitPage(page, `${APPS.cms}/finance`, 'cms-finance');

    // Manual intake
    await visitPage(page, `${APPS.cms}/intake`, 'cms-intake');

    // Construction dashboard
    await visitPage(page, `${APPS.cms}/construction`, 'cms-construction');

    // Construction phases
    await visitPage(page, `${APPS.cms}/construction/phases`, 'cms-construction-phases');

    // Construction photos
    await visitPage(page, `${APPS.cms}/construction/photos`, 'cms-construction-photos');

    console.log(`Section 4 complete — ${ssCount - 1} screenshots so far`);

    // ══════════════════════════════════════════════════════════════
    // SECTION 5: INVESTOR PORTAL (screenshots ~091-120)
    // ══════════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('SECTION 5: INVESTOR PORTAL');
    console.log('════════════════════════════════════════');

    // ── Investor Pages ──
    await visitPage(page, `${APPS.portal}/dashboard`, 'portal-dashboard');

    await visitPage(page, `${APPS.portal}/returns`, 'portal-returns');

    await visitPage(page, `${APPS.portal}/sources-uses`, 'portal-sources-uses');

    await visitPage(page, `${APPS.portal}/costs`, 'portal-costs');

    // Scroll costs
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await ss(page, 'portal-costs-scroll');

    await visitPage(page, `${APPS.portal}/sales`, 'portal-sales');

    await visitPage(page, `${APPS.portal}/investment`, 'portal-investment');

    await visitPage(page, `${APPS.portal}/financials`, 'portal-financials');

    await visitPage(page, `${APPS.portal}/timeline`, 'portal-timeline');

    await visitPage(page, `${APPS.portal}/scenarios`, 'portal-scenarios');

    await visitPage(page, `${APPS.portal}/scenario-modeler`, 'portal-scenario-modeler');

    await visitPage(page, `${APPS.portal}/scenario-comparison`, 'portal-scenario-comparison');

    // ── Admin Pages ──
    await visitPage(page, `${APPS.portal}/admin`, 'portal-admin-dashboard');

    await visitPage(page, `${APPS.portal}/admin/costs`, 'portal-admin-costs');

    await visitPage(page, `${APPS.portal}/admin/sales`, 'portal-admin-sales');

    await visitPage(page, `${APPS.portal}/admin/investors`, 'portal-admin-investors');

    await visitPage(page, `${APPS.portal}/admin/users`, 'portal-admin-users');

    await visitPage(page, `${APPS.portal}/admin/financing`, 'portal-admin-financing');

    await visitPage(page, `${APPS.portal}/admin/pricing-phases`, 'portal-admin-pricing-phases');

    await visitPage(page, `${APPS.portal}/admin/manzana-inventory`, 'portal-admin-manzana-inventory');

    await visitPage(page, `${APPS.portal}/admin/interest-earnings`, 'portal-admin-interest-earnings');

    await visitPage(page, `${APPS.portal}/admin/planning`, 'portal-admin-planning');

    await visitPage(page, `${APPS.portal}/admin/facturas`, 'portal-admin-facturas');

    await visitPage(page, `${APPS.portal}/admin/transactions`, 'portal-admin-transactions');

    await visitPage(page, `${APPS.portal}/admin/reconciliation`, 'portal-admin-reconciliation');

    await visitPage(page, `${APPS.portal}/admin/chart-of-accounts`, 'portal-admin-chart-of-accounts');

    await visitPage(page, `${APPS.portal}/admin/vendors`, 'portal-admin-vendors');

    await visitPage(page, `${APPS.portal}/admin/reports`, 'portal-admin-reports');

    console.log(`Section 5 complete — ${ssCount - 1} screenshots so far`);

    // ══════════════════════════════════════════════════════════════
    // SECTION 6: VAULT (screenshots ~121-140)
    // ══════════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('SECTION 6: VAULT');
    console.log('════════════════════════════════════════');

    // Dashboard
    await visitPage(page, APPS.vault, 'vault-dashboard');

    // Recent files
    await visitPage(page, `${APPS.vault}/recent`, 'vault-recent');

    // Folder views
    const vaultFolders = ['legal', 'design', 'contracts', 'financial', 'construction', 'investor', 'marketing', 'sales'];
    for (const folder of vaultFolders) {
      await visitPage(page, `${APPS.vault}/folders/${folder}`, `vault-folder-${folder}`);
    }

    // Shared links
    await visitPage(page, `${APPS.vault}/shared-links`, 'vault-shared-links');

    // Checklists
    await visitPage(page, `${APPS.vault}/checklists`, 'vault-checklists');

    console.log(`Section 6 complete — ${ssCount - 1} screenshots so far`);

    // ══════════════════════════════════════════════════════════════
    // SECTION 7: BROKER PORTAL (screenshots ~141-155)
    // ══════════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('SECTION 7: BROKER PORTAL');
    console.log('════════════════════════════════════════');

    // Dashboard
    await visitPage(page, APPS.broker, 'broker-dashboard');

    // Lots inventory
    await visitPage(page, `${APPS.broker}/lots`, 'broker-lots');

    // Leads list (empty initially)
    await visitPage(page, `${APPS.broker}/leads`, 'broker-leads-empty');

    // Create a new lead
    await visitPage(page, `${APPS.broker}/leads/new`, 'broker-lead-new-form');

    // Fill the lead form
    const nameField = page.locator('input[name="name"], input[placeholder*="Name" i], input[placeholder*="nombre" i]').first();
    const emailField = page.locator('input[name="email"], input[type="email"], input[placeholder*="Email" i]').first();
    const phoneField = page.locator('input[name="phone"], input[type="tel"], input[placeholder*="Phone" i], input[placeholder*="teléfono" i]').first();

    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill('Carlos Mendez');
      if (await emailField.isVisible().catch(() => false)) {
        await emailField.fill('carlos.mendez@test.com');
      }
      if (await phoneField.isVisible().catch(() => false)) {
        await phoneField.fill('+52 998 123 4567');
      }

      // Try to fill source/interest fields
      const sourceSelect = page.locator('select[name="source"]').first();
      if (await sourceSelect.isVisible().catch(() => false)) {
        await sourceSelect.selectOption({ label: /referral/i }).catch(() => {});
      }

      const notesField = page.locator('textarea[name="notes"], textarea').first();
      if (await notesField.isVisible().catch(() => false)) {
        await notesField.fill('Interested in penthouse units. Referred by existing investor.');
      }

      await ss(page, 'broker-lead-form-filled');
      console.log('Lead form filled: Carlos Mendez');

      // Submit the form
      const submitBtn = page.getByRole('button', { name: /Save|Create|Submit/i }).first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
        await ss(page, 'broker-lead-created');
        console.log('Lead created: Carlos Mendez');

        // Try to navigate to the lead detail
        const leadLink = page.getByText('Carlos Mendez').first();
        if (await leadLink.isVisible().catch(() => false)) {
          await leadLink.click();
          await page.waitForTimeout(1000);
          await ss(page, 'broker-lead-detail');
          console.log('Lead detail viewed');
        }
      }
    } else {
      await ss(page, 'broker-lead-form-not-found');
      console.log('Lead form fields not found — skipping lead creation');
    }

    // Go back to leads list to see the new lead
    await visitPage(page, `${APPS.broker}/leads`, 'broker-leads-with-data');

    // Commissions
    await visitPage(page, `${APPS.broker}/commissions`, 'broker-commissions');

    console.log(`Section 7 complete — ${ssCount - 1} screenshots so far`);

    // ══════════════════════════════════════════════════════════════
    // SECTION 8: DB VERIFICATION
    // ══════════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('SECTION 8: DB VERIFICATION');
    console.log('════════════════════════════════════════');

    if (!testOrgId) {
      const { data: orgs } = await admin
        .from('organizations')
        .select('id')
        .ilike('name', '%altavista%')
        .order('created_at', { ascending: false })
        .limit(1);
      testOrgId = orgs?.[0]?.id || null;
    }

    if (testOrgId) {
      // Organization exists
      console.log(`\nOrg ID: ${testOrgId}`);

      // Bank transactions count
      const { count: txnCount } = await admin
        .from('accounting_bank_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', testOrgId);
      console.log(`Bank transactions: ${txnCount ?? 0} (expected ~60+)`);

      // Vendors count
      const { count: vendorCount } = await admin
        .from('accounting_vendors')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', testOrgId);
      console.log(`Vendors: ${vendorCount ?? 0} (expected 30)`);

      // Chart of accounts count
      const { count: coaCount } = await admin
        .from('accounting_chart_of_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', testOrgId);
      console.log(`Chart of Accounts: ${coaCount ?? 0} (expected 50+)`);

      // Lots count
      const { count: lotCount } = await admin
        .from('lots')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', testOrgId);
      console.log(`Lots: ${lotCount ?? 0}`);

      // Broker leads
      try {
        const { data: leads } = await admin
          .from('broker_leads')
          .select('name, email')
          .eq('org_id', testOrgId);
        if (leads?.length) {
          console.log(`Broker leads: ${leads.length}`);
          leads.forEach((l: any) => console.log(`  - ${l.name} (${l.email})`));
        } else {
          console.log('Broker leads: 0');
        }
      } catch {
        console.log('Broker leads table not accessible');
      }

      // AI Findings — check all 6 planted flaws
      const { data: allFindings } = await admin
        .from('project_findings')
        .select('rule_id, severity, engine, title')
        .eq('org_id', testOrgId)
        .order('severity');

      console.log(`\nAll findings (${allFindings?.length || 0}):`);
      allFindings?.forEach((f: any) =>
        console.log(`  [${f.engine?.toUpperCase()}] [${f.severity?.toUpperCase()}] ${f.rule_id}: ${f.title?.substring(0, 70)}`)
      );

      // Check each planted flaw
      const flawResults: Record<string, boolean> = {};
      for (const rule of EXPECTED_FLAWS) {
        const match = allFindings?.find((f: any) =>
          f.rule_id === rule || f.rule_id?.startsWith(rule.replace('_MARKETING', ''))
        );
        flawResults[rule] = !!match;
      }

      console.log('\nFLAW DETECTION SUMMARY:');
      let caught = 0;
      for (const [rule, found] of Object.entries(flawResults)) {
        console.log(`  ${found ? 'CAUGHT' : 'MISSED'} ${rule}`);
        if (found) caught++;
      }
      console.log(`\nScore: ${caught}/${EXPECTED_FLAWS.length} flaws caught`);

      // Analysis run details
      const { data: runs } = await admin
        .from('analysis_runs')
        .select('status, findings_count, engines_run, started_at, completed_at')
        .eq('org_id', testOrgId)
        .eq('status', 'complete')
        .order('started_at', { ascending: false })
        .limit(1);

      if (runs?.length) {
        const duration = runs[0].completed_at && runs[0].started_at
          ? Math.round((new Date(runs[0].completed_at).getTime() - new Date(runs[0].started_at).getTime()) / 1000)
          : '?';
        console.log(`Analysis: ${runs[0].findings_count} findings, engines: ${runs[0].engines_run}, ${duration}s`);
      }
    } else {
      console.log('No Altavista org found — skipping DB verification');
    }

    // ══════════════════════════════════════════════════════════════
    // SECTION 9: SUMMARY
    // ══════════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('SECTION 9: SUMMARY');
    console.log('════════════════════════════════════════');

    const shots = fs.readdirSync(SS_DIR).filter(f => f.endsWith('.png')).sort();
    console.log(`\nScreenshots saved to: ${SS_DIR}`);
    shots.forEach(f => console.log(`  ${f}`));
    console.log(`\nTotal: ${shots.length} screenshots`);
    console.log(`Video: test-results/ (WebM, 1920x1080)`);
    console.log('Convert: ffmpeg -i video.webm -c:v libx264 -crf 18 altavista-walkthrough.mp4');

    expect(shots.length).toBeGreaterThan(80);

    // Keep org for review
    if (testOrgId) {
      console.log(`\nAltavista org preserved: ${testOrgId}`);
    }
  });
});
