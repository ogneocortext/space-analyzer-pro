// Design System - Color Tokens
// Unified color palette for Space Analyzer

export const colors = {
  // Primary Brand Colors
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },

  // Slate (Neutral)
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },

  // Semantic Colors
  success: {
    light: '#86efac',
    DEFAULT: '#22c55e',
    dark: '#15803d',
  },
  warning: {
    light: '#fde047',
    DEFAULT: '#eab308',
    dark: '#a16207',
  },
  error: {
    light: '#fca5a5',
    DEFAULT: '#ef4444',
    dark: '#b91c1c',
  },
  info: {
    light: '#93c5fd',
    DEFAULT: '#3b82f6',
    dark: '#1d4ed8',
  },

  // Category Colors (for file categorization)
  categories: {
    documents: '#3b82f6',
    images: '#22c55e',
    videos: '#ef4444',
    audio: '#a855f7',
    code: '#06b6d4',
    archives: '#f97316',
    other: '#64748b',
  },
} as const

// Dark theme mapping
export const darkTheme = {
  background: colors.slate[950],
  surface: colors.slate[900],
  surfaceElevated: colors.slate[800],
  border: colors.slate[700],
  text: {
    primary: colors.slate[50],
    secondary: colors.slate[400],
    muted: colors.slate[500],
  },
  primary: colors.primary[500],
  primaryHover: colors.primary[400],
  success: colors.success.DEFAULT,
  warning: colors.warning.DEFAULT,
  error: colors.error.DEFAULT,
  info: colors.info.DEFAULT,
} as const

export type ColorToken = keyof typeof darkTheme
