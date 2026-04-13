import { createContext, useState, useCallback, useMemo } from 'react'
import sharedEs from './shared/es.js'
import sharedEn from './shared/en.js'
import sharedPt from './shared/pt.js'

const STORAGE_KEY = 'mana88_lang'

export const I18nContext = createContext()

/**
 * Unified i18n provider — merges shared translations with app-specific ones.
 * App keys override shared keys when both exist.
 *
 * @param {object} props
 * @param {{ es: object, en: object, pt?: object }} [props.appTranslations] - App-specific keys
 * @param {React.ReactNode} props.children
 */
export function I18nProvider({ appTranslations, children }) {
  const [locale, setLocaleState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'es' } catch { return 'es' }
  })

  const setLocale = useCallback((lang) => {
    setLocaleState(lang)
    try { localStorage.setItem(STORAGE_KEY, lang) } catch {}
  }, [])

  // Merge shared + app translations per locale
  const langs = useMemo(() => ({
    es: { ...sharedEs, ...(appTranslations?.es || {}) },
    en: { ...sharedEn, ...(appTranslations?.en || {}) },
    pt: { ...sharedPt, ...(appTranslations?.pt || {}) },
  }), [appTranslations])

  const t = useCallback((key, replacements) => {
    let str = langs[locale]?.[key] || langs.es[key] || key
    if (replacements) {
      for (const [k, v] of Object.entries(replacements)) {
        // Support both {{key}} and {key} placeholder styles
        str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
      }
    }
    return str
  }, [locale, langs])

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}
