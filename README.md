# TerraIA Platform — System Architecture

> Comprehensive reference for the entire TerraIA / MANA 88 platform.
> Read this before making changes to any repo.

---

## What This Platform Is

TerraIA is a multi-app real estate development management platform originally built for MANA 88 Akumal (Quintana Roo, Mexico). It supports multiple projects/organizations with tenant isolation. The platform handles investor relations, client management, accounting, document storage, broker portals, and construction tracking.

---

## Repository Structure

The platform is **8 separate git repos** (not a monorepo) that share a common parent directory. All repos are under the `MANA88Akumal` GitHub org.

```
Application/                          ← common parent (NOT a git repo)
├── shared/          (.git)           ← @terraia/shared — auth, components, migrations, e2e tests
├── login-portal/    (.git)           ← Login + app selector + AI onboarding
├── investor-portal/ (.git)           ← Investor-facing proforma + scenarios
├── accounting/      (.git)           ← Bank transactions, facturas, reports
├── cms/             (.git)           ← Client/case management (TypeScript)
├── broker-portal/   (.git)           ← Broker lead tracking + commissions
├── vault/           (.git)           ← Document storage + sharing
├── marketing/       (.git)           ← Marketing landing page (terraia.io)
├── landing/         (no .git)        ← Static landing page (React 19, Tailwind 4)
├── CLAUDE.md                         ← Test suite instructions
└── DIEGO_CLAUDE_INSTRUCTIONS.md      ← Legacy instructions (outdated)
```

### GitHub Repos

| Local Folder | GitHub Repo | URL |
|---|---|---|
| `shared` | `terraia-shared` | `https://github.com/MANA88Akumal/terraia-shared` |
| `login-portal` | `terraia-login-portal` | `https://github.com/MANA88Akumal/terraia-login-portal` |
| `investor-portal` | `terraia-investor-portal` | `https://github.com/MANA88Akumal/terraia-investor-portal` |
| `accounting` | `terraia-accounting` | `https://github.com/MANA88Akumal/terraia-accounting` |
| `cms` | `terraia-cms` | `https://github.com/MANA88Akumal/terraia-cms` |
| `broker-portal` | `terraia-broker-portal` | `https://github.com/MANA88Akumal/terraia-broker-portal` |
| `vault` | `terraia-vault` | `https://github.com/MANA88Akumal/terraia-vault` |
| `marketing` | `terraia-marketing` | `https://github.com/MANA88Akumal/terraia-marketing` |

**All repos use `main` branch.**

> **Important**: Each app is its own git repo. When committing changes that span multiple apps (e.g., shared + login-portal), you must commit and push in each repo separately.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend (all apps) | React 18 + Vite + Tailwind CSS |
| CMS specifically | TypeScript + TanStack Query + Radix UI |
| Landing page | React 19 + Tailwind 4 (newer stack) |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |
| API servers | Express.js (upload-server port 3001, email-server port 3002) |
| Process manager | pm2 |
| Web server | Nginx + Let's Encrypt SSL |
| Cloud | AWS Lightsail (Ubuntu) |
| CI/CD | GitHub Actions → SSH deploy |
| E2E tests | Playwright (in shared repo) |

---

## Domain & Subdomain Mapping

All apps are served from subdomains of `terraia.io`. Legacy `manaakumal.com` subdomains are still supported via dynamic hostname detection.

| Subdomain | App | Server Doc Root |
|---|---|---|
| `login.terraia.io` | login-portal | `/var/www/login.terraia.io/` |
| `investors.terraia.io` | investor-portal | `/var/www/investors.terraia.io/` |
| `accounting.terraia.io` | accounting | `/var/www/accounting.terraia.io/` |
| `cms.terraia.io` | cms | `/var/www/cms.terraia.io/` |
| `vault.terraia.io` | vault | `/var/www/vault.terraia.io/` |
| `brokers.terraia.io` | broker-portal | `/var/www/brokers.terraia.io/` |
| `terraia.io` | marketing | `/var/www/terraia.io/` |

### Domain Detection Logic

```javascript
// In shared/src/auth/supabase.js and AuthProvider.jsx
const hostname = window.location.hostname
if (hostname.endsWith('.terraia.io') || hostname === 'terraia.io') {
  cookieDomain = '.terraia.io'
  loginUrl = 'https://login.terraia.io'
} else {
  cookieDomain = '.manaakumal.com'
  loginUrl = 'https://login.manaakumal.com'
}
```

---

## Authentication & Cross-Domain SSO

All apps share a single auth system via the login portal.

### Auth Flow

1. User visits any app (e.g., `accounting.terraia.io`)
2. AuthProvider checks: URL hash tokens → Supabase session → shared cookie → redirect to login
3. Login portal authenticates via Google OAuth (Supabase Auth)
4. On success, login portal sets `mana88_session` cookie on `.terraia.io` domain
5. Redirects back to the app with `#access_token=...&refresh_token=...` in URL hash
6. App's AuthProvider picks up tokens, establishes Supabase session

### Key Auth Files

| File | Purpose |
|---|---|
| `shared/src/auth/supabase.js` | Supabase client singleton + cookie helpers (`getSharedAuthCookie`, `setSharedAuthCookie`, etc.) |
| `shared/src/auth/AuthProvider.jsx` | Cross-domain auth provider — fetches profile + user_roles |
| `shared/src/auth/OrgProvider.jsx` | Organization context — loads memberships, handles org switching |
| `shared/src/auth/TenantProvider.jsx` | Tenant context |
| `shared/src/auth/ProtectedRoute.jsx` | Route guards (AdminRoute, StaffRoute, PublicRoute) |

### User Roles

Roles are stored in `user_roles` table (one row per user per org):

| Role | Access |
|---|---|
| `admin` / `platform_admin` / `tenant_admin` | Full access to all apps |
| `staff` / `finance` / `sales_mgr` | CMS + accounting |
| `broker` | Broker portal |
| `investor` | Investor portal |
| `viewer` | Read-only |

---

## Multi-Project / Multi-Tenant Architecture

Users can belong to multiple organizations (projects). Data isolation is enforced via Supabase RLS.

### How It Works

1. **`user_roles`** table has `UNIQUE(user_id, tenant_id)` — one role per user per org
2. **Active org selection** is stored in Supabase JWT `user_metadata.current_org_id`
3. **`get_current_tenant_id()`** SQL function reads `current_org_id` from JWT, falls back to first active role
4. **RLS policies** on all business tables use `tenant_id = get_current_tenant_id()` for isolation
5. **Client-side switching** calls `supabase.auth.updateUser({ data: { current_org_id } })` + `refreshSession()`

### Key SQL Functions

| Function | Purpose |
|---|---|
| `get_current_tenant_id()` | Returns the active tenant UUID from JWT metadata (RLS uses this) |
| `seed_organization(p_user_id, p_name, p_slug, p_settings)` | Creates org + tenant + membership + user_role, sets JWT metadata |
| `set_current_org(p_org_id)` | Server-side org switch with access verification |
| `update_org_settings(p_org_id, p_settings)` | Updates organization settings (SECURITY DEFINER, bypasses RLS) |

### Dual Identity: Organizations + Tenants

Every project has matching rows in both `organizations` and `tenants` tables **with the same UUID**. This is because:
- `organizations` + `organization_members` handle membership/roles
- `tenants` + `user_roles` handle RLS policies
- Both use the same ID (`org_id = tenant_id`)

Business tables have both `org_id` and `tenant_id` columns. A trigger (`sync_tenant_from_org`) auto-copies one to the other on INSERT/UPDATE.

---

## Supabase

- **URL**: `https://jmlxpcnkovxmadbygolp.supabase.co`
- **Project ID**: `jmlxpcnkovxmadbygolp`
- **Auth**: Google OAuth + Supabase Auth
- **Env vars**: Each app has `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Service key**: Used only in E2E tests and server-side scripts (`SUPABASE_SERVICE_KEY`)

### Key Tables

**Core / Multi-tenant:**
- `organizations` — project metadata (name, slug, plan, settings)
- `organization_members` — user ↔ org membership (org_id, user_id, role)
- `tenants` — tenant metadata (mirrors organizations, same UUID)
- `user_roles` — user ↔ tenant role assignment (user_id, tenant_id, role, app_access, is_active)
- `profiles` — user profile info (email, full_name, role, approved)

**CMS:**
- `lots` — inventory units/lots (lot_number, manzana, area_m2, sale_price_mxn, status)
- `clients` — buyer info (full_name, email, phone)
- `cases` — sale cases linking client to lot (client_id, lot_id, sale_price_mxn, status)
- `payment_schedule` — payment installments per case
- `cms_payments` — actual payments received
- `offers` / `offer_notes` — offers on lots
- `brokers` / `broker_leads` / `broker_commissions` — broker management
- `approvals` — approval workflow

**Accounting:**
- `accounting_bank_transactions` — bank transactions (transaction_date, bank, amount, concept)
- `accounting_bank_accounts` — bank account registry
- `accounting_facturas` / `accounting_factura_conceptos` / `accounting_factura_batches` — Mexican invoices
- `accounting_cash_log` — manual cash entries
- `accounting_categories` — transaction categorization
- `accounting_chart_of_accounts` — COA (country-aware: Mexico IVA/SAT, Panama ITBMS/DGI)
- `accounting_vendors` — vendor registry

**Investor Portal:**
- `saved_scenarios` — proforma scenarios with summary_json
- `scenario_projections` — monthly cash flow projections
- `scenario_config` / `scenario_financing_mix` — scenario parameters
- `cap_table` / `investment_tranches` — investor cap table
- `pricing_phases` / `financing_plans` — pricing models

**Vault:**
- `vault_files` — uploaded documents
- `vault_access_log` / `vault_shared_links` / `vault_checklists` — access control

**Construction:**
- `construction_phases` — project phases with budgets
- `construction_photos` / `construction_draws` — progress tracking

**AI Engine:**
- `analysis_runs` — AI analysis executions
- `project_findings` — AI-generated insights
- `ai_dialogues` — conversation history

### Column Naming Conventions

- Date columns: `transaction_date` (NOT `date`)
- Bank name: `bank` (NOT `bank_name`)
- Description: `concept` (short) + `detailed_description` (full)
- Currency: `'MXN'` or `'USD'` — always string, always uppercase
- Transaction type: `'DEPOSIT'` / `'WITHDRAWAL'` — always uppercase
- Status on lots: `'available'`, `'reserved'`, `'sold'`
- CMS payment types: `'reserva'`, `'enganche'`, `'mensualidad'`, `'entrega'`

---

## Database Migrations

Migrations are in `shared/migrations/`, numbered 006+. Run them in order against Supabase SQL Editor.

| Migration | Purpose |
|---|---|
| `006_multi_tenant.sql` | Core multi-tenant: tenants table, tenant_id on all tables, RLS policies, `get_current_tenant_id()` |
| `007_fix_seed_organization.sql` | Fix seed_organization to set both org_id and tenant_id |
| `007_vault_broker_construction.sql` | Vault, broker, and construction tables |
| `008_fix_broker_portal.sql` | Broker portal RLS fixes |
| `008_onboarding_permissions.sql` | Onboarding RLS permissions |
| `009_ai_engine_permissions.sql` | AI engine table permissions |
| `010_benchmark_quality.sql` | Benchmark quality scoring |
| `011_ai_dialogue.sql` | AI dialogue system tables |
| `012_fix_seed_org_upsert.sql` | Fix seed_organization upsert (had UNIQUE(user_id) conflict) |
| `013_sync_tenant_org_id.sql` | Auto-sync trigger: org_id ↔ tenant_id on all tables |
| `014_multi_project.sql` | Multi-project: drop UNIQUE(user_id), JWT-based org switching, fixed seed_organization |

---

## Shared Package (@terraia/shared)

The shared package provides cross-app components, auth, i18n, and theming.

### Installation

Apps install it via GitHub:
```json
{
  "@terraia/shared": "github:MANA88Akumal/terraia-shared"
}
```

In local dev, each app's `vite.config.js` aliases it to the sibling directory:
```javascript
const sharedLocal = path.resolve(__dirname, '../shared/src/index.js')
if (fs.existsSync(sharedLocal)) {
  alias['@terraia/shared'] = sharedLocal
}
```

### Exports

**Components:** AppShell, Sidebar, TopBar, AppSwitcher, NotificationBell, AccountMenu, LanguageToggle, ThemeToggle, icons

**Auth:** AuthProvider, AuthContext, useAuth, TenantProvider, useTenant, OrgProvider, useOrganization, ProtectedRoute, AdminRoute, StaffRoute, PublicRoute, getSupabaseClient, getSharedAuthCookie, setSharedAuthCookie, clearSharedAuthCookie, isTokenExpired, parseJwtPayload

**i18n:** I18nProvider, I18nContext, useI18n

**Theme:** palette, getRuntimePalette, LOGO_URL, LOGO_LIGHT_URL, themeColors, getTheme, setTheme, toggleTheme

### Important Notes

- Tailwind arbitrary value classes (e.g., `text-[0.75rem]`) do NOT work in shared components because app Tailwind configs don't scan shared. Use inline styles instead.
- After changing shared, **all apps that depend on it need `npm install`** to pick up the new version (or just use the Vite alias in local dev).

---

## Onboarding Flow

New projects go through an AI-assisted onboarding flow in the login portal.

### Steps

1. **Language Selection** (step 0) — Spanish or English
2. **AI Chat** (step 1) — Claude-powered conversation extracts project details (company name, location, country, currency, lot count, bank accounts, etc.)
3. **File Import** (step 2) — Upload proforma Excel, bank statements (CSV/XML), vendor lists, unit matrices. AI classifies and parses files.
4. **Ready** (step 3) — Summary checklist of what was created

### Key Onboarding Files

| File | Purpose |
|---|---|
| `login-portal/src/hooks/useOnboarding.jsx` | State machine (step, projectData, chatHistory, files, stats) with localStorage persistence |
| `login-portal/src/lib/onboardingSeeder.js` | `seedOrganization()` — creates org via RPC, seeds COA, lots, bank accounts, broker record |
| `login-portal/src/hooks/useProjectAnalysis.js` | Proforma analysis — parses Excel, runs AI analysis, seeds lots/construction/scenarios |
| `login-portal/src/lib/ai/parsers/normalizeProject.js` | Excel proforma parser — extracts revenue, costs, cash flow, units |

### What Seeding Creates

1. Organization + tenant (same UUID)
2. Organization membership (owner role)
3. User role (admin, all app access)
4. Chart of accounts (country-aware: Mexico or Panama)
5. Lots/units (from proforma or AI chat data)
6. Bank accounts (if mentioned in chat)
7. Broker record for the owner
8. Construction phases (from proforma budget)
9. Baseline scenario + projections (from proforma cash flow)

---

## Deployment

### GitHub Actions CI/CD

Each app has `.github/workflows/deploy.yml` that:
1. Clones `shared` as a sibling directory (for build-time resolution)
2. Runs `npm ci && npm run build`
3. Uploads `dist/` to the server via SSH/SCP
4. Triggers E2E tests in the shared repo

### Server Details

- **Host**: AWS Lightsail (Ubuntu)
- **SSH**: `ssh -i TerraIA.pem ubuntu@<host>` (IP in GitHub secrets)
- **Web server**: Nginx with Let's Encrypt SSL
- **Doc roots**: `/var/www/<subdomain>/`
- **API servers**: pm2-managed Express.js on ports 3001 (upload) and 3002 (email)

### Manual Deploy

```bash
cd <app-directory>
npm run build
scp -i TerraIA.pem dist/index.html ubuntu@<host>:/var/www/<app>.terraia.io/
scp -i TerraIA.pem dist/assets/* ubuntu@<host>:/var/www/<app>.terraia.io/assets/
```

> **CRITICAL**: Use `dist/assets/*` (glob), NOT `scp -r dist/assets/`. The recursive flag silently fails on existing directories.

### API Servers

| Server | Port | Path | Purpose |
|---|---|---|---|
| upload-server | 3001 | `/api/upload` | Factura/receipt/statement file uploads |
| email-server | 3002 | `/api/send-email`, `/api/health`, `/api/planning` | Email notifications + planning API |

Nginx proxies these paths to the Node.js processes.

---

## E2E Tests

Playwright tests live in `shared/e2e/` and cover cross-app flows.

```bash
cd shared
npx playwright test --config=e2e/playwright.config.ts
```

### Test Suite

- **Altavista walkthrough** — comprehensive 6-app test creating a full project and testing all portals
- **Cross-app SSO** — auth cookie propagation across subdomains
- **Full onboarding suite** (`CLAUDE.md`) — 5 synthetic companies testing proforma parsing, bank imports, RLS isolation

### Environment

Tests need these env vars:
```
VITE_SUPABASE_URL=https://jmlxpcnkovxmadbygolp.supabase.co
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
```

---

## Key Conventions

| Convention | Details |
|---|---|
| Language | Spanish primary, English secondary |
| Currency display | Always show suffix: `$1,234.56 MXN` |
| Factura PDF path | `/facturas/{year}/{RFC}_Factura_{folio}_{YYYYMMDD}.pdf` |
| Lot format | `42-C6` (number includes manzana) or `U-001` (unit) |
| CMS payment types | `reserva`, `enganche`, `mensualidad`, `entrega` |
| Theme colors | Primary: `#ce9e62` (gold), Secondary: `#2c2c2c` (dark), Accent: `#c1432e` (red), Background: `#faf8f5` (warm white) |

---

## Troubleshooting

### macOS Icon files corrupting git

Finder creates invisible `Icon\r` files that can end up inside `.git/refs/` and break fetch/pull. Fix:

```bash
find .git -name "Icon?" -delete
rm -f .git/gc.log
```

### RLS blocking inserts

If inserts silently fail, check:
1. Both `org_id` AND `tenant_id` are set (trigger `sync_tenant_from_org` handles this, but verify)
2. `get_current_tenant_id()` returns the correct UUID for the current user
3. User's JWT has `current_org_id` in metadata

### Cross-domain auth not working

1. Check cookie domain matches (`.terraia.io` vs `.manaakumal.com`)
2. Verify `mana88_session` cookie is set in browser dev tools
3. Check token expiry — tokens expire, AuthProvider checks every 30s

### Shared package changes not reflected

1. In local dev: Vite alias should auto-resolve — check `vite.config.js`
2. In production: Run `npm install` in the app to pull latest from GitHub
3. Tailwind classes in shared won't work — use inline styles
