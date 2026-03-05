// Components
export { AppShell } from './components/AppShell.jsx'
export { Sidebar } from './components/Sidebar.jsx'
export { TopBar } from './components/TopBar.jsx'
export { AppSwitcher } from './components/AppSwitcher.jsx'
export { NotificationBell } from './components/NotificationBell.jsx'
export { AccountMenu } from './components/AccountMenu.jsx'
export { LanguageToggle } from './components/LanguageToggle.jsx'
export { icons } from './components/icons.jsx'

// Auth
export { AuthProvider, AuthContext } from './auth/AuthProvider.jsx'
export { useAuth } from './auth/useAuth.js'
export { TenantProvider, TenantContext } from './auth/TenantProvider.jsx'
export { useTenant } from './auth/useTenant.js'
export { OrgProvider, OrgContext } from './auth/OrgProvider.jsx'
export { useOrganization } from './auth/useOrganization.js'
export { ProtectedRoute, AdminRoute, StaffRoute, PublicRoute } from './auth/ProtectedRoute.jsx'
export {
  getSupabaseClient,
  getSharedAuthCookie,
  setSharedAuthCookie,
  clearSharedAuthCookie,
  isTokenExpired,
  parseJwtPayload,
} from './auth/supabase.js'

// i18n
export { I18nProvider, I18nContext } from './i18n/I18nProvider.jsx'
export { useI18n } from './i18n/useI18n.js'

// Theme
export { palette, getRuntimePalette, LOGO_URL } from './theme/tokens.js'
