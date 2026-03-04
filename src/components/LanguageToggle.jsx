import { useState, useRef, useEffect } from 'react'
import { palette } from '../theme/tokens.js'

const LANG_ORDER = ['es', 'en', 'pt']
const LANG_FLAGS = { es: '\u{1F1F2}\u{1F1FD}', en: '\u{1F1FA}\u{1F1F8}', pt: '\u{1F1E7}\u{1F1F7}' }
const LANG_LABELS = { es: 'Español', en: 'English', pt: 'Português' }

export function LanguageToggle({ locale, setLocale, onToggle, sidebarOpen }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleSelect(lang) {
    if (setLocale) {
      setLocale(lang)
    } else if (onToggle) {
      onToggle()
    }
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative mt-1">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center rounded-lg transition-all duration-150 border-none cursor-pointer"
        style={{
          gap: sidebarOpen ? 10 : 0,
          padding: sidebarOpen ? '7px 10px' : '7px 0',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          background: open ? 'rgba(206,158,98,0.12)' : 'transparent',
          color: open ? palette.gold : '#a0a0a0',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(206,158,98,0.06)'
          e.currentTarget.style.color = palette.gold
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#a0a0a0'
          }
        }}
      >
        <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20, height: 20, fontSize: '0.82rem' }}>
          {LANG_FLAGS[locale]}
        </span>
        {sidebarOpen && (
          <>
            <span style={{ fontSize: '0.67rem', fontWeight: 500, flex: 1, textAlign: 'left' }}>
              {LANG_LABELS[locale]}
            </span>
            <span style={{
              fontSize: '0.45rem',
              transition: 'transform 0.2s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              opacity: 0.5,
            }}>
              ▲
            </span>
          </>
        )}
      </button>

      {/* Dropdown */}
      <div
        className="absolute z-50 rounded-lg overflow-hidden"
        style={{
          ...(sidebarOpen
            ? { bottom: '100%', left: 0, right: 0, marginBottom: 4 }
            : { bottom: 0, left: '100%', marginLeft: 8, width: 160 }),
          background: '#2a2a2a',
          border: '1px solid rgba(206,158,98,0.15)',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0)' : 'translateY(4px)',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.15s ease, transform 0.15s ease',
        }}
      >
        {LANG_ORDER.map((lang) => (
          <button
            key={lang}
            onClick={() => handleSelect(lang)}
            className="w-full flex items-center gap-2.5 border-none cursor-pointer transition-colors duration-100"
            style={{
              padding: '8px 12px',
              background: lang === locale ? 'rgba(206,158,98,0.12)' : 'transparent',
              color: lang === locale ? palette.gold : '#c0c0c0',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(206,158,98,0.18)'
              e.currentTarget.style.color = palette.gold
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = lang === locale ? 'rgba(206,158,98,0.12)' : 'transparent'
              e.currentTarget.style.color = lang === locale ? palette.gold : '#c0c0c0'
            }}
          >
            <span style={{ fontSize: '0.85rem' }}>{LANG_FLAGS[lang]}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>{LANG_LABELS[lang]}</span>
            {lang === locale && (
              <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: palette.gold }}>✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
