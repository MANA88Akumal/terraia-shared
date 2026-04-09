import { useState, useRef, useEffect } from 'react'
import { useOrganization } from '../auth/useOrganization.js'
import { themeColors, palette } from '../theme/tokens.js'

/**
 * Organization switcher dropdown for the TopBar.
 * Only renders when the user has access to 2+ orgs.
 */
export function OrgSwitcher() {
  const { orgName, allOrgs, switchOrg, orgId } = useOrganization()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Don't render if user only has 1 org
  if (!allOrgs || allOrgs.length < 2) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 6,
          border: 'none', background: 'transparent',
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
          color: themeColors.t2, transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = palette.gold}
        onMouseLeave={e => e.currentTarget.style.color = themeColors.t2}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {orgName || 'Select Project'}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          minWidth: 220, borderRadius: 8, overflow: 'hidden',
          background: themeColors.s, border: '1px solid ' + themeColors.border,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100,
        }}>
          <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: themeColors.t3 }}>
            Switch Project
          </div>
          {allOrgs.map(org => (
            <button
              key={org.id}
              onClick={() => { switchOrg(org.id); setOpen(false); window.location.reload() }}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px',
                border: 'none', background: org.id === orgId ? palette.gold + '12' : 'transparent',
                cursor: 'pointer', fontSize: 13, color: org.id === orgId ? palette.gold : themeColors.t1,
                fontWeight: org.id === orgId ? 600 : 400, display: 'block',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (org.id !== orgId) e.currentTarget.style.background = themeColors.bg }}
              onMouseLeave={e => { if (org.id !== orgId) e.currentTarget.style.background = 'transparent' }}
            >
              {org.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
