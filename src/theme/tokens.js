// Brand palette — reads CSS custom properties with hardcoded fallbacks
function cssVar(name, fallback) {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export const palette = {
  gold: '#ce9e62',
  red: '#c1432e',
  silver: '#4b6777',
  black: '#2c2c2c',
  cream: '#faf8f5',
  border: '#e8e0d6',
  white: '#ffffff',
}

/** Read runtime palette (tenant overrides via CSS vars) */
export function getRuntimePalette() {
  return {
    gold: cssVar('--mana-gold', palette.gold),
    red: cssVar('--mana-red', palette.red),
    silver: cssVar('--mana-silver', palette.silver),
    black: cssVar('--mana-black', palette.black),
    cream: cssVar('--mana-cream', palette.cream),
    border: cssVar('--mana-border', palette.border),
    white: palette.white,
  }
}

export const LOGO_URL = 'https://login.terraia.io/logo-dark.png'
export const LOGO_LIGHT_URL = 'https://login.terraia.io/logo-light.png'
