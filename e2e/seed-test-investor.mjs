/**
 * Seed a full test investor: auth user, roles, profile, distributions, documents.
 *
 * Idempotent — safe to run multiple times. Updates password and user_metadata
 * on each run, wipes and re-inserts distribution + document rows so the data
 * matches the script's intent.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node shared/e2e/seed-test-investor.mjs
 *
 * Creates:
 *   - Auth user john@manaakumal.com / freedom1234 (email confirmed)
 *   - profiles row (role=investor, approved=true)
 *   - user_roles + organization_members entry for MANA 88
 *   - platform_investor_profiles with $250K USD, 1.25% pro-rata, B-1 class
 *   - 24 months of platform_investor_distributions (12 paid, 12 scheduled)
 *   - 6 platform_investor_documents (reports, agreement, tax, statement)
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jmlxpcnkovxmadbygolp.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// MANA 88 identifiers (from CLAUDE.md)
const MANA88_ORG_ID = 'a0000000-0000-0000-0000-000000000001'
const MANA88_TENANT_ID = '62f1ef3b-f133-4d91-bd87-55edac7fcd67'

const TEST_EMAIL = 'john@manaakumal.com'
const TEST_PASSWORD = 'freedom1234'
const FULL_NAME = 'John Anderson'

const SAMPLE_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'

// ──────────────────────────────────────────────────────────────────────────
// 1. Auth user
// ──────────────────────────────────────────────────────────────────────────
async function upsertAuthUser() {
  console.log(`\n[1/6] Auth user ${TEST_EMAIL}`)
  const { data: list } = await admin.auth.admin.listUsers()
  const existing = list?.users?.find((u) => u.email === TEST_EMAIL)

  if (existing) {
    console.log(`  exists (id ${existing.id}) — updating password and metadata`)
    await admin.auth.admin.updateUserById(existing.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { current_org_id: MANA88_ORG_ID, full_name: FULL_NAME },
    })
    return existing.id
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { current_org_id: MANA88_ORG_ID, full_name: FULL_NAME },
  })
  if (error) throw error
  console.log(`  created (id ${data.user.id})`)
  return data.user.id
}

// ──────────────────────────────────────────────────────────────────────────
// 2. profiles
// ──────────────────────────────────────────────────────────────────────────
async function upsertProfile(userId) {
  console.log(`[2/6] profiles`)
  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      email: TEST_EMAIL,
      full_name: FULL_NAME,
      role: 'investor',
      approved: true,
      phone: '+1 415 555 0123',
      email_updates: true,
      whatsapp_alerts: true,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
  console.log('  upserted')
}

// ──────────────────────────────────────────────────────────────────────────
// 3. user_roles + organization_members
// ──────────────────────────────────────────────────────────────────────────
async function upsertMembership(userId) {
  console.log(`[3/6] user_roles + organization_members`)

  await admin.from('user_roles').delete().eq('user_id', userId).eq('tenant_id', MANA88_TENANT_ID)
  const { error: roleErr } = await admin.from('user_roles').insert({
    user_id: userId,
    tenant_id: MANA88_TENANT_ID,
    org_id: MANA88_ORG_ID,
    role: 'investor',
    is_active: true,
    app_access: ['client-portal', 'investors'],
  })
  if (roleErr) throw roleErr

  const { error: memErr } = await admin.from('organization_members').upsert(
    { user_id: userId, org_id: MANA88_ORG_ID, role: 'investor' },
    { onConflict: 'org_id,user_id' },
  )
  if (memErr) throw memErr
  console.log('  user_roles + organization_members set')
}

// ──────────────────────────────────────────────────────────────────────────
// 4. platform_investor_profiles
// ──────────────────────────────────────────────────────────────────────────
async function upsertInvestorProfile(userId) {
  console.log(`[4/6] platform_investor_profiles`)

  const existing = await admin
    .from('platform_investor_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', MANA88_ORG_ID)
    .maybeSingle()

  const payload = {
    user_id: userId,
    org_id: MANA88_ORG_ID,
    tenant_id: MANA88_TENANT_ID,
    full_name: FULL_NAME,
    email: TEST_EMAIL,
    company_name: 'Anderson Family Trust',
    phone: '+1 415 555 0123',
    investment_amount_usd: 250000,
    investment_amount_mxn: 4750000,
    investment_date: '2024-11-15',
    investment_class: 'B-1',
    distribution_start_month: '2025-04',
    pro_rata_pct: 1.25,
    signed_agreement_url: SAMPLE_PDF,
    signed_agreement_filename: 'MANA88-LP-Agreement-Anderson.pdf',
    agreement_signed_date: '2024-11-15',
    referral_source: 'Direct outreach',
    referral_contact_name: 'Corey Mangold',
    referral_contact_email: 'corey@manaakumal.com',
    status: 'active',
    registered_at: new Date().toISOString(),
    can_view_financials: true,
    can_view_construction: true,
    can_view_documents: true,
    can_download_reports: true,
  }

  if (existing.data?.id) {
    const { error } = await admin
      .from('platform_investor_profiles')
      .update(payload)
      .eq('id', existing.data.id)
    if (error) throw error
    console.log(`  updated (profile_id ${existing.data.id})`)
    return existing.data.id
  }
  const { data, error } = await admin
    .from('platform_investor_profiles')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw error
  console.log(`  inserted (profile_id ${data.id})`)
  return data.id
}

// ──────────────────────────────────────────────────────────────────────────
// 5. distributions — 24 months, 12 paid, 12 scheduled
// ──────────────────────────────────────────────────────────────────────────
async function seedDistributions(profileId) {
  console.log(`[5/6] platform_investor_distributions`)
  await admin.from('platform_investor_distributions').delete().eq('investor_profile_id', profileId)

  // Start April 2025 through March 2027 = 24 months
  // Today is 2026-04-21 — months before 2026-04 are paid, April onward is scheduled
  const rows = []
  let month = new Date(2025, 3, 1) // April 2025 (month index 3)
  const today = new Date(2026, 3, 21) // sync with system date
  for (let i = 0; i < 24; i++) {
    const y = month.getFullYear()
    const m = month.getMonth() + 1
    const monthKey = `${y}-${String(m).padStart(2, '0')}`

    const baseEstimate = 1800 + i * 30 // rising slightly over time
    const isPast = month < new Date(today.getFullYear(), today.getMonth(), 1)

    if (isPast) {
      // Paid: actual is within +/- 5% of estimate
      const jitter = 0.95 + Math.random() * 0.1
      rows.push({
        investor_profile_id: profileId,
        org_id: MANA88_ORG_ID,
        month: monthKey,
        estimated_amount_usd: baseEstimate,
        actual_amount_usd: Math.round(baseEstimate * jitter * 100) / 100,
        payment_date: `${monthKey}-05`, // paid on the 5th of each month
        payment_reference: `WIRE-${y}${String(m).padStart(2, '0')}-7432`,
        payment_method: 'wire',
        status: 'paid',
      })
    } else {
      rows.push({
        investor_profile_id: profileId,
        org_id: MANA88_ORG_ID,
        month: monthKey,
        estimated_amount_usd: baseEstimate,
        status: 'scheduled',
      })
    }

    month.setMonth(month.getMonth() + 1)
  }

  const { error } = await admin.from('platform_investor_distributions').insert(rows)
  if (error) throw error
  console.log(`  ${rows.length} rows inserted (${rows.filter((r) => r.status === 'paid').length} paid, ${rows.filter((r) => r.status === 'scheduled').length} scheduled)`)
}

// ──────────────────────────────────────────────────────────────────────────
// 6. documents
// ──────────────────────────────────────────────────────────────────────────
async function seedDocuments(profileId) {
  console.log(`[6/6] platform_investor_documents`)
  // Clear out anything previously seeded for this investor
  await admin
    .from('platform_investor_documents')
    .delete()
    .eq('investor_profile_id', profileId)

  // Also clear the org-wide test rows so the page stays clean on reruns
  await admin
    .from('platform_investor_documents')
    .delete()
    .eq('org_id', MANA88_ORG_ID)
    .is('investor_profile_id', null)
    .ilike('title', '[TEST]%')

  const docs = [
    {
      investor_profile_id: profileId,
      org_id: MANA88_ORG_ID,
      document_type: 'agreement',
      title: '[TEST] Signed LP Agreement — John Anderson',
      description: 'Executed limited partnership agreement with all exhibits and schedules.',
      file_url: SAMPLE_PDF,
      filename: 'MANA88-LP-Agreement-Anderson.pdf',
      file_size_bytes: 487000,
      visible_to_investors: true,
    },
    {
      investor_profile_id: profileId,
      org_id: MANA88_ORG_ID,
      document_type: 'tax_document',
      title: '[TEST] 2025 Form K-1 — Anderson Family Trust',
      description: 'Your 2025 distributive share for tax filing. Consult your accountant.',
      file_url: SAMPLE_PDF,
      filename: 'MANA88-K1-2025-Anderson.pdf',
      file_size_bytes: 214000,
      report_year: 2025,
      visible_to_investors: true,
    },
    {
      org_id: MANA88_ORG_ID,
      document_type: 'quarterly_report',
      title: '[TEST] Q1 2026 Investor Report',
      description: 'Sales velocity, construction progress, and distribution outlook for Q1 2026.',
      file_url: SAMPLE_PDF,
      filename: 'MANA88-Q1-2026-Report.pdf',
      file_size_bytes: 2_140_000,
      report_month: '2026-03',
      visible_to_investors: true,
    },
    {
      org_id: MANA88_ORG_ID,
      document_type: 'quarterly_report',
      title: '[TEST] Q4 2025 Investor Report',
      description: 'Year-end review and 2026 project outlook.',
      file_url: SAMPLE_PDF,
      filename: 'MANA88-Q4-2025-Report.pdf',
      file_size_bytes: 2_050_000,
      report_month: '2025-12',
      visible_to_investors: true,
    },
    {
      org_id: MANA88_ORG_ID,
      document_type: 'annual_report',
      title: '[TEST] 2025 Annual Report',
      description: 'Full-year financial performance, audited statements, and 2026 strategy.',
      file_url: SAMPLE_PDF,
      filename: 'MANA88-Annual-2025.pdf',
      file_size_bytes: 4_820_000,
      report_year: 2025,
      visible_to_investors: true,
    },
    {
      org_id: MANA88_ORG_ID,
      document_type: 'financial_statement',
      title: '[TEST] March 2026 Financial Statement',
      description: 'Monthly P&L, balance sheet, and cash flow statement.',
      file_url: SAMPLE_PDF,
      filename: 'MANA88-Financials-Mar-2026.pdf',
      file_size_bytes: 312_000,
      report_month: '2026-03',
      visible_to_investors: true,
    },
  ]

  const { error } = await admin.from('platform_investor_documents').insert(docs)
  if (error) throw error
  console.log(`  ${docs.length} documents inserted`)
}

// ──────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(60))
  console.log('Seeding test investor: ' + TEST_EMAIL)
  console.log('═'.repeat(60))

  const userId = await upsertAuthUser()
  await upsertProfile(userId)
  await upsertMembership(userId)
  const investorProfileId = await upsertInvestorProfile(userId)
  await seedDistributions(investorProfileId)
  await seedDocuments(investorProfileId)

  console.log('\n' + '═'.repeat(60))
  console.log('Done. Sign in:')
  console.log(`  URL:      https://login.terraia.io`)
  console.log(`  Email:    ${TEST_EMAIL}`)
  console.log(`  Password: ${TEST_PASSWORD}`)
  console.log(`  Portal:   https://clientes.terraia.io/investor/my-investment`)
  console.log('═'.repeat(60))
}

main().catch((err) => {
  console.error('\nSEED FAILED')
  console.error(err)
  process.exit(1)
})
