import { themeColors, palette } from '../theme/tokens.js'
import { AppSwitcher } from './AppSwitcher.jsx'
import { OrgSwitcher } from './OrgSwitcher.jsx'

/**
 * Thin top bar (~44px) with hamburger menu (mobile), app switcher, and optional right-side content.
 */
export function TopBar({ appId, appAccess, rightSlot, onMenuToggle }) {
  return (
    <div
      className="flex items-center justify-between px-2 sm:px-4 border-b"
      style={{
        height: 44,
        borderColor: themeColors.border,
        background: themeColors.s,
      }}
    >
      <div className="flex items-center gap-2">
        {/* Hamburger menu — mobile only */}
        <button
          className="md:hidden flex items-center justify-center rounded-lg p-1.5"
          onClick={onMenuToggle}
          style={{ color: palette.gold, background: 'transparent', border: 'none', cursor: 'pointer' }}
          aria-label="Toggle menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <AppSwitcher currentAppId={appId} appAccess={appAccess} />
        <OrgSwitcher />
      </div>
      {rightSlot && (
        <div className="flex items-center gap-1 sm:gap-2">
          {rightSlot}
        </div>
      )}
    </div>
  )
}
