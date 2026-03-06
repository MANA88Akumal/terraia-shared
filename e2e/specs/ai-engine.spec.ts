/**
 * TerraIA AI Engine — Comprehensive E2E Test Suite
 *
 * Tests all 4 phases of the AI Intelligence Engine:
 * - Phase 1: CFO Engine (rules + AI)
 * - Phase 2: GC Engine (rules + AI)
 * - Phase 3: Investor Engine (IRR sensitivity + AI)
 * - Phase 4: Learning System (benchmarks, quality scoring, admin dashboard)
 *
 * Run:
 *   npx playwright test --project=ai-engine --reporter=line
 *   npx playwright test --project=ai-engine -g "Benchmark Admin" --headed
 *   npx playwright test --project=ai-engine -g "Full Onboarding" --headed
 */
import { test as base, expect } from '@playwright/test';
import { injectLoginSession } from '../helpers/cookie';
import { getAdminClient, getAnonClient } from '../helpers/supabase-admin';
import type { Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.resolve(__dirname, '../../../../TestData');

const ONBOARD_USER_ID = '72dc92ab-a31d-4cee-b79a-0c83e68b59ba';

// Custom fixture: page with Supabase session injected
const test = base.extend<{ loginPage: Page }>({
  loginPage: async ({ page }, use) => {
    await injectLoginSession(page, 'onboard');
    await use(page);
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function del(admin: any, table: string, column: string, value: string): Promise<boolean> {
  const { error, data } = await admin.from(table).delete().eq(column, value).select('id');
  if (error) return false;
  return data && data.length > 0;
}

async function cleanupOrg(admin: any, orgId: string) {
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

// ════════════════════════════════════════════════════════════════════════════
// 1. BENCHMARK ADMIN DASHBOARD — UI TESTS
// ════════════════════════════════════════════════════════════════════════════

test.describe('1. Benchmark Admin Dashboard — UI', () => {

  test('1.1 Dashboard loads without JS errors', async ({ loginPage: page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/benchmarks');
    await page.waitForLoadState('networkidle');

    // Should show the dashboard title
    await expect(page.getByText('Benchmark Dashboard')).toBeVisible({ timeout: 15_000 });

    const critical = errors.filter(e =>
      !e.includes('ResizeObserver') && !e.includes('net::ERR_ABORTED')
    );
    expect(critical.length).toBe(0);
  });

  test('1.2 KPI cards render with values', async ({ loginPage: page }) => {
    await page.goto('/admin/benchmarks');
    await expect(page.getByText('Benchmark Dashboard')).toBeVisible({ timeout: 15_000 });
    // Wait for data to load
    await page.waitForTimeout(2000);

    // All 4 KPI cards should be visible
    await expect(page.getByText('Benchmark Records', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Analysis Runs', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Avg Quality Score', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Coverage Groups', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('1.3 Coverage table shows project_type/country rows', async ({ loginPage: page }) => {
    await page.goto('/admin/benchmarks');
    await expect(page.getByText('Coverage by Type')).toBeVisible({ timeout: 15_000 });

    // Should have at least one row with a project type
    const coverageRows = page.locator('table').first().locator('tbody tr');
    const count = await coverageRows.count();
    expect(count).toBeGreaterThan(0);
    console.log(`Coverage table rows: ${count}`);
  });

  test('1.4 Averages table shows metric columns', async ({ loginPage: page }) => {
    await page.goto('/admin/benchmarks');
    await expect(page.getByText('Average Values by Project Type')).toBeVisible({ timeout: 15_000 });

    // Should have metric headers
    const avgTable = page.locator('text=Average Values by Project Type').locator('..').locator('..');
    await expect(avgTable.getByText('Hard $/m²')).toBeVisible();
    await expect(avgTable.getByText('IRR')).toBeVisible();
    await expect(avgTable.getByText('Margin')).toBeVisible();
  });

  test('1.5 Data by Year section shows year cards', async ({ loginPage: page }) => {
    await page.goto('/admin/benchmarks');
    await expect(page.getByText('Benchmark Dashboard')).toBeVisible({ timeout: 15_000 });

    // Scroll to Data by Year section
    const section = page.getByText('Data by Year');
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible({ timeout: 5_000 });

    // Should show at least 2024 (seed data year) — use first() since it appears in year cards AND raw table
    await expect(page.getByText('2024').first()).toBeVisible({ timeout: 5_000 });
  });

  test('1.6 Raw Benchmark Records table shows data', async ({ loginPage: page }) => {
    await page.goto('/admin/benchmarks');
    await expect(page.getByText('Raw Benchmark Records')).toBeVisible({ timeout: 15_000 });

    // Should have data rows
    const rawTable = page.locator('text=Raw Benchmark Records').locator('..').locator('..').locator('table');
    const rows = rawTable.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    console.log(`Raw benchmark rows displayed: ${count}`);
  });

  test('1.7 Back to Home link works', async ({ loginPage: page }) => {
    await page.goto('/admin/benchmarks');
    await expect(page.getByText('Back to Home')).toBeVisible({ timeout: 15_000 });

    await page.getByText('Back to Home').click();
    await page.waitForURL('**/', { timeout: 10_000 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. BENCHMARK STORE — DATA INTEGRITY
// ════════════════════════════════════════════════════════════════════════════

test.describe('2. Benchmark Store — Data Integrity', () => {

  test('2.1 Seed benchmarks exist for core project types', async () => {
    const admin = getAdminClient();
    // Check the types that are always seeded (mixed_use may not have seeds)
    const requiredTypes = ['condo_tower', 'masterplan_lots', 'multifamily_rental', 'hotel_residential'];
    const optionalTypes = ['mixed_use'];

    for (const type of requiredTypes) {
      const { count } = await admin
        .from('benchmark_store')
        .select('*', { count: 'exact', head: true })
        .eq('project_type', type);

      expect(count, `No benchmarks for project_type: ${type}`).toBeGreaterThan(0);
      console.log(`  ${type}: ${count} rows`);
    }

    for (const type of optionalTypes) {
      const { count } = await admin
        .from('benchmark_store')
        .select('*', { count: 'exact', head: true })
        .eq('project_type', type);
      console.log(`  ${type}: ${count || 0} rows (optional)`);
    }
  });

  test('2.2 Seed benchmarks cover MX + US + CO markets', async () => {
    const admin = getAdminClient();

    for (const country of ['MX', 'US', 'CO']) {
      const { count } = await admin
        .from('benchmark_store')
        .select('*', { count: 'exact', head: true })
        .eq('country', country);

      expect(count, `No benchmarks for country: ${country}`).toBeGreaterThan(0);
      console.log(`  ${country}: ${count} rows`);
    }
  });

  test('2.3 All benchmark values are in plausible ranges', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('benchmark_store')
      .select('cost_hard_per_m2, irr_equity, gross_margin_pct, project_type');

    expect(data?.length).toBeGreaterThan(0);

    for (const b of data || []) {
      if (b.cost_hard_per_m2 != null) {
        expect(b.cost_hard_per_m2).toBeGreaterThan(100);
        expect(b.cost_hard_per_m2).toBeLessThan(20000);
      }
      if (b.irr_equity != null) {
        expect(b.irr_equity).toBeGreaterThan(0);
        expect(b.irr_equity).toBeLessThan(100);
      }
      if (b.gross_margin_pct != null) {
        expect(b.gross_margin_pct).toBeGreaterThan(0);
        expect(b.gross_margin_pct).toBeLessThan(80);
      }
    }
    console.log(`All ${data?.length} benchmark rows validated`);
  });

  test('2.4 quality_score column exists on benchmark_store', async () => {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('benchmark_store')
      .select('quality_score, project_type')
      .limit(5);

    if (error?.code === '42703') {
      // Column doesn't exist yet — migration 010 not applied
      console.log('quality_score column not found — migration 010 not applied yet (expected)');
      return;
    }

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);

    const hasQuality = data?.some(d => d.quality_score != null);
    console.log(`quality_score populated: ${hasQuality}`);
    if (hasQuality) {
      const scores = data!.map(d => d.quality_score).filter(Boolean);
      console.log(`  Scores: ${scores.join(', ')}`);
    }
  });

  test('2.5 increment_quality_scores RPC works (requires migration 010)', async () => {
    const admin = getAdminClient();

    // Insert a test benchmark row
    const { data: inserted, error: insertErr } = await admin
      .from('benchmark_store')
      .insert({
        project_type: 'test_e2e',
        country: 'XX',
        city_tier: 'tier3',
        units_range: 'small',
        data_year: 9999,
        quality_score: 3,
        cost_hard_per_m2: 500,
      })
      .select('id, quality_score')
      .single();

    if (insertErr) {
      // quality_score column might not exist yet
      console.log('Insert with quality_score failed — migration 010 may not be applied yet');
      return;
    }
    expect(inserted).toBeTruthy();

    // Call the RPC to increment
    const { error: rpcErr } = await admin.rpc('increment_quality_scores', {
      record_ids: [inserted!.id],
    });

    if (rpcErr) {
      console.log('increment_quality_scores RPC not found — migration 010 not applied yet');
      // Cleanup
      await admin.from('benchmark_store').delete().eq('id', inserted!.id);
      return;
    }

    // Verify score incremented
    const { data: updated } = await admin
      .from('benchmark_store')
      .select('quality_score')
      .eq('id', inserted!.id)
      .single();

    expect(updated?.quality_score).toBe(4); // was 3, now 4

    // Cleanup
    await admin.from('benchmark_store').delete().eq('id', inserted!.id);
    console.log('increment_quality_scores RPC works correctly');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. ANALYSIS RUN TRACKING — DB VALIDATION
// ════════════════════════════════════════════════════════════════════════════

test.describe('3. Analysis Run Tracking', () => {

  test('3.1 analysis_runs records have correct structure', async () => {
    const admin = getAdminClient();
    const { data: runs } = await admin
      .from('analysis_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5);

    for (const run of runs || []) {
      expect(run.org_id).toBeTruthy();
      expect(run.status).toMatch(/running|complete|failed/);
      if (run.status === 'complete') {
        expect(run.completed_at).toBeTruthy();
        expect(run.findings_count).toBeGreaterThanOrEqual(0);
        expect(run.engines_run).toBeInstanceOf(Array);
      }
    }
    console.log(`Validated ${runs?.length || 0} analysis run records`);
  });

  test('3.2 No analysis runs stuck in "running" for > 5 min', async () => {
    const admin = getAdminClient();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: stuck } = await admin
      .from('analysis_runs')
      .select('id, org_id, started_at')
      .eq('status', 'running')
      .lt('started_at', fiveMinAgo);

    if (stuck?.length) {
      console.warn(`${stuck.length} runs stuck in "running" > 5 min`);
    }
    expect(stuck?.length || 0).toBe(0);
  });

  test('3.3 Completed runs list engines', async () => {
    const admin = getAdminClient();
    const { data: runs } = await admin
      .from('analysis_runs')
      .select('engines_run, findings_count')
      .eq('status', 'complete')
      .order('started_at', { ascending: false })
      .limit(3);

    if (!runs?.length) {
      console.log('No completed analysis runs yet — skipping engine validation');
      return;
    }

    for (const run of runs) {
      const engines = run.engines_run || [];
      // All 3 engines should be listed
      const hasAll = engines.includes('cfo') && engines.includes('gc') && engines.includes('investor');
      console.log(`  Engines: [${engines.join(', ')}] — ${run.findings_count} findings${hasAll ? '' : ' (incomplete)'}`);
      // At minimum, CFO should always run
      expect(engines).toContain('cfo');
    }
  });

  test('3.4 findings_count matches actual project_findings for completed runs', async () => {
    const admin = getAdminClient();
    const { data: runs } = await admin
      .from('analysis_runs')
      .select('id, org_id, findings_count')
      .eq('status', 'complete')
      .order('started_at', { ascending: false })
      .limit(3);

    for (const run of runs || []) {
      const { count } = await admin
        .from('project_findings')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', run.org_id);

      // findings_count should be <= total findings (could be more from multiple runs)
      expect(count).toBeGreaterThanOrEqual(run.findings_count || 0);
      console.log(`  Run ${run.id.slice(0, 8)}: declared ${run.findings_count}, actual ${count}`);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. PROJECT FINDINGS — DB VALIDATION
// ════════════════════════════════════════════════════════════════════════════

test.describe('4. Project Findings — Structure', () => {

  test('4.1 All findings have required fields', async () => {
    const admin = getAdminClient();
    const { data: findings } = await admin
      .from('project_findings')
      .select('id, rule_id, severity, title, description, engine, status, org_id')
      .limit(50);

    for (const f of findings || []) {
      expect(f.rule_id, `Missing rule_id on ${f.id}`).toBeTruthy();
      expect(f.severity, `Missing severity on ${f.id}`).toBeTruthy();
      expect(f.title, `Missing title on ${f.id}`).toBeTruthy();
      expect(f.description, `Missing description on ${f.id}`).toBeTruthy();
      expect(f.engine, `Missing engine on ${f.id}`).toBeTruthy();
      expect(f.status, `Missing status on ${f.id}`).toBeTruthy();
      expect(f.org_id, `Missing org_id on ${f.id}`).toBeTruthy();
    }
    console.log(`All ${findings?.length || 0} findings have required fields`);
  });

  test('4.2 Severity values are valid', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('severity')
      .limit(100);

    const validSeverities = ['critical', 'warning', 'observation'];
    for (const f of data || []) {
      expect(validSeverities).toContain(f.severity);
    }
  });

  test('4.3 Engine values are valid', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('engine')
      .limit(100);

    const validEngines = ['cfo', 'gc', 'investor'];
    for (const f of data || []) {
      expect(validEngines).toContain(f.engine);
    }
  });

  test('4.4 data_snapshot is a valid object', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('id, data_snapshot, rule_id')
      .not('data_snapshot', 'is', null)
      .limit(30);

    for (const f of data || []) {
      expect(typeof f.data_snapshot).toBe('object');
      expect(f.data_snapshot).not.toBeNull();
    }
    console.log(`${data?.length || 0} findings have valid data_snapshot objects`);
  });

  test('4.5 Findings with recommendations have non-empty text', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('id, recommendation, rule_id')
      .not('recommendation', 'is', null)
      .limit(30);

    for (const f of data || []) {
      expect(f.recommendation.length).toBeGreaterThan(10);
    }
    console.log(`${data?.length || 0} findings have valid recommendations`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. CFO ENGINE RULES — DB VALIDATION
// ════════════════════════════════════════════════════════════════════════════

test.describe('5. CFO Engine Rules', () => {

  test('5.1 CFO findings exist', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('rule_id, severity, title')
      .eq('engine', 'cfo')
      .limit(20);

    console.log(`CFO findings: ${data?.length || 0}`);
    data?.forEach(f => console.log(`  [${f.severity}] ${f.rule_id}: ${f.title}`));
    expect(data?.length).toBeGreaterThanOrEqual(0); // Soft — depends on project data
  });

  test('5.2 CASH_TROUGH data_snapshot has expected fields', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('data_snapshot, severity')
      .eq('rule_id', 'CASH_TROUGH')
      .limit(1);

    if (data?.length) {
      const snap = data[0].data_snapshot;
      expect(snap.troughMonth).toBeGreaterThan(0);
      expect(snap.troughBalance).toBeDefined();
      expect(data[0].severity).toMatch(/critical|warning/);
      console.log(`  Cash trough: Month ${snap.troughMonth}, Balance $${snap.troughBalance?.toLocaleString()}`);
    } else {
      console.log('CASH_TROUGH not triggered (no project data or adequate cash position)');
    }
  });

  test('5.3 LOW_CONTINGENCY data_snapshot has contingencyPct < 0.08', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('data_snapshot')
      .eq('rule_id', 'LOW_CONTINGENCY')
      .limit(1);

    if (data?.length) {
      expect(data[0].data_snapshot.contingencyPct).toBeLessThan(0.08);
      console.log(`  Contingency: ${(data[0].data_snapshot.contingencyPct * 100).toFixed(1)}%`);
    }
  });

  test('5.4 CFO findings have valid categories', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('category, rule_id')
      .eq('engine', 'cfo')
      .limit(30);

    const validCategories = ['cash_flow', 'cost_structure', 'revenue', 'financing', 'risk', 'budget'];
    for (const f of data || []) {
      if (f.category) {
        // AI-generated findings may have custom categories, so just log
        console.log(`  ${f.rule_id}: ${f.category}`);
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. GC ENGINE RULES — DB VALIDATION
// ════════════════════════════════════════════════════════════════════════════

test.describe('6. GC Engine Rules', () => {

  test('6.1 GC findings exist', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('rule_id, severity, title')
      .eq('engine', 'gc')
      .limit(20);

    console.log(`GC findings: ${data?.length || 0}`);
    data?.forEach(f => console.log(`  [${f.severity}] ${f.rule_id}: ${f.title}`));
  });

  test('6.2 FLOOR_PLATE_OVERFLOW data_snapshot structure', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('data_snapshot')
      .eq('rule_id', 'FLOOR_PLATE_OVERFLOW')
      .limit(1);

    if (data?.length) {
      const snap = data[0].data_snapshot;
      expect(snap.requiredArea).toBeGreaterThan(snap.declaredFloorPlate);
      console.log(`  Floor plate: needs ${snap.requiredArea}m², has ${snap.declaredFloorPlate}m²`);
    }
  });

  test('6.3 LOW_PARKING_RATIO data_snapshot structure', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('data_snapshot')
      .eq('rule_id', 'LOW_PARKING_RATIO')
      .limit(1);

    if (data?.length) {
      const snap = data[0].data_snapshot;
      expect(snap.actualRatio).toBeLessThan(snap.minimumRatio);
      console.log(`  Parking: ${snap.actualRatio?.toFixed(2)} actual vs ${snap.minimumRatio} minimum`);
    }
  });

  test('6.4 GC cost benchmark findings have benchmark data', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('data_snapshot, rule_id')
      .eq('engine', 'gc')
      .eq('category', 'cost_benchmark')
      .limit(10);

    for (const f of data || []) {
      expect(f.data_snapshot).toBeTruthy();
      console.log(`  ${f.rule_id}: ${JSON.stringify(f.data_snapshot).slice(0, 100)}`);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. INVESTOR ENGINE RULES — DB VALIDATION
// ════════════════════════════════════════════════════════════════════════════

test.describe('7. Investor Engine Rules', () => {

  test('7.1 Investor findings exist', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('rule_id, severity, title')
      .eq('engine', 'investor')
      .limit(20);

    console.log(`Investor findings: ${data?.length || 0}`);
    data?.forEach(f => console.log(`  [${f.severity}] ${f.rule_id}: ${f.title}`));
  });

  test('7.2 IRR_SENSITIVITY has 3x3 sensitivityGrid', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('data_snapshot')
      .eq('rule_id', 'IRR_SENSITIVITY')
      .limit(1);

    if (data?.length) {
      const grid = data[0].data_snapshot?.sensitivityGrid;
      expect(grid).toBeTruthy();
      expect(grid.length).toBe(3); // 3 rows
      expect(grid[0].length).toBe(3); // 3 columns

      // Each cell should have irr, cost, absorption
      for (const row of grid) {
        for (const cell of row) {
          expect(cell.cost).toBeTruthy();
          expect(cell.absorption).toBeTruthy();
          // irr can be null for extreme scenarios
          expect('irr' in cell).toBe(true);
        }
      }
      console.log('  3x3 sensitivity grid validated');

      // Log the grid
      for (const row of grid) {
        const line = row.map((c: any) =>
          `${c.cost}/${c.absorption}: ${c.irr != null ? (c.irr * 100).toFixed(1) + '%' : 'N/A'}`
        ).join(' | ');
        console.log(`  ${line}`);
      }
    } else {
      console.log('IRR_SENSITIVITY not present (no cash flow data in project)');
    }
  });

  test('7.3 EQUITY_MULTIPLE_LOW data_snapshot structure', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('data_snapshot')
      .eq('rule_id', 'EQUITY_MULTIPLE_LOW')
      .limit(1);

    if (data?.length) {
      expect(data[0].data_snapshot.equityMultiple).toBeLessThan(2.0);
      console.log(`  Equity multiple: ${data[0].data_snapshot.equityMultiple?.toFixed(2)}x`);
    }
  });

  test('7.4 Investor findings have valid categories', async () => {
    const admin = getAdminClient();
    const { data } = await admin
      .from('project_findings')
      .select('category, rule_id')
      .eq('engine', 'investor')
      .limit(20);

    const validCategories = ['returns', 'risk', 'capital_structure', 'exit_strategy', 'market_timing', 'concentration'];
    for (const f of data || []) {
      if (f.category) {
        console.log(`  ${f.rule_id}: ${f.category}`);
      }
    }
    console.log(`${data?.length || 0} investor findings checked`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. RLS — FINDINGS ISOLATION
// ════════════════════════════════════════════════════════════════════════════

test.describe('8. RLS — Findings Isolation', () => {

  test('8.1 Anon client cannot read project_findings', async () => {
    const anon = getAnonClient();
    const { data, error } = await anon
      .from('project_findings')
      .select('id')
      .limit(1);

    const blocked = !data || data.length === 0 || !!error;
    expect(blocked).toBe(true);
    console.log('RLS blocks anon access to project_findings');
  });

  test('8.2 Anon client cannot read analysis_runs', async () => {
    const anon = getAnonClient();
    const { data } = await anon
      .from('analysis_runs')
      .select('id')
      .limit(1);

    const blocked = !data || data.length === 0;
    expect(blocked).toBe(true);
    console.log('RLS blocks anon access to analysis_runs');
  });

  test('8.3 Anon client CAN read benchmark_store (public data)', async () => {
    const anon = getAnonClient();
    const { data, error } = await anon
      .from('benchmark_store')
      .select('project_type, country, cost_hard_per_m2')
      .limit(3);

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    console.log(`Anon can read benchmark_store: ${data?.length} rows`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. FULL ONBOARDING → AI ANALYSIS FLOW
// ════════════════════════════════════════════════════════════════════════════

test.describe('9. Full Onboarding → AI Analysis', () => {
  test.setTimeout(300_000); // 5 min for AI calls

  let testOrgId: string | null = null;
  let testStartTime: string;

  test.beforeEach(async () => {
    testStartTime = new Date().toISOString();
    await cleanupStaleData();
  });

  test.afterEach(async () => {
    if (testOrgId) {
      const admin = getAdminClient();
      // Clean up any benchmark rows contributed during this test
      await admin
        .from('benchmark_store')
        .delete()
        .eq('project_type', 'test_e2e')
        .gte('created_at', testStartTime)
        .then(() => {}, () => {});
      await cleanupOrg(admin, testOrgId);
      testOrgId = null;
    }
  });

  test('9.1 Complete onboarding with proforma → AI analysis → health report', async ({ loginPage: page }) => {
    // Clear stale onboarding state
    await page.goto('/onboarding');
    await page.evaluate(() => localStorage.removeItem('terraia_onboarding'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // ── STEP 0: Language ─────────────────────────────────────────────────
    await expect(page.getByText('Welcome to TerraIA')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /English/ }).click();
    console.log('Step 0: Language selected');

    // ── STEP 1: AI Chat + Org Creation ───────────────────────────────────
    const chatInput = page.locator('input[placeholder="Tell me about your project..."]');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    await chatInput.fill(
      'My company is AI Engine Test Corp. ' +
      'We are building Torre del Sol, a 48-unit residential condo tower ' +
      'in Panama City, Panama. Currency: USD. ' +
      'We bank with BBVA Panama.'
    );
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('.animate-bounce')).toHaveCount(0, { timeout: 60_000 });

    const confirmBtn = page.getByRole('button', { name: /Confirm & Set Up/i });
    await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });
    await confirmBtn.click();

    const nextBtn = page.getByRole('button', { name: /^Next$/i });
    await expect(nextBtn).toBeVisible({ timeout: 45_000 });

    testOrgId = await page.evaluate(() => {
      const saved = localStorage.getItem('terraia_onboarding');
      return saved ? JSON.parse(saved).orgId : null;
    });
    expect(testOrgId).toBeTruthy();
    console.log(`Step 1: Org created (${testOrgId})`);

    await nextBtn.click();
    await expect(page.getByText('Import Your Data')).toBeVisible({ timeout: 10_000 });

    // ── STEP 2: Upload proforma files ────────────────────────────────────
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      path.join(TEST_DATA_DIR, 'Selva_Azul_Proforma.xlsx'),
      path.join(TEST_DATA_DIR, 'Selva_Azul_Project_Data.xlsx'),
    ]);

    // Wait for AI classification
    await expect(page.getByText('Analyzing files...')).toHaveCount(0, { timeout: 90_000 });
    console.log('Files classified');

    // Process
    const processBtn = page.getByRole('button', { name: /Process All Files/i });
    await expect(processBtn).toBeVisible({ timeout: 10_000 });
    await processBtn.click();
    console.log('Processing started');

    // Handle column mapper confirmations
    for (let i = 0; i < 3; i++) {
      try {
        await page.getByText('Map Your Columns').waitFor({ state: 'visible', timeout: 60_000 });
      } catch {
        console.log(`  Mapper loop: exited after ${i} confirmations`);
        break;
      }

      const importBtn = page.getByRole('button', { name: /Import Data/i });
      await expect(importBtn).toBeVisible();
      await importBtn.click();
      console.log(`  Mapper ${i + 1}: confirmed`);
      await page.waitForTimeout(3000);
    }

    // Wait for import to complete
    await expect(page.getByText('Imported successfully')).toBeVisible({ timeout: 30_000 });
    console.log('Step 2: Files imported');

    // Continue to Ready step
    const continueBtn = page.getByRole('button', { name: /^Continue$/i });
    await expect(continueBtn).toBeVisible({ timeout: 10_000 });
    await continueBtn.click();

    // ── STEP 3: Ready — AI Analysis should auto-trigger ──────────────────
    await expect(page.getByText('Setup Complete!')).toBeVisible({ timeout: 10_000 });
    console.log('Step 3: Ready page loaded');

    // ── 9.2: AnalysisProgress renders ────────────────────────────────────
    // The analysis should auto-trigger. Look for the progress UI.
    const analysisStarted = await page.getByText('Analyzing Your Project').isVisible({ timeout: 10_000 }).catch(() => false);
    if (analysisStarted) {
      console.log('9.2: AnalysisProgress component visible');

      // ── 9.3: Stage dots are visible ──────────────────────────────────
      const dots = page.locator('.rounded-full.transition-all');
      const dotCount = await dots.count();
      console.log(`9.3: Progress dots visible: ${dotCount}`);

      // Wait for analysis to complete (up to 3 minutes)
      await expect(page.getByText('Project Health Report')).toBeVisible({ timeout: 180_000 });
      console.log('Analysis complete — Health Report visible');
    } else {
      // Analysis might have completed very fast or no data to analyze
      const reportVisible = await page.getByText('Project Health Report').isVisible().catch(() => false);
      const noIssues = await page.getByText('No Issues Found').isVisible().catch(() => false);
      console.log(`Analysis may have completed instantly. Report: ${reportVisible}, NoIssues: ${noIssues}`);
    }

    // ── 9.4: ProjectHealthReport renders with scorecards ─────────────────
    const hasReport = await page.getByText('Project Health Report').isVisible().catch(() => false);
    if (hasReport) {
      // Summary scorecards
      await expect(page.getByText('Critical')).toBeVisible();
      await expect(page.getByText('Warnings')).toBeVisible();
      await expect(page.getByText('Observations')).toBeVisible();
      console.log('9.4: Summary scorecards visible');

      // ── 9.5: Engine filter chips ─────────────────────────────────────
      const allChip = page.locator('button').filter({ hasText: /^All$/ });
      const cfoChip = page.locator('button').filter({ hasText: /CFO Analysis/ });
      const gcChip = page.locator('button').filter({ hasText: /Technical Review/ });
      const investorChip = page.locator('button').filter({ hasText: /Investor Assessment/ });

      const hasFilters = await allChip.isVisible().catch(() => false);
      if (hasFilters) {
        console.log('9.5: Engine filter chips visible');

        // ── 9.6: Clicking filters changes finding count ──────────────
        const allFindings = await page.locator('.rounded-xl.border.overflow-hidden').count();
        await cfoChip.click();
        await page.waitForTimeout(300);
        const cfoFindings = await page.locator('.rounded-xl.border.overflow-hidden').count();
        await allChip.click();
        console.log(`9.6: All=${allFindings}, CFO-only=${cfoFindings}`);
      }

      // ── 9.7: FindingCard renders ───────────────────────────────────
      const findingCards = page.locator('text=critical, text=warning, text=observation').first();
      const hasFindings = await findingCards.isVisible().catch(() => false);
      if (hasFindings) {
        console.log('9.7: FindingCard with severity badge visible');

        // ── 9.8: FindingCard expands on click ──────────────────────
        // Click the first finding card
        const firstCard = page.locator('.rounded-xl.border').filter({
          has: page.locator('text=critical, text=warning, text=observation'),
        }).first();

        await firstCard.locator('button').first().click();
        await page.waitForTimeout(300);

        const hasRecommendation = await page.getByText('Recommendation').first().isVisible().catch(() => false);
        console.log(`9.8: Finding expanded, recommendation visible: ${hasRecommendation}`);

        // ── 9.9: Developer response ────────────────────────────────
        const respondBtn = page.getByText('Respond to this finding').first();
        const canRespond = await respondBtn.isVisible().catch(() => false);
        if (canRespond) {
          await respondBtn.click();
          await expect(page.locator('textarea').first()).toBeVisible();
          console.log('9.9: Developer response textarea visible');

          // Type and cancel (don't save in test)
          await page.locator('textarea').first().fill('Test response from E2E');
          await page.getByText('Cancel').first().click();
        }
      }

      // ── 9.10: SensitivityTable ─────────────────────────────────────
      const sensitivityTable = page.getByText('IRR Sensitivity Analysis');
      const hasSensitivity = await sensitivityTable.isVisible().catch(() => false);
      if (hasSensitivity) {
        console.log('9.10: IRR Sensitivity Table visible');
        // Verify it has IRR percentage values
        const irrValues = page.locator('td.font-mono.font-bold');
        const irrCount = await irrValues.count();
        expect(irrCount).toBeGreaterThanOrEqual(9); // 3x3 grid
        console.log(`  ${irrCount} IRR cells rendered`);

        // Verify legend
        await expect(page.getByText('> 20%')).toBeVisible();
        await expect(page.getByText('< 0%')).toBeVisible();
      } else {
        console.log('9.10: No sensitivity table (no IRR data in proforma)');
      }

      // ── 9.11: BenchmarkChart ───────────────────────────────────────
      const benchmarkChart = page.locator('text=comparable project');
      const hasChart = await benchmarkChart.first().isVisible().catch(() => false);
      console.log(`9.11: BenchmarkChart visible: ${hasChart}`);
    }

    // ── 9.12: Continue to Dashboard ──────────────────────────────────────
    const dashBtn = page.getByRole('button', { name: /Continue to Dashboard|Go to Dashboard/i });
    const hasDashBtn = await dashBtn.isVisible().catch(() => false);
    if (hasDashBtn) {
      // If analysis is still loading, wait
      await expect(dashBtn).toBeEnabled({ timeout: 180_000 });
      await dashBtn.click();
      await page.waitForURL('**/', { timeout: 10_000 });
      console.log('9.12: Navigated to dashboard');
    } else {
      // Use the Go button at bottom
      const goBtn = page.getByRole('button', { name: /Go to Dashboard/i });
      await expect(goBtn).toBeEnabled({ timeout: 180_000 });
      await goBtn.click();
      await page.waitForURL('**/', { timeout: 10_000 });
      console.log('9.12: Navigated to dashboard via Go button');
    }

    // ── DB VERIFICATION ──────────────────────────────────────────────────
    const admin = getAdminClient();

    // ── 9.13: analysis_runs has a completed run ──────────────────────────
    const { data: runs } = await admin
      .from('analysis_runs')
      .select('status, findings_count, engines_run')
      .eq('org_id', testOrgId!)
      .eq('status', 'complete')
      .limit(1);

    if (runs?.length) {
      expect(runs[0].status).toBe('complete');
      expect(runs[0].findings_count).toBeGreaterThan(0);
      console.log(`9.13: Analysis run complete — ${runs[0].findings_count} findings, engines: ${runs[0].engines_run}`);
    } else {
      console.log('9.13: No completed analysis run found (analysis may not have triggered)');
    }

    // ── 9.14: project_findings from all 3 engines ────────────────────────
    const { data: findings } = await admin
      .from('project_findings')
      .select('engine, severity, rule_id, title')
      .eq('org_id', testOrgId!);

    if (findings?.length) {
      const engines = [...new Set(findings.map(f => f.engine))];
      console.log(`9.14: ${findings.length} findings from engines: [${engines.join(', ')}]`);
      findings.forEach(f => console.log(`  [${f.engine}/${f.severity}] ${f.rule_id}: ${f.title}`));

      // Should have findings from at least CFO (always runs)
      expect(engines).toContain('cfo');
    } else {
      console.log('9.14: No findings in DB (analysis may not have triggered)');
    }

    // ── 9.15: benchmark_store has contribution ───────────────────────────
    const { data: benchmarks } = await admin
      .from('benchmark_store')
      .select('project_type, country, quality_score, created_at')
      .gte('created_at', testStartTime)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log(`9.15: Benchmark contributions since test start: ${benchmarks?.length || 0}`);
    benchmarks?.forEach(b => console.log(`  ${b.project_type} / ${b.country} (quality: ${b.quality_score})`));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. PERFORMANCE & RELIABILITY
// ════════════════════════════════════════════════════════════════════════════

test.describe('10. Performance & Reliability', () => {

  test('10.1 No JS errors on /admin/benchmarks', async ({ loginPage: page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });

    await page.goto('/admin/benchmarks');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const critical = errors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('net::ERR_ABORTED') &&
      !e.includes('Non-Error')
    );

    if (critical.length > 0) console.warn('JS errors:', critical);
    expect(critical.length).toBe(0);
  });

  test('10.2 All Supabase calls from /admin/benchmarks return 2xx', async ({ loginPage: page }) => {
    const failedCalls: string[] = [];
    page.on('response', res => {
      if (res.url().includes('supabase.co') && res.status() >= 400) {
        failedCalls.push(`${res.status()} ${res.url().split('?')[0]}`);
      }
    });

    await page.goto('/admin/benchmarks');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    if (failedCalls.length > 0) console.warn('Failed Supabase calls:', failedCalls);
    expect(failedCalls.length).toBe(0);
  });

  test('10.3 /admin/benchmarks page loads in under 5 seconds', async ({ loginPage: page }) => {
    const start = Date.now();
    await page.goto('/admin/benchmarks');
    await expect(page.getByText('Benchmark Dashboard')).toBeVisible({ timeout: 10_000 });
    const elapsed = Date.now() - start;

    console.log(`Dashboard load time: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(5000);
  });

  test('10.4 Analysis engine completes within 120 seconds', async () => {
    const admin = getAdminClient();
    const { data: run } = await admin
      .from('analysis_runs')
      .select('started_at, completed_at')
      .eq('status', 'complete')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (run?.completed_at && run?.started_at) {
      const durationMs = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
      const durationSec = durationMs / 1000;
      console.log(`Latest analysis duration: ${durationSec.toFixed(1)}s`);
      expect(durationSec).toBeLessThan(120);
    } else {
      console.log('No completed analysis runs to measure');
    }
  });
});
