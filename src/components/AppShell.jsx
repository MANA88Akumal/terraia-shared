import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { themeColors } from '../theme/tokens.js'
import { Sidebar } from './Sidebar.jsx'
import { TopBar } from './TopBar.jsx'

/**
 * Unified application shell — wraps each TerraIA app with sidebar + top bar + content area.
 *
 * Usage:
 * ```jsx
 * <AppShell
 *   appId="accounting"
 *   appSubtitle="Contabilidad"
 *   navSections={accountingNav}
 *   notification={{ notifications, unreadCount, onMarkAllRead, onClickNotification }}
 *   i18n={{ locale, onToggle: () => setLocale(locale === 'es' ? 'en' : 'es') }}
 *   userEmail={user?.email}
 *   onSignOut={handleSignOut}
 *   sidebarFooterSlot={<CurrencyToggle />}
 *   topBarRightSlot={<CustomButtons />}
 * >
 *   <Outlet />
 * </AppShell>
 * ```
 *
 * @param {object} props
 * @param {string} props.appId - 'accounting' | 'cms' | 'investors'
 * @param {string} props.appSubtitle - Shown below MANA 88 in sidebar
 * @param {Array} props.navSections - Navigation config
 * @param {object} [props.notification] - Notification bell config
 * @param {object} [props.i18n] - { locale, setLocale }
 * @param {string} [props.userEmail]
 * @param {function} [props.onSignOut]
 * @param {string[]} [props.appAccess] - Allowed apps for AppSwitcher
 * @param {React.ReactNode} [props.sidebarFooterSlot] - Extra slot in sidebar footer
 * @param {React.ReactNode} [props.topBarRightSlot] - Extra slot in top bar right
 * @param {React.ReactNode} [props.children]
 */
export function AppShell({
  appId,
  appSubtitle,
  navSections,
  notification,
  i18n,
  userEmail,
  onSignOut,
  appAccess,
  sidebarFooterSlot,
  topBarRightSlot,
  children,
  t,
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: themeColors.bg }}>
      <Sidebar
        appSubtitle={appSubtitle}
        navSections={navSections}
        notification={notification}
        i18n={i18n}
        userEmail={userEmail}
        onSignOut={onSignOut}
        footerSlot={sidebarFooterSlot}
        t={t}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          appId={appId}
          appAccess={appAccess}
          rightSlot={topBarRightSlot}
          onMenuToggle={() => setMobileOpen(!mobileOpen)}
        />

        <main className="flex-1 overflow-auto" style={{ background: themeColors.bg }}>
          <div className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-5 md:p-6">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  )
}
