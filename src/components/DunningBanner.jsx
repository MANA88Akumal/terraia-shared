import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../auth/supabase.js'
import { useAuth } from '../auth/useAuth.js'

/**
 * DunningBanner — renders a banner across every app when the user's active
 * tenant has a past_due or unpaid subscription. Points to admin.terraia.io
 * for the fix (update card / resume billing).
 */
export function DunningBanner() {
  const { user, profile } = useAuth()
  const [status, setStatus] = useState(null)
  const [tenantName, setTenantName] = useState(null)

  useEffect(() => {
    async function load() {
      if (!user || !profile?.tenant_id) return
      try {
        const supabase = getSupabaseClient()
        const { data: sub } = await supabase
          .from('platform_subscriptions')
          .select('status, current_period_end')
          .eq('tenant_id', profile.tenant_id)
          .maybeSingle()
        if (!sub) return
        if (['past_due', 'unpaid', 'incomplete'].includes(sub.status)) {
          setStatus(sub.status)
          const { data: t } = await supabase.from('tenants').select('name').eq('id', profile.tenant_id).maybeSingle()
          setTenantName(t?.name || null)
        }
      } catch {
        /* silent — banner is non-critical */
      }
    }
    load()
  }, [user?.id, profile?.tenant_id])

  if (!status) return null

  const message = status === 'past_due' || status === 'unpaid'
    ? `Subscription payment failed for ${tenantName || 'your organization'}. Update your card to avoid service interruption.`
    : `Subscription setup incomplete for ${tenantName || 'your organization'}. Finish setup to activate.`

  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  const adminUrl = host.endsWith('.terraia.io') || host === 'terraia.io'
    ? 'https://admin.terraia.io/billing/payment-method'
    : 'https://admin.manaakumal.com/billing/payment-method'

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 2000,
      width: '100%',
      background: 'linear-gradient(135deg, #c1432e, #8b2e1f)',
      color: '#ffffff',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
      boxShadow: '0 2px 10px rgba(193, 67, 46, 0.3)',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{message}</span>
      </div>
      <a href={adminUrl}
        style={{ padding: '6px 14px', background: '#ffffff', color: '#c1432e', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', textDecoration: 'none' }}>
        Update billing
      </a>
    </div>
  )
}
