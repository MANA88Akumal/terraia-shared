import { useState, useEffect, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { palette, LOGO_URL } from '../theme/tokens.js'
import { icons } from './icons.jsx'
import { NotificationBell } from './NotificationBell.jsx'
import { LanguageToggle } from './LanguageToggle.jsx'
import { AccountMenu } from './AccountMenu.jsx'

/**
 * Collapsible sidebar — 220px open / 60px closed.
 *
 * @param {object} props
 * @param {string} props.appSubtitle - e.g. "Contabilidad", "Client Management"
 * @param {Array<{key:string, heading?:string, items:Array<{to:string, label:string, icon:JSX.Element, badge?:number}>}>} props.navSections
 * @param {object} [props.notification] - { notifications, unreadCount, onMarkAllRead, onClickNotification, label }
 * @param {object} [props.i18n] - { locale, onToggle }
 * @param {string} [props.userEmail]
 * @param {function} [props.onSignOut]
 * @param {React.ReactNode} [props.footerSlot] - Optional slot (e.g. CurrencyToggle)
 */
export function Sidebar({
  appSubtitle,
  navSections,
  notification,
  i18n,
  userEmail,
  onSignOut,
  footerSlot,
}) {
  const [open, setOpen] = useState(true)
  const [collapsed, setCollapsed] = useState({})
  const location = useLocation()

  // Auto-expand sections containing active route
  useEffect(() => {
    for (const section of navSections) {
      if (section.heading && section.items.some(item =>
        item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
      )) {
        setCollapsed(prev => ({ ...prev, [section.key]: false }))
      }
    }
  }, [location.pathname, navSections])

  const toggleSection = useCallback((key) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <aside
      className="flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out"
      style={{
        width: open ? 220 : 60,
        background: palette.black,
        borderRight: '1px solid rgba(206,158,98,0.08)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center" style={{ height: 56, borderBottom: '1px solid rgba(206,158,98,0.1)' }}>
        <img src={LOGO_URL} alt="TerraIA" style={{ height: open ? '2rem' : '1.5rem', opacity: 0.9 }} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {navSections.map((section, si) => {
          const isCollapsed = section.heading && collapsed[section.key]
          const hasActiveChild = section.items.some(item =>
            item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
          )

          return (
            <div key={section.key} className={si > 0 ? 'mt-1' : ''}>
              {/* Section heading */}
              {section.heading && open && (
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 rounded-md transition-colors duration-150 border-none cursor-pointer"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(206,158,98,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: '0.58rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: hasActiveChild ? palette.gold : 'rgba(255,255,255,0.25)' }}>
                    {section.heading}
                  </span>
                  <span className="transition-transform duration-200" style={{
                    color: 'rgba(255,255,255,0.2)',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  }}>
                    {icons.chevron}
                  </span>
                </button>
              )}

              {/* Section items */}
              <div
                className="overflow-hidden transition-all duration-200 ease-in-out"
                style={{
                  maxHeight: isCollapsed ? 0 : section.items.length * 40,
                  opacity: isCollapsed ? 0 : 1,
                }}
              >
                {section.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className="group flex items-center rounded-lg transition-all duration-150"
                    style={({ isActive }) => ({
                      gap: open ? 10 : 0,
                      padding: open ? '7px 10px' : '7px 0',
                      justifyContent: open ? 'flex-start' : 'center',
                      background: isActive ? 'rgba(206,158,98,0.12)' : 'transparent',
                      color: isActive ? palette.gold : '#a0a0a0',
                      marginBottom: 1,
                      textDecoration: 'none',
                    })}
                    onMouseEnter={e => {
                      if (e.currentTarget.getAttribute('aria-current') !== 'page') {
                        e.currentTarget.style.background = 'rgba(206,158,98,0.06)'
                        e.currentTarget.style.color = palette.gold
                      }
                    }}
                    onMouseLeave={e => {
                      if (e.currentTarget.getAttribute('aria-current') !== 'page') {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = '#a0a0a0'
                      }
                    }}
                  >
                    <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20, height: 20 }}>
                      {item.icon}
                    </span>
                    {open && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.label}</span>
                    )}
                    {open && item.badge != null && item.badge > 0 && (
                      <span className="rounded-full flex items-center justify-center"
                        style={{ marginLeft: 'auto', color: '#fff', fontSize: '0.6rem', fontWeight: 700, width: '1.25rem', height: '1.25rem', background: palette.red }}>
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-3 pt-2" style={{ borderTop: '1px solid rgba(206,158,98,0.1)' }}>
        {/* Notifications */}
        {notification && (
          <NotificationBell
            notifications={notification.notifications}
            unreadCount={notification.unreadCount}
            onMarkAllRead={notification.onMarkAllRead}
            onClickNotification={notification.onClickNotification}
            sidebarOpen={open}
            label={notification.label}
          />
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center rounded-lg transition-all duration-150 border-none cursor-pointer"
          style={{
            gap: open ? 10 : 0,
            padding: open ? '7px 10px' : '7px 0',
            justifyContent: open ? 'flex-start' : 'center',
            background: 'transparent',
            color: '#a0a0a0',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(206,158,98,0.06)'; e.currentTarget.style.color = palette.gold }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a0a0a0' }}
        >
          <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20, height: 20, transform: open ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}>
            {icons.collapse}
          </span>
          {open && <span style={{ fontSize: '0.67rem', fontWeight: 500 }}>Collapse</span>}
        </button>

        {/* Language toggle */}
        {i18n && (
          <LanguageToggle
            locale={i18n.locale}
            onToggle={i18n.onToggle}
            sidebarOpen={open}
          />
        )}

        {/* Optional footer slot (e.g. currency toggle) */}
        {footerSlot && open && footerSlot}

        {/* Account / Sign out */}
        <AccountMenu email={userEmail} onSignOut={onSignOut} sidebarOpen={open} />
      </div>
    </aside>
  )
}
