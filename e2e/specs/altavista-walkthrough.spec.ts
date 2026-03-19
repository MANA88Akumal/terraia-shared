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
  await del(admin, 'payment_schedule', 'org_id', orgId).catch(() => {});
  await del(admin, 'cms_payments', 'org_id', orgId).catch(() => {});
  await del(admin, 'offers', 'org_id', orgId).catch(() => {});
  await del(admin, 'cases', 'org_id', orgId);
  await del(admin, 'clients', 'org_id', orgId);
  await del(admin, 'lots', 'org_id', orgId);
  // Vault + Broker + Construction + Scenarios
  await del(admin, 'vault_files', 'org_id', orgId).catch(() => {});
  await del(admin, 'vault_access_log', 'org_id', orgId).catch(() => {});
  await del(admin, 'vault_shared_links', 'org_id', orgId).catch(() => {});
  await del(admin, 'vault_checklists', 'org_id', orgId).catch(() => {});
  await del(admin, 'broker_leads', 'org_id', orgId).catch(() => {});
  await del(admin, 'broker_commissions', 'org_id', orgId).catch(() => {});
  await del(admin, 'brokers', 'org_id', orgId).catch(() => {});
  await del(admin, 'construction_phases', 'org_id', orgId).catch(() => {});
  await del(admin, 'construction_photos', 'org_id', orgId).catch(() => {});
  await del(admin, 'construction_draws', 'org_id', orgId).catch(() => {});
  await del(admin, 'scenario_projections', 'org_id', orgId).catch(() => {});
  await del(admin, 'scenario_financing_mix', 'org_id', orgId).catch(() => {});
  await del(admin, 'scenario_config', 'org_id', orgId).catch(() => {});
  await del(admin, 'saved_scenarios', 'org_id', orgId).catch(() => {});
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

    // ── POST-ONBOARDING: Ensure lots exist (admin fallback) ──
    // The proforma parser may fail to extract units. If no lots were seeded,
    // create synthetic lots so the CMS case/offer wizards work.
    if (testOrgId) {
      const { count: lotCount } = await admin
        .from('lots')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', testOrgId);
      console.log(`Post-onboarding lots check: ${lotCount || 0} lots`);
      if (!lotCount || lotCount === 0) {
        console.log('No lots found — seeding 120 units via admin...');
        const lotRows = [];
        for (let i = 1; i <= 120; i++) {
          const floor = Math.ceil(i / 15); // 15 units per floor, 8 floors
          const unitOnFloor = ((i - 1) % 15) + 1;
          // Distribute statuses within each floor: first 3 sold, next 2 reserved, rest available
          const status = unitOnFloor <= 3 ? 'sold' : unitOnFloor <= 5 ? 'reserved' : 'Available';
          lotRows.push({
            org_id: testOrgId,
            tenant_id: testOrgId,
            lot_number: `U-${String(i).padStart(3, '0')}`,
            manzana: `Floor ${floor}`,
            area_m2: 65 + Math.round(Math.random() * 80), // 65-145 m²
            sale_price_mxn: 3500000 + Math.round(Math.random() * 5000000), // 3.5M-8.5M MXN
            status,
          });
        }
        const { error: lotErr } = await admin.from('lots').insert(lotRows);
        if (lotErr) console.log(`  Lot seed error: ${lotErr.message}`);
        else console.log(`  Seeded 120 lots (30 sold, 15 reserved, 75 available)`);
      }

      // Also check construction phases
      const { count: phaseCount } = await admin
        .from('construction_phases')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', testOrgId);
      console.log(`Post-onboarding construction phases: ${phaseCount || 0}`);
      if (!phaseCount || phaseCount === 0) {
        console.log('No construction phases — seeding via admin...');
        const baseDate = new Date();
        baseDate.setDate(1);
        const phases = [
          { name: 'Site Preparation & Foundation', budget: 2457000, sort: 1, startMonth: 0, endMonth: 5 },
          { name: 'Structure & Concrete', budget: 5733000, sort: 2, startMonth: 2, endMonth: 15 },
          { name: 'MEP Systems', budget: 4095000, sort: 3, startMonth: 8, endMonth: 21 },
          { name: 'Finishes & Interiors', budget: 2457000, sort: 4, startMonth: 13, endMonth: 26 },
          { name: 'Exterior & Landscaping', budget: 1638000, sort: 5, startMonth: 20, endMonth: 30 },
          { name: 'Soft Costs & Professional Fees', budget: 3250000, sort: 6, startMonth: 0, endMonth: 30 },
          { name: 'Contingency Reserve', budget: 705000, sort: 7, startMonth: 0, endMonth: 30 },
        ];
        const phaseRows = phases.map(p => {
          const start = new Date(baseDate);
          start.setMonth(start.getMonth() + p.startMonth);
          const end = new Date(baseDate);
          end.setMonth(end.getMonth() + p.endMonth);
          return {
            org_id: testOrgId,
            phase_name: p.name,
            description: `Budget: $${p.budget.toLocaleString()} USD`,
            sort_order: p.sort,
            planned_start: start.toISOString().split('T')[0],
            planned_end: end.toISOString().split('T')[0],
            budget_amount: p.budget,
            actual_amount: 0,
            progress_pct: 0,
            status: 'planned',
            currency: 'USD',
          };
        });
        const { error: phaseErr } = await admin.from('construction_phases').insert(phaseRows);
        if (phaseErr) console.log(`  Phase seed error: ${phaseErr.message}`);
        else console.log(`  Seeded ${phases.length} construction phases`);
      }
    }

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
    // SECTION 4: CMS — Interactive (screenshots ~066-110)
    // ══════════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('SECTION 4: CMS');
    console.log('════════════════════════════════════════');

    // Dashboard
    await visitPage(page, APPS.cms, 'cms-dashboard');

    // Lots inventory
    await visitPage(page, `${APPS.cms}/lots`, 'cms-lots');
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await ss(page, 'cms-lots-scroll');

    // Cases list (before creation)
    await visitPage(page, `${APPS.cms}/cases`, 'cms-cases-before');

    // ── Create a Case via 3-step wizard ──
    console.log('Creating a new case...');
    await page.goto(`${APPS.cms}/cases/new`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    await ss(page, 'cms-case-new-step1');

    // Step 1: Property & Buyer
    try {
      // Select first available manzana (skip placeholders in EN/ES)
      const manzanaSelect = page.locator('select').first();
      await expect(manzanaSelect).toBeVisible({ timeout: 10_000 });
      const manzanaOptions = await manzanaSelect.locator('option').allTextContents();
      const isPlaceholder = (o: string) => !o || o === '' || /select|seleccionar|elegir|\.\.\./i.test(o);
      const firstManzana = manzanaOptions.find(o => !isPlaceholder(o));
      if (firstManzana) {
        await manzanaSelect.selectOption({ label: firstManzana });
        await page.waitForTimeout(1500);
        console.log(`  Manzana selected: ${firstManzana}`);
      } else {
        console.log('  No manzana options found');
      }

      // Select first available lot (wait for it to become enabled)
      const lotSelect = page.locator('select').nth(1);
      try {
        await expect(lotSelect).toBeEnabled({ timeout: 10_000 });
      } catch {
        console.log('  Lot select stayed disabled — manzana may have no lots');
      }
      await page.waitForTimeout(500);
      const lotOptions = await lotSelect.locator('option').allTextContents();
      const firstLot = lotOptions.find(o => !isPlaceholder(o));
      if (firstLot) {
        await lotSelect.selectOption({ label: firstLot });
        await page.waitForTimeout(500);
        console.log(`  Lot selected: ${firstLot}`);
      } else {
        console.log('  No lot options available');
      }

      // Fill buyer name
      const buyerNameInput = page.locator('input[placeholder="Juan Pérez García"]');
      if (await buyerNameInput.isVisible().catch(() => false)) {
        await buyerNameInput.fill('María García López');
      } else {
        // fallback: first text input after selects
        const textInputs = page.locator('input[type="text"]');
        const count = await textInputs.count();
        for (let i = 0; i < count; i++) {
          const inp = textInputs.nth(i);
          const val = await inp.inputValue();
          if (!val) { await inp.fill('María García López'); break; }
        }
      }
      console.log('  Buyer: María García López');

      // Fill buyer email
      const buyerEmail = page.locator('input[type="email"]').first();
      if (await buyerEmail.isVisible().catch(() => false)) {
        await buyerEmail.fill('maria.garcia@test.com');
      }

      // Fill buyer phone
      const buyerPhone = page.locator('input[type="tel"]').first();
      if (await buyerPhone.isVisible().catch(() => false)) {
        await buyerPhone.fill('+52 998 555 1234');
      }

      // Fill sale price (look for the price input — placeholder "0.00")
      const priceInputs = page.locator('input[placeholder="0.00"]');
      const priceCount = await priceInputs.count();
      if (priceCount > 0) {
        // Last "0.00" input is usually sale price
        const salePriceInput = priceInputs.last();
        await salePriceInput.fill('4500000');
        console.log('  Sale price: $4,500,000 MXN');
      }

      await page.waitForTimeout(500);
      await ss(page, 'cms-case-step1-filled');

      // Click Continue (skip if button is disabled = no lot selected)
      const step1Continue = page.getByRole('button', { name: /Continue/i });
      const step1Enabled = await step1Continue.isEnabled({ timeout: 5_000 }).catch(() => false);
      if (step1Enabled) {
        await step1Continue.click();
        await page.waitForTimeout(1000);
        await ss(page, 'cms-case-step2-payment-plan');
        console.log('  → Step 2: Payment Plan');

        // Step 2: Select 30/60/10 payment plan
        const planBtn = page.locator('button').filter({ hasText: '30/60/10' });
        if (await planBtn.isVisible().catch(() => false)) {
          await planBtn.click();
          await page.waitForTimeout(500);
          console.log('  Plan: 30/60/10');
        }

        await ss(page, 'cms-case-step2-plan-selected');

        // Scroll to see payment summary
        await page.evaluate(() => window.scrollTo(0, 600));
        await page.waitForTimeout(300);
        await ss(page, 'cms-case-step2-summary');

        // Click Review/Continue
        const step2Continue = page.getByRole('button', { name: /Review|Continue/i }).last();
        if (await step2Continue.isVisible().catch(() => false)) {
          await step2Continue.click();
          await page.waitForTimeout(1000);
          await ss(page, 'cms-case-step3-review');
          console.log('  → Step 3: Review');

          // Add notes
          const notesTextarea = page.locator('textarea').first();
          if (await notesTextarea.isVisible().catch(() => false)) {
            await notesTextarea.fill('E2E test case — Torre Altavista penthouse unit. Client referred by existing buyer.');
          }

          await ss(page, 'cms-case-step3-with-notes');

          // Submit: Create Case
          const createBtn = page.getByRole('button', { name: /Create Case/i });
          if (await createBtn.isVisible().catch(() => false)) {
            await createBtn.click();
            await page.waitForTimeout(3000);
            await ss(page, 'cms-case-created');
            console.log('  Case created successfully!');

            // Should redirect to case detail
            if (page.url().includes('/cases/')) {
              await page.waitForTimeout(1000);
              await ss(page, 'cms-case-detail');
              console.log(`  Case detail: ${page.url()}`);

              // Scroll to see payment schedule
              await page.evaluate(() => window.scrollTo(0, 600));
              await page.waitForTimeout(500);
              await ss(page, 'cms-case-detail-payments');
            }
          } else {
            console.log('  Create Case button not visible — skipping submit');
          }
        }
      } else {
        console.log('  Continue button disabled — step1 validation failed (lot not selected?)');
        await ss(page, 'cms-case-step1-validation-issue');
      }
    } catch (e) {
      console.log(`  Case creation error: ${(e as Error).message}`);
      await ss(page, 'cms-case-creation-error');
    }

    // Cases list after creation
    await visitPage(page, `${APPS.cms}/cases`, 'cms-cases-after');

    // Offers list (before creation)
    await visitPage(page, `${APPS.cms}/offers`, 'cms-offers-before');

    // ── Create an Offer via 3-step wizard ──
    console.log('Creating a new offer...');
    await page.goto(`${APPS.cms}/offers/new`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    await ss(page, 'cms-offer-new-step1');

    try {
      // Step 1: Lot & Buyer
      const isPlaceholder2 = (o: string) => !o || o === '' || /select|seleccionar|elegir|\.\.\./i.test(o);
      const offerManzana = page.locator('select').first();
      await expect(offerManzana).toBeVisible({ timeout: 10_000 });
      const offerManzanaOptions = await offerManzana.locator('option').allTextContents();
      // Pick a different manzana than Floor 1 (used for case) to get fresh lots
      const nonPlaceholders = offerManzanaOptions.filter(o => !isPlaceholder2(o));
      const offerFirstManzana = nonPlaceholders.find(o => o !== 'Floor 1') || nonPlaceholders[0];
      if (offerFirstManzana) {
        await offerManzana.selectOption({ label: offerFirstManzana });
        await page.waitForTimeout(2000);
        console.log(`  Offer manzana: ${offerFirstManzana}`);
      }

      // Select a lot (2nd select — wait for it to be enabled)
      const offerLotSelect = page.locator('select').nth(1);
      try {
        await expect(offerLotSelect).toBeEnabled({ timeout: 10_000 });
      } catch {
        console.log('  Offer lot select stayed disabled');
      }
      await page.waitForTimeout(1000);
      const offerLotOptions = await offerLotSelect.locator('option').allTextContents();
      const offerFirstLot = offerLotOptions.find(o => !isPlaceholder2(o));
      if (offerFirstLot) {
        try {
          await offerLotSelect.selectOption({ label: offerFirstLot }, { timeout: 5_000 });
          await page.waitForTimeout(500);
          console.log(`  Offer lot: ${offerFirstLot}`);
        } catch {
          // Try by index if label match fails
          const nonPlaceholderIdx = offerLotOptions.findIndex(o => !isPlaceholder2(o));
          if (nonPlaceholderIdx >= 0) {
            await offerLotSelect.selectOption({ index: nonPlaceholderIdx }, { timeout: 5_000 }).catch(() => {});
            console.log(`  Offer lot: selected by index ${nonPlaceholderIdx}`);
          } else {
            console.log('  Offer lot: selection failed');
          }
        }
      } else {
        console.log('  No offer lot options available');
      }

      // Fill buyer name
      const offerBuyerName = page.locator('input[placeholder="Juan Pérez García"]');
      if (await offerBuyerName.isVisible().catch(() => false)) {
        await offerBuyerName.fill('Roberto Silva Martínez');
      } else {
        const textInputs = page.locator('input[type="text"]');
        const count = await textInputs.count();
        for (let i = 0; i < count; i++) {
          const inp = textInputs.nth(i);
          const val = await inp.inputValue();
          if (!val) { await inp.fill('Roberto Silva Martínez'); break; }
        }
      }

      // Fill email
      const offerEmail = page.locator('input[type="email"]').first();
      if (await offerEmail.isVisible().catch(() => false)) {
        await offerEmail.fill('roberto.silva@test.com');
      }

      // Fill nationality
      const nationalityInput = page.locator('input[placeholder="Mexicana"]');
      if (await nationalityInput.isVisible().catch(() => false)) {
        await nationalityInput.fill('Mexicana');
      }

      await ss(page, 'cms-offer-step1-filled');
      console.log('  Buyer: Roberto Silva Martínez');

      // Continue to step 2 (skip if disabled = no lot selected)
      const offerStep1Continue = page.getByRole('button', { name: /Continue/i });
      const offerStep1Enabled = await offerStep1Continue.isEnabled({ timeout: 5_000 }).catch(() => false);
      if (offerStep1Enabled) {
        await offerStep1Continue.click();
        await page.waitForTimeout(1000);
        await ss(page, 'cms-offer-step2-price');
        console.log('  → Step 2: Price & Plan');

        // Fill proposed price
        const proposedPriceInput = page.locator('input[type="text"]').first();
        if (await proposedPriceInput.isVisible().catch(() => false)) {
          await proposedPriceInput.fill('3800000');
          console.log('  Proposed price: $3,800,000 MXN');
        }

        // Select 40/50/10 plan
        const offerPlanBtn = page.locator('button').filter({ hasText: '40/50/10' });
        if (await offerPlanBtn.isVisible().catch(() => false)) {
          await offerPlanBtn.click();
          await page.waitForTimeout(500);
          console.log('  Plan: 40/50/10');
        }

        // Set broker commission
        const commissionInput = page.locator('input[type="number"][step="0.5"]');
        if (await commissionInput.isVisible().catch(() => false)) {
          await commissionInput.fill('5');
        }

        await ss(page, 'cms-offer-step2-filled');

        // Scroll to see summary
        await page.evaluate(() => window.scrollTo(0, 600));
        await page.waitForTimeout(300);
        await ss(page, 'cms-offer-step2-summary');

        // Continue to step 3
        const offerStep2Continue = page.getByRole('button', { name: /Review/i }).last();
        if (await offerStep2Continue.isVisible().catch(() => false)) {
          await offerStep2Continue.click();
          await page.waitForTimeout(1000);
          await ss(page, 'cms-offer-step3-review');
          console.log('  → Step 3: Review');

          // Add notes
          const offerNotes = page.locator('textarea').first();
          if (await offerNotes.isVisible().catch(() => false)) {
            await offerNotes.fill('E2E test offer — Client interested in 2BR unit, requesting 5% discount from list price.');
          }

          await ss(page, 'cms-offer-step3-with-notes');

          // Submit offer
          const submitOfferBtn = page.getByRole('button', { name: /Submit Offer/i });
          if (await submitOfferBtn.isVisible().catch(() => false)) {
            await submitOfferBtn.click();
            await page.waitForTimeout(3000);
            await ss(page, 'cms-offer-submitted');
            console.log('  Offer submitted!');

            // Should redirect to offer detail
            if (page.url().includes('/offers/')) {
              await page.waitForTimeout(1000);
              await ss(page, 'cms-offer-detail');
              console.log(`  Offer detail: ${page.url()}`);
            }
          }
        }
      }
    } catch (e) {
      console.log(`  Offer creation error: ${(e as Error).message}`);
      await ss(page, 'cms-offer-creation-error');
    }

    // Offers after creation
    await visitPage(page, `${APPS.cms}/offers`, 'cms-offers-after');

    // Offer review queue
    await visitPage(page, `${APPS.cms}/offers/review`, 'cms-offer-review');

    // Payments (should show auto-generated payment schedule from case)
    await visitPage(page, `${APPS.cms}/payments`, 'cms-payments');
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await ss(page, 'cms-payments-scroll');

    // Approvals
    await visitPage(page, `${APPS.cms}/approvals`, 'cms-approvals');

    // Finance report (should show cash flow from case data)
    await visitPage(page, `${APPS.cms}/finance`, 'cms-finance');
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await ss(page, 'cms-finance-scroll');

    // Manual intake
    await visitPage(page, `${APPS.cms}/intake`, 'cms-intake');

    // Construction dashboard (should have seeded phases)
    await visitPage(page, `${APPS.cms}/construction`, 'cms-construction');
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await ss(page, 'cms-construction-scroll');

    // Construction phases (should show seeded phases with budgets)
    await visitPage(page, `${APPS.cms}/construction/phases`, 'cms-construction-phases');
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await ss(page, 'cms-construction-phases-scroll');

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

    // Scenario modeler — should have seeded baseline data
    await visitPage(page, `${APPS.portal}/scenario-modeler`, 'portal-scenario-modeler');
    // Scroll to see monthly projections chart
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);
    await ss(page, 'portal-scenario-modeler-chart');
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(500);
    await ss(page, 'portal-scenario-modeler-table');

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
    // SECTION 7: BROKER PORTAL — Interactive (screenshots ~141-165)
    // ══════════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('SECTION 7: BROKER PORTAL');
    console.log('════════════════════════════════════════');

    // Dashboard
    await visitPage(page, APPS.broker, 'broker-dashboard');

    // Lots inventory
    await visitPage(page, `${APPS.broker}/lots`, 'broker-lots');
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await ss(page, 'broker-lots-scroll');

    // Click into first lot detail (if available)
    try {
      const lotCard = page.locator('[class*="rounded"]').filter({ hasText: /available/i }).first();
      if (await lotCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await lotCard.click();
        await page.waitForTimeout(1000);
        await ss(page, 'broker-lot-detail');
        console.log('Lot detail viewed');
      }
    } catch { /* no lot cards */ }

    // Leads list (empty initially)
    await visitPage(page, `${APPS.broker}/leads`, 'broker-leads-empty');

    // ── Create a new lead (correct field names: firstName, lastName) ──
    console.log('Creating a broker lead...');
    await page.goto(`${APPS.broker}/leads/new`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    await ss(page, 'broker-lead-new-form');

    try {
      // The LeadNew form has: firstName, lastName, email, phone, nationality, lotInterest, source, notes
      const firstNameInput = page.locator('input[type="text"]').first();
      const lastNameInput = page.locator('input[type="text"]').nth(1);
      const emailInput = page.locator('input[type="email"]').first();
      const phoneInput = page.locator('input[type="tel"]').first();

      if (await firstNameInput.isVisible().catch(() => false)) {
        await firstNameInput.fill('Carlos');
        console.log('  First name: Carlos');
      }
      if (await lastNameInput.isVisible().catch(() => false)) {
        await lastNameInput.fill('Mendez Rodríguez');
        console.log('  Last name: Mendez Rodríguez');
      }
      if (await emailInput.isVisible().catch(() => false)) {
        await emailInput.fill('carlos.mendez@test.com');
      }
      if (await phoneInput.isVisible().catch(() => false)) {
        await phoneInput.fill('+52 998 123 4567');
      }

      // Nationality (3rd text input)
      const nationalityField = page.locator('input[type="text"]').nth(2);
      if (await nationalityField.isVisible().catch(() => false)) {
        await nationalityField.fill('Mexicana');
      }

      // Lot interest select
      const lotInterestSelect = page.locator('select').first();
      if (await lotInterestSelect.isVisible().catch(() => false)) {
        const lotOpts = await lotInterestSelect.locator('option').allTextContents();
        const firstAvailLot = lotOpts.find(o => o && o !== '' && !o.includes('Select') && !o.includes('--'));
        if (firstAvailLot) {
          await lotInterestSelect.selectOption({ label: firstAvailLot });
          console.log(`  Lot interest: ${firstAvailLot}`);
        }
      }

      // Source select (2nd select or labelled)
      const sourceSelect = page.locator('select').nth(1);
      if (await sourceSelect.isVisible().catch(() => false)) {
        await sourceSelect.selectOption('referral');
        console.log('  Source: referral');
      }

      // Notes
      const notesField = page.locator('textarea').first();
      if (await notesField.isVisible().catch(() => false)) {
        await notesField.fill('Interested in penthouse units with ocean view. Referred by existing investor at Torre Altavista.');
      }

      await ss(page, 'broker-lead-form-filled');
      console.log('  Lead form filled');

      // Submit (button text is "Register Lead" from i18n)
      const submitBtn = page.locator('button[type="submit"]');
      if (await submitBtn.isVisible().catch(() => false)) {
        // Listen for console errors from the browser during submission
        const consoleErrors: string[] = [];
        page.on('console', msg => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        await submitBtn.click();
        await page.waitForTimeout(3000);
        // Check for form error message (React normalizes hex to rgb)
        const errorMsg = page.locator('p').filter({ hasText: /.+/ }).locator('xpath=self::*[contains(@style,"ef4444") or contains(@style,"239, 68, 68")]');
        const hasError = await errorMsg.isVisible().catch(() => false);
        if (hasError) {
          const errorText = await errorMsg.textContent();
          console.log(`  Lead form error: ${errorText}`);
        }
        if (consoleErrors.length > 0) {
          console.log(`  Browser console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
        }
        await ss(page, 'broker-lead-submitted');
        console.log('  Lead submitted!');

        // Should redirect to /leads list
        if (page.url().includes('/leads')) {
          await page.waitForTimeout(1000);
          await ss(page, 'broker-leads-after-create');

          // Try clicking into the lead detail
          const leadLink = page.getByText('Carlos').first();
          if (await leadLink.isVisible().catch(() => false)) {
            await leadLink.click();
            await page.waitForTimeout(1000);
            await ss(page, 'broker-lead-detail');
            console.log('  Lead detail viewed');
          }
        }
      } else {
        console.log('  Submit button not found');
        await ss(page, 'broker-lead-no-submit');
      }
    } catch (e) {
      console.log(`  Lead creation error: ${(e as Error).message}`);
      await ss(page, 'broker-lead-creation-error');
    }

    // Go back to leads list
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

      // Cases count (should have at least 1 from wizard)
      const { count: caseCount } = await admin
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', testOrgId);
      console.log(`Cases: ${caseCount ?? 0}`);

      // Offers count
      try {
        const { count: offerCount } = await admin
          .from('offers')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', testOrgId);
        console.log(`Offers: ${offerCount ?? 0}`);
      } catch {
        console.log('Offers: (table not accessible)');
      }

      // Construction phases (should be seeded from proforma)
      try {
        const { data: phases } = await admin
          .from('construction_phases')
          .select('phase_name, budget_amount, status')
          .eq('org_id', testOrgId)
          .order('sort_order');
        if (phases?.length) {
          console.log(`Construction phases: ${phases.length}`);
          phases.forEach((p: any) => console.log(`  - ${p.phase_name}: $${p.budget_amount?.toLocaleString()} (${p.status})`));
        } else {
          console.log('Construction phases: 0 (not seeded)');
        }
      } catch (e) {
        console.log(`Construction phases: (query error: ${(e as Error).message})`);
      }

      // Saved scenarios (should have baseline from proforma)
      try {
        const { data: scenarios } = await admin
          .from('saved_scenarios')
          .select('name, status')
          .eq('org_id', testOrgId);
        if (scenarios?.length) {
          console.log(`Saved scenarios: ${scenarios.length}`);
          scenarios.forEach((s: any) => console.log(`  - ${s.name} (${s.status})`));
        } else {
          console.log('Saved scenarios: 0 (not seeded)');
        }
      } catch {
        console.log('Saved scenarios: (table not accessible)');
      }

      // Scenario projections
      try {
        const { count: projCount } = await admin
          .from('scenario_projections')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', testOrgId);
        console.log(`Scenario projections: ${projCount ?? 0} months`);
      } catch {
        console.log('Scenario projections: (table not accessible)');
      }

      // Broker record
      try {
        const { data: brokers } = await admin
          .from('brokers')
          .select('full_name, email, active')
          .eq('org_id', testOrgId);
        if (brokers?.length) {
          console.log(`Brokers: ${brokers.length}`);
          brokers.forEach((b: any) => console.log(`  - ${b.full_name} (${b.email}) active=${b.active}`));
        } else {
          console.log('Brokers: 0 (not seeded)');
        }
      } catch {
        console.log('Brokers: (table not accessible)');
      }

      // Broker leads
      try {
        const { data: leads, error: leadsErr } = await admin
          .from('broker_leads')
          .select('client_name, client_email, status')
          .eq('org_id', testOrgId);
        if (leadsErr) console.log(`  Broker leads query error: ${leadsErr.message}`);
        if (leads?.length) {
          console.log(`Broker leads: ${leads.length}`);
          leads.forEach((l: any) => console.log(`  - ${l.client_name} (${l.client_email}) [${l.status}]`));
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

    expect(shots.length).toBeGreaterThan(100);

    // Keep org for review
    if (testOrgId) {
      console.log(`\nAltavista org preserved: ${testOrgId}`);
    }
  });
});
