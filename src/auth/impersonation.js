/**
 * Impersonation helpers — platform admins can "sign in as" another user
 * to debug issues from the user's perspective.
 *
 * Flow:
 *   1. Admin clicks Impersonate on /users/:id
 *   2. Frontend saves current session to a cookie on .terraia.io
 *   3. POST /api/admin/impersonate → server returns a magic-link action_link
 *   4. window.location.href = action_link
 *   5. Supabase sets the target's session and redirects back to redirectTo
 *   6. AuthProvider in the destination app picks up the new session
 *   7. ImpersonationBanner in the shell shows "Impersonating X — exit"
 *   8. On exit, restore the saved admin session and reload
 */
import {
  getSharedAuthCookie,
  setSharedAuthCookie,
  getSupabaseClient,
} from './supabase.js'

const IMPERSONATOR_COOKIE = 'mana88_impersonator'
const IMPERSONATOR_EMAIL_COOKIE = 'mana88_impersonator_email'

function cookieDomain() {
  const host = window.location.hostname
  if (host.endsWith('.terraia.io') || host === 'terraia.io') return '.terraia.io'
  return '.manaakumal.com'
}

function writeCookie(name, value, maxAgeSeconds = 60 * 60 * 2) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  const domain = cookieDomain()
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; domain=${domain}; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

function clearCookie(name) {
  const domain = cookieDomain()
  document.cookie = `${name}=; path=/; domain=${domain}; max-age=0`
}

/**
 * Called from the admin portal when the admin clicks Impersonate.
 * Expects the current user to be a platform_admin; server enforces that too.
 */
export async function startImpersonation({ targetUserId, redirectTo, apiBaseUrl }) {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('No active session — sign in as a platform admin first.')
  }

  // Save the admin's session BEFORE the impersonation redirect happens
  writeCookie(
    IMPERSONATOR_COOKIE,
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      admin_email: session.user?.email,
    }),
  )
  writeCookie(IMPERSONATOR_EMAIL_COOKIE, session.user?.email || '')

  const base = apiBaseUrl || 'https://api.terraia.io'
  const resp = await fetch(`${base}/api/admin/impersonate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ target_user_id: targetUserId, redirect_to: redirectTo }),
  })
  const payload = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    // Clean up cookies if the request failed so we don't leave a stale banner
    clearCookie(IMPERSONATOR_COOKIE)
    clearCookie(IMPERSONATOR_EMAIL_COOKIE)
    throw new Error(payload.error || `Impersonation failed (${resp.status})`)
  }
  if (!payload.action_link) {
    throw new Error('Server did not return an action link')
  }
  window.location.href = payload.action_link
}

/**
 * Called from the banner — restores the saved admin session and reloads.
 */
export async function stopImpersonation() {
  const raw = readCookie(IMPERSONATOR_COOKIE)
  clearCookie(IMPERSONATOR_COOKIE)
  clearCookie(IMPERSONATOR_EMAIL_COOKIE)
  if (!raw) {
    window.location.reload()
    return
  }
  try {
    const saved = JSON.parse(raw)
    setSharedAuthCookie({
      access_token: saved.access_token,
      refresh_token: saved.refresh_token,
      expires_at: saved.expires_at,
    })
    try {
      const supabase = getSupabaseClient()
      await supabase.auth.setSession({
        access_token: saved.access_token,
        refresh_token: saved.refresh_token,
      })
    } catch {
      /* fall through to reload — cookie is enough for AuthProvider to re-read */
    }
  } catch {
    /* ignore */
  }
  window.location.href = cookieDomain() === '.terraia.io'
    ? 'https://admin.terraia.io/users'
    : '/'
}

/**
 * UI reads this to render the banner.
 */
export function getImpersonationState() {
  const raw = readCookie(IMPERSONATOR_COOKIE)
  if (!raw) return null
  try {
    const saved = JSON.parse(raw)
    return { adminEmail: saved.admin_email }
  } catch {
    return null
  }
}
