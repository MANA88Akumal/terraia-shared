import { createContext, useState, useEffect, useCallback } from 'react'
import {
  getSupabaseClient,
  getSharedAuthCookie,
  clearSharedAuthCookie,
  setSharedAuthCookie,
  isTokenExpired,
  parseJwtPayload,
} from './supabase.js'

export const AuthContext = createContext(null)

function getLoginUrl() {
  const hostname = window.location.hostname
  if (hostname.endsWith('.terraia.io') || hostname === 'terraia.io') return 'https://login.terraia.io'
  return 'https://login.manaakumal.com'
}
const LOGIN_URL = getLoginUrl()

/**
 * Unified auth provider — works across all MANA 88 apps.
 *
 * Auth flow:
 * 1. Check URL hash for tokens (from login portal redirect)
 * 2. Check existing Supabase session
 * 3. Check shared cookie
 * 4. On failure → redirect to login portal
 *
 * Queries `profiles` for user info and `user_roles` for tenant role.
 */
export function AuthProvider({ appId, onAuthenticated, children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const redirectToLogin = useCallback(() => {
    clearSharedAuthCookie()
    const returnUrl = encodeURIComponent(window.location.href)
    window.location.href = `${LOGIN_URL}?returnTo=${returnUrl}`
  }, [])

  /** Fetch profile from `profiles` table + role from `user_roles` */
  const fetchProfile = useCallback(async (supabase, userId) => {
    // Get profile info
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, email, full_name, company, phone, role, approved, system_access')
      .eq('id', userId)
      .single()

    // Get all active roles from user_roles (multi-tenant / multi-project)
    const { data: allRoles } = await supabase
      .from('user_roles')
      .select('role, app_access, is_active, tenant_id')
      .eq('user_id', userId)
      .eq('is_active', true)

    // Determine the active role: prefer the one matching JWT current_org_id
    const { data: { session } } = await supabase.auth.getSession()
    const currentOrgId = session?.user?.user_metadata?.current_org_id
    const roleData = allRoles?.find(r => r.tenant_id === currentOrgId)
      || allRoles?.[0]
      || null

    // Merge: prefer user_roles.role if available, fall back to profiles.role
    const merged = {
      ...(profileData || {}),
      id: profileData?.id || userId,
      role: roleData?.role || profileData?.role || 'viewer',
      app_access: roleData?.app_access || [],
      tenant_id: roleData?.tenant_id || null,
      allRoles: allRoles || [],
      approved: profileData?.approved !== false, // default true if no profile
    }

    return merged
  }, [])

  // Initial auth check
  useEffect(() => {
    const init = async () => {
      let supabase
      try {
        supabase = getSupabaseClient()
      } catch {
        // No anon key — fall back to JWT-only mode
        supabase = null
      }

      const hash = window.location.hash
      const cookieSession = getSharedAuthCookie()

      // 1. Check URL hash tokens (from login portal redirect)
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1))
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')

        if (access_token) {
          if (isTokenExpired(access_token)) { redirectToLogin(); return }

          const payload = parseJwtPayload(access_token)
          if (!payload) { redirectToLogin(); return }

          const userData = { id: payload.sub, email: payload.email }
          setUser(userData)

          // Store in cookie
          const expires_at = params.get('expires_at')
          setSharedAuthCookie({ access_token, refresh_token, expires_at })
          window.history.replaceState(null, '', window.location.pathname)

          // Establish Supabase session + fetch profile
          if (supabase && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token })
            const prof = await fetchProfile(supabase, payload.sub)
            setProfile(prof)
          } else {
            setProfile({ id: payload.sub, email: payload.email, role: 'admin', approved: true })
          }

          onAuthenticated?.({ user: userData, token: access_token })
        }
        setLoading(false)
        return
      }

      // 2. Check existing Supabase session
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          // Refresh to pick up latest user_metadata (e.g. current_org_id from org switch on another app)
          const { data: refreshed } = await supabase.auth.refreshSession()
          const activeSession = refreshed?.session || session
          if (refreshed?.session) setSharedAuthCookie(refreshed.session)

          const userData = { id: activeSession.user.id, email: activeSession.user.email }
          setUser(userData)
          const prof = await fetchProfile(supabase, activeSession.user.id)
          setProfile(prof)
          setLoading(false)
          onAuthenticated?.({ user: userData, token: activeSession.access_token })
          return
        }
      }

      // 3. Check shared cookie
      if (cookieSession?.access_token) {
        if (isTokenExpired(cookieSession.access_token)) { redirectToLogin(); return }

        const payload = parseJwtPayload(cookieSession.access_token)
        if (!payload) { redirectToLogin(); return }

        const userData = { id: payload.sub, email: payload.email }
        setUser(userData)

        // Establish Supabase session from cookie, then refresh to get latest metadata
        if (supabase && cookieSession.refresh_token) {
          await supabase.auth.setSession({
            access_token: cookieSession.access_token,
            refresh_token: cookieSession.refresh_token,
          })
          // Refresh to pick up latest user_metadata (e.g. current_org_id from org switch)
          const { data: refreshed } = await supabase.auth.refreshSession()
          if (refreshed?.session) {
            setSharedAuthCookie(refreshed.session)
            const prof = await fetchProfile(supabase, payload.sub)
            setProfile(prof)
          } else {
            setProfile({ id: payload.sub, email: payload.email, role: 'admin', approved: true })
          }
        } else {
          setProfile({ id: payload.sub, email: payload.email, role: 'admin', approved: true })
        }

        onAuthenticated?.({ user: userData, token: cookieSession.access_token })
        setLoading(false)
        return
      }

      // 4. No session — redirect to login
      redirectToLogin()
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for auth state changes (Supabase)
  useEffect(() => {
    let supabase
    try { supabase = getSupabaseClient() } catch { return }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser({ id: session.user.id, email: session.user.email })
        fetchProfile(supabase, session.user.id).then(setProfile)
      } else if (event === 'SIGNED_OUT') {
        clearSharedAuthCookie()
        window.location.href = LOGIN_URL
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  // Periodic token expiry check
  useEffect(() => {
    const interval = setInterval(() => {
      const cookieSession = getSharedAuthCookie()
      if (cookieSession?.access_token && isTokenExpired(cookieSession.access_token)) {
        redirectToLogin()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [redirectToLogin])

  const signInWithGoogle = useCallback(async () => {
    // Redirect to login portal — all auth goes through the central portal
    const returnUrl = encodeURIComponent(window.location.href)
    window.location.href = `${LOGIN_URL}?returnTo=${returnUrl}`
  }, [])

  const signOut = useCallback(async () => {
    clearSharedAuthCookie()
    try {
      const supabase = getSupabaseClient()
      await supabase.auth.signOut()
    } catch { /* no client */ }
    window.location.href = LOGIN_URL
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    try {
      const supabase = getSupabaseClient()
      const prof = await fetchProfile(supabase, user.id)
      setProfile(prof)
    } catch { /* ignore */ }
  }, [user, fetchProfile])

  const role = profile?.role || 'viewer'
  const isAdminRole = role === 'admin' || role === 'platform_admin' || role === 'tenant_admin'
  const isStaffRole = isAdminRole || role === 'staff' || role === 'finance' || role === 'sales_mgr'

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      userRole: role,
      isApproved: !!profile?.approved,
      isAdmin: isAdminRole,
      isStaff: isStaffRole,
      isBroker: role === 'broker',
      isInvestor: role === 'investor',
      hasCmsAccess: isStaffRole || role === 'broker' || role === 'legal' || profile?.system_access?.cms === true,
      appAccess: profile?.app_access || [],
      signInWithGoogle,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
