/**
 * Import the permissions matrix XLSX into platform_role_resources +
 * platform_role_permissions.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node shared/e2e/import-permissions-matrix.mjs [path-to-xlsx]
 *
 * Default input: /Users/coreymangold/Downloads/terraia-permissions-matrix (1).xlsx
 *
 * Idempotent: upserts resources by resource_key, upserts permissions by
 * (role, resource_key). Safe to re-run after editing the XLSX.
 */
import ExcelJS from '/Users/coreymangold/Desktop/TerraIA/Application/investor-portal/node_modules/exceljs/lib/exceljs.nodejs.js'
import { createClient } from '/Users/coreymangold/Desktop/TerraIA/Application/shared/node_modules/@supabase/supabase-js/dist/index.mjs'

const xlsxPath = process.argv[2] || '/Users/coreymangold/Downloads/terraia-permissions-matrix (1).xlsx'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const admin = createClient('https://jmlxpcnkovxmadbygolp.supabase.co', SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Map sheet name → app slug used as the key prefix
const SHEET_APP = {
  'Owner Portal': 'owner-portal',
  'Investor Portal (admin)': 'investor-portal',
  'Accounting': 'accounting',
  'CMS': 'cms',
  'Broker Portal': 'broker-portal',
  'Vault': 'vault',
  'Construction': 'construction',
  'Login Portal': 'login-portal',
  'Data Tables (writes)': 'data-tables',
}

// Symbol → normalized access value stored in DB
const ACCESS_MAP = {
  '✓': 'full',
  'R': 'read',
  'X': 'none',
  '—': 'na',
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function buildKey(app, route, label, area) {
  // Prefer route (starts with /) for stability; fall back to slugified label
  const slug = route && route.trim() && route !== '—'
    ? route.trim().replace(/\s+/g, '')
    : slugify(label)
  const areaSlug = slugify(area || '')
  // Include area when it helps disambiguate (most routes are unique; some
  // action rows share the same label across areas, e.g. "Delete" under
  // multiple sections)
  if (areaSlug && !slug.startsWith('/')) {
    return `${app}:${areaSlug}:${slug}`
  }
  return `${app}:${slug}`
}

async function importSheet(ws, app) {
  // Row 1 = meta row (role keys), row 2 = header row with role labels, rows 3+ = data
  const roleRow = ws.getRow(1)
  const roles = []
  roleRow.eachCell((cell, i) => {
    if (i > 3) roles.push(String(cell.value || '').trim())
  })

  const resources = []
  const permissions = []
  let sortOrder = 0

  ws.eachRow((row, rowIdx) => {
    if (rowIdx <= 2) return
    const area = String(row.getCell(1).value || '').trim()
    const label = String(row.getCell(2).value || '').trim()
    const route = String(row.getCell(3).value || '').trim()
    if (!label) return

    const key = buildKey(app, route, label, area)
    sortOrder++
    resources.push({
      resource_key: key,
      app,
      area: area || null,
      label,
      route: route || null,
      sort_order: sortOrder,
    })

    for (let col = 4; col < 4 + roles.length; col++) {
      const role = roles[col - 4]
      if (!role) continue
      const raw = String(row.getCell(col).value || '').trim()
      const access = ACCESS_MAP[raw]
      if (!access) continue
      permissions.push({ role, resource_key: key, access })
    }
  })

  return { resources, permissions }
}

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(xlsxPath)

  const allResources = []
  const allPermissions = []

  for (const [sheetName, app] of Object.entries(SHEET_APP)) {
    const ws = wb.getWorksheet(sheetName)
    if (!ws) {
      console.log(`(skip: sheet "${sheetName}" not found)`)
      continue
    }
    const { resources, permissions } = await importSheet(ws, app)
    allResources.push(...resources)
    allPermissions.push(...permissions)
    console.log(`${sheetName}: ${resources.length} resources, ${permissions.length} permission cells`)
  }

  console.log(`\nTotal (raw): ${allResources.length} resources, ${allPermissions.length} permission cells`)

  // Dedupe by resource_key (keep first) and (role, resource_key) (keep last)
  const seenResources = new Map()
  for (const r of allResources) if (!seenResources.has(r.resource_key)) seenResources.set(r.resource_key, r)
  const uniqueResources = Array.from(seenResources.values())

  const seenPerms = new Map()
  for (const p of allPermissions) seenPerms.set(`${p.role}:${p.resource_key}`, p)
  const uniquePermissions = Array.from(seenPerms.values())

  const droppedR = allResources.length - uniqueResources.length
  const droppedP = allPermissions.length - uniquePermissions.length
  if (droppedR || droppedP) {
    console.log(`Dedupe: dropped ${droppedR} duplicate resources, ${droppedP} duplicate permission cells`)
  }

  const chunkSize = 200
  for (let i = 0; i < uniqueResources.length; i += chunkSize) {
    const chunk = uniqueResources.slice(i, i + chunkSize)
    const { error } = await admin
      .from('platform_role_resources')
      .upsert(chunk, { onConflict: 'resource_key' })
    if (error) throw error
  }
  console.log(`✓ Resources upserted (${uniqueResources.length})`)

  for (let i = 0; i < uniquePermissions.length; i += chunkSize) {
    const chunk = uniquePermissions.slice(i, i + chunkSize)
    const { error } = await admin
      .from('platform_role_permissions')
      .upsert(chunk, { onConflict: 'role,resource_key' })
    if (error) throw error
  }
  console.log(`✓ Permissions upserted (${uniquePermissions.length})`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('IMPORT FAILED')
  console.error(err)
  process.exit(1)
})
