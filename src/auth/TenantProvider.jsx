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
  brand_palette: {},
  brand_logo_dark: null,
  brand_favicon_url: null,
  brand_font_heading: null,
  brand_font_body: null,
  brand_font_url: null,
  brand_hero_image_url: null,
  investor_portal_enabled: false,
  investor_portal_welcome_text: null,
}

/**
 * Tenant context + CSS custom property branding.
 * Fetches tenant from DB via user's tenant_id from auth profile.
 * Falls back to MANA 88 defaults if query fails.
 *
 * White-label support: reads brand_palette JSONB and applies all
 * palette keys as --brand-{key} CSS custom properties. Also loads
 * custom Google Fonts if brand_font_url is set, and updates
 * the favicon if brand_favicon_url is set.
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

    // Legacy vars (backward compat)
    root.style.setProperty('--mana-gold', tenant.brand_primary || '#ce9e62')
    root.style.setProperty('--mana-black', tenant.brand_secondary || '#2c2c2c')
    root.style.setProperty('--mana-red', tenant.brand_accent || '#c1432e')
    root.style.setProperty('--mana-cream', tenant.brand_bg || '#faf8f5')

    // Extended palette from brand_palette JSONB
    const palette = tenant.brand_palette || {}
    Object.entries(palette).forEach(([key, value]) => {
      // Convert camelCase to kebab: surfaceAlt -> surface-alt
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      root.style.setProperty(`--brand-${cssKey}`, value)
    })

    // Custom fonts
    if (tenant.brand_font_heading) {
      root.style.setProperty('--brand-font-heading', tenant.brand_font_heading)
    }
    if (tenant.brand_font_body) {
      root.style.setProperty('--brand-font-body', tenant.brand_font_body)
    }
  }, [tenant])

  // Load custom font CSS (Google Fonts or self-hosted)
  useEffect(() => {
    if (!tenant.brand_font_url) return
    const id = 'tenant-brand-font'
    if (document.getElementById(id)) {
      document.getElementById(id).href = tenant.brand_font_url
      return
    }
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = tenant.brand_font_url
    document.head.appendChild(link)
  }, [tenant.brand_font_url])

  // Custom favicon
  useEffect(() => {
    if (!tenant.brand_favicon_url) return
    let link = document.querySelector("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = tenant.brand_favicon_url
  }, [tenant.brand_favicon_url])

  return (
    <TenantContext.Provider value={{ tenant, setTenant }}>
      {children}
    </TenantContext.Provider>
  )
}
