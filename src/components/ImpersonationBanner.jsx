import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import { getImpersonationState, stopImpersonation } from '../auth/impersonation.js'

/**
 * ImpersonationBanner — renders a fixed banner at the top of the viewport
 * whenever the user is in an impersonated session. Reads the cross-domain
 * cookie set by startImpersonation(); clicking "Exit" swaps back to the
 * saved admin session.
 */
export function ImpersonationBanner() {
  const { user } = useAuth()
  const [state, setState] = useState(() => getImpersonationState())

  useEffect(() => {
    // Re-check on mount; cookie may have been set on the previous page load.
    setState(getImpersonationState())
  }, [user?.id])

  if (!state) return null

  const impersonatedEmail = user?.email || 'this user'

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
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span style={{ fontWeight: 600 }}>
          Impersonating {impersonatedEmail}
        </span>
        <span style={{ opacity: 0.85 }}>
          · signed in as <strong>{state.adminEmail}</strong>
        </span>
      </div>
      <button
        type="button"
        onClick={() => stopImpersonation()}
        style={{
          padding: '6px 14px',
          background: '#ffffff',
          color: '#c1432e',
          border: 'none',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Exit impersonation
      </button>
    </div>
  )
}
