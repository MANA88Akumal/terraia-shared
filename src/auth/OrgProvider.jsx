import { createContext, useEffect, useState } from 'react'
import { useAuth } from './useAuth.js'

export const OrgContext = createContext(null)

const STORAGE_KEY = 'terraia_current_org'

/**
 * Organization context provider.
 * Loads the authenticated user's organization membership(s) from
 * the `organization_members` table. For single-org users (most cases),
 * sets the org automatically. For multi-org users, checks localStorage
 * for a previously selected org.
 *
 * Provides `orgId` for use in all Supabase INSERT operations.
 */
export function OrgProvider({ children }) {
  const { user, profile } = useAuth()
  const [org, setOrg] = useState(null)
  const [allOrgs, setAllOrgs] = useState([])
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadOrg() {
      try {
        const { getSupabaseClient } = await import('./supabase.js')
        const supabase = getSupabaseClient()

        const { data, error } = await supabase
          .from('organization_members')
          .select('org_id, role, organizations(id, name, slug, plan, plan_status, settings)')
          .eq('user_id', user.id)

        if (error || !data || cancelled) {
          setLoading(false)
          return
        }

        const memberships = data.filter(d => d.organizations)

        if (memberships.length === 0) {
          setLoading(false)
          return
        }

        setAllOrgs(memberships.map(m => ({ ...m.organizations, role: m.role })))

        if (memberships.length === 1) {
          const m = memberships[0]
          setOrg({ ...m.organizations, role: m.role })
          setUserRole(m.role)
        } else {
          // Multi-org: check JWT current_org_id first (cross-domain), then localStorage
          const jwtOrgId = user?.user_metadata?.current_org_id
          const lastOrgId = localStorage.getItem(STORAGE_KEY)

          // If JWT org differs from localStorage, the user switched orgs on another app.
          // Clear Supabase session cache and reload so the app re-initializes from the
          // shared cookie with the correct org's token.
          if (jwtOrgId && lastOrgId && jwtOrgId !== lastOrgId) {
            localStorage.setItem(STORAGE_KEY, jwtOrgId)
            // Clear Supabase's cached session so it falls through to cookie on reload
            for (const key of Object.keys(localStorage)) {
              if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key)
              }
            }
            window.location.reload()
            return
          }

          const match = memberships.find(m => m.org_id === jwtOrgId)
            || memberships.find(m => m.org_id === lastOrgId)
            || memberships[0]
          setOrg({ ...match.organizations, role: match.role })
          setUserRole(match.role)
          if (match.org_id) localStorage.setItem(STORAGE_KEY, match.org_id)
        }
      } catch {
        // Org tables may not exist yet during migration — fail silently
      }
      if (!cancelled) setLoading(false)
    }

    loadOrg()
    return () => { cancelled = true }
  }, [user?.id])

  async function switchOrg(orgId) {
    const match = allOrgs.find(o => o.id === orgId)
    if (match) {
      setOrg(match)
      setUserRole(match.role)
      localStorage.setItem(STORAGE_KEY, orgId)

      // Persist to JWT so RLS picks it up via get_current_tenant_id()
      try {
        const { getSupabaseClient, setSharedAuthCookie } = await import('./supabase.js')
        const supabase = getSupabaseClient()
        const { error } = await supabase.auth.updateUser({
          data: { current_org_id: orgId }
        })
        if (!error) {
          const { data } = await supabase.auth.refreshSession()
          // Update shared cookie so other apps pick up the new JWT
          if (data?.session) {
            setSharedAuthCookie(data.session)
          }
        }
      } catch {
        // Non-critical — localStorage fallback still works for UI
      }
    }
  }

  return (
    <OrgContext.Provider value={{
      org,
      orgId: org?.id || null,
      tenantId: profile?.tenant_id || org?.id || null,
      orgName: org?.name || null,
      orgSlug: org?.slug || null,
      userRole,
      allOrgs,
      switchOrg,
      loading,
    }}>
      {children}
    </OrgContext.Provider>
  )
}
