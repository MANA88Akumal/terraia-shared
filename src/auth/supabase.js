import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jmlxpcnkovxmadbygolp.supabase.co'

// Read anon key from env or fallback to MANA 88 default
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || ''

let _client = null

/**
 * Get or create the Supabase client singleton.
 * Must be called after env is available (not at module top-level in all cases).
 */
export function getSupabaseClient(anonKey) {
  if (_client) return _client
  const key = anonKey || supabaseAnonKey
  if (!key) throw new Error('Missing Supabase anon key')
  _client = createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  })
  return _client
}

// Cookie helpers for cross-domain session sharing
const COOKIE_NAME = 'mana88_session'
const COOKIE_DOMAIN = '.terraia.io'

export function setSharedAuthCookie(session) {
  if (!session) return
  const data = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  })
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(data)}; path=/; domain=${COOKIE_DOMAIN}; max-age=${60 * 60 * 24 * 30}; secure; samesite=lax`
}

export function getSharedAuthCookie() {
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === COOKIE_NAME && value) {
      try { return JSON.parse(decodeURIComponent(value)) } catch { return null }
    }
  }
  return null
}

export function clearSharedAuthCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; domain=${COOKIE_DOMAIN}; max-age=0; secure; samesite=lax`
}

export function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Date.now() >= payload.exp * 1000 - 60000 // 60s buffer
  } catch {
    return true
  }
}

export function parseJwtPayload(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}
