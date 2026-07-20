/**
 * WiamEpisio design tokens (navy + gold).
 * Matches HTML mockups: #08081A / #D4A017 / Inter-friendly system fonts.
 */
export const COLORS = {
  // Brand (Episio)
  navy: '#08081A',
  navyCard: '#12122A',
  navySoft: '#161634',
  navyLine: '#1E1E42',
  gold: '#D4A017',
  goldDark: '#A07810',

  // Legacy aliases (older screens / packages)
  primary: '#722f37',
  primaryDark: '#4a1e24',
  primaryLight: '#8e3a44',
  secondary: '#D4A017',
  secondaryLight: '#f0d078',
  background: '#08081A',
  surface: '#12122A',
  card: '#12122A',
  text: '#F2F2F7',
  textSecondary: '#B5B5C3',
  textMuted: '#8B8BA3',
  textDim: '#8B8BA3',
  textFaint: '#5A5A75',
  border: '#1E1E42',
  error: '#cf6679',
  success: '#4caf50',
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  full: 9999,
};

/** System UI + Playfair display (loaded in App.js when available). */
export const FONTS = {
  regular: 'System',
  medium: 'System',
  semi: 'System',
  bold: 'System',
  extraBold: 'System',
  display: 'PlayfairDisplay_700Bold',
  displaySemi: 'PlayfairDisplay_600SemiBold',
};
