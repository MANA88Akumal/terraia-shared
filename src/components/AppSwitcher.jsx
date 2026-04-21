import { useState, useEffect, useRef } from 'react'
import { themeColors } from '../theme/tokens.js'
import { icons } from './icons.jsx'

function getAppDomain() {
  const hostname = window.location.hostname
  if (hostname.endsWith('.terraia.io') || hostname === 'terraia.io') return 'terraia.io'
  return 'manaakumal.com'
}

const domain = getAppDomain()
const APPS = [
  { id: 'accounting', name: 'Accounting', url: `https://accounting.${domain}`, icon: icons.appAccounting },
  { id: 'cms', name: 'Client Management', url: `https://cms.${domain}`, icon: icons.appCms },
  { id: 'investors', name: 'Investor Portal', url: `https://investors.${domain}`, icon: icons.appInvestors },
  { id: 'vault', name: 'Document Vault', url: `https://vault.${domain}`, icon: icons.appVault },
  { id: 'broker-portal', name: 'Broker Portal', url: `https://brokers.${domain}`, icon: icons.appBroker },
  { id: 'construction', name: 'Construction', url: `https://construction.${domain}`, icon: icons.appConstruction || icons.dashboard },
  { id: 'client-portal', name: 'Owner Portal', url: `https://clientes.${domain}`, icon: icons.appClient || icons.dashboard },
  { id: 'admin', name: 'Admin', url: `https://admin.${domain}`, icon: icons.appAdmin || icons.dashboard },
  { id: 'esig', name: 'eSig', url: `https://esig.${domain}`, icon: icons.appEsig || icons.dashboard },
]

/**
 * App switcher dropdown in the top bar.
 * @param {object} props
 * @param {string} props.currentAppId - The ID of the current app
 * @param {string[]} [props.appAccess] - IDs of apps the user can access (all if empty)
 */
export function AppSwitcher({ currentAppId, appAccess }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const visibleApps = appAccess?.length
    ? APPS.filter(a => appAccess.includes(a.id))
    : APPS

  const currentApp = APPS.find(a => a.id === currentAppId)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors border-none cursor-pointer"
        style={{ background: open ? themeColors.accentSubtle : 'transparent', color: themeColors.t1 }}
        onMouseEnter={e => { e.currentTarget.style.background = themeColors.accentSubtle }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ color: themeColors.gold }}>{icons.appSwitcher}</span>
        {currentApp && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{currentApp.name}</span>
        )}
        <span style={{ color: themeColors.t3, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          {icons.chevron}
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          width: 240, background: themeColors.s, borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: `1px solid ${themeColors.border}`, zIndex: 1000,
          overflow: 'hidden',
        }}>
          {visibleApps.map(app => {
            const isCurrent = app.id === currentAppId
            return (
              <button
                key={app.id}
                onClick={() => {
                  if (!isCurrent) window.location.href = app.url
                  setOpen(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 border-none cursor-pointer transition-colors"
                style={{
                  background: isCurrent ? themeColors.accentSubtle : themeColors.s,
                  color: isCurrent ? themeColors.gold : themeColors.t1,
                  borderBottom: `1px solid ${themeColors.s2}`,
                }}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = themeColors.s2 }}
                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = themeColors.s }}
              >
                <span style={{ color: isCurrent ? themeColors.gold : themeColors.t3 }}>{app.icon}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{app.name}</span>
                {isCurrent && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: themeColors.gold }}>Current</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
