import { createContext, useEffect, useState } from 'react'
import { useAuth } from './useAuth.js'

export const TenantContext = createContext(null)

function detectDomain() {
  const hostname = window.location.hostname
  if (hostname.endsWith('.terraia.io') || hostname === 'terraia.io') return 'terraia.io'
  return 'manaakumal.com'
}

const DEFAULT_TENANT = {
  id: null,
  slug: 'mana88',
  name: 'MANA 88 Akumal',
  domain: detectDomain(),
  logo_url: 'https://login.terraia.io/logo-dark.png',
  brand_primary: '#ce9e62',
  brand_secondary: '#2c2c2c',
  brand_accent: '#c1432e',
  brand_bg: '#faf8f5',
  enabled_apps: ['accounting', 'cms', 'investors'],
  settings: {},
}

/**
 * Tenant context + CSS custom property branding.
 * Fetches tenant from DB via user's tenant_id from auth profile.
 * Falls back to MANA 88 defaults if query fails.
 */
export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(DEFAULT_TENANT)
  const { profile } = useAuth()

  // Fetch tenant from DB when profile has tenant_id
  useEffect(() => {
    if (!profile?.tenant_id) return

    let cancelled = false
    async function fetchTenant() {
      try {
        const { getSupabaseClient } = await import('./supabase.js')
        const supabase = getSupabaseClient()
        const { data } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profile.tenant_id)
          .single()

        if (data && !cancelled) {
          setTenant(data)
        }
      } catch {
        // Keep defaults
      }
    }
    fetchTenant()
    return () => { cancelled = true }
  }, [profile?.tenant_id])

  // Apply brand CSS variables whenever tenant changes
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--mana-gold', tenant.brand_primary)
    root.style.setProperty('--mana-black', tenant.brand_secondary)
    root.style.setProperty('--mana-red', tenant.brand_accent)
    root.style.setProperty('--mana-cream', tenant.brand_bg)
  }, [tenant])

  return (
    <TenantContext.Provider value={{ tenant, setTenant }}>
      {children}
    </TenantContext.Provider>
  )
}
