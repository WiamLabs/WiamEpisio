// © 2026 WiamApp. Powered by WiamLabs
// WiamApp Brand Colors — Updated June 2026

export const Colors = {
  // Core Brand — matches the WiamApp logo exactly
  navy: '#0D0D2B',        // Updated — richer navy matching the logo
  navyDeep: '#08081A',    // Deepest navy for backgrounds
  navyMid: '#12123A',     // Mid navy for cards
  gold: '#D4A017',
  white: '#FFFFFF',

  // Gold shades
  goldLight: '#F0C040',
  goldDark: '#A07810',

  // Light Mode (customer default)
  light: {
    background: '#FFFFFF',
    surface: '#F8F8F8',
    card: '#FFFFFF',
    text: '#0D0D2B',
    textSecondary: '#666680',
    border: '#EBEBEB',
    button: '#D4A017',
    buttonText: '#0D0D2B',
    inputBg: '#F4F4F4',
  },

  // Dark Mode (worker screens always dark)
  dark: {
    background: '#0D0D2B',
    surface: '#12123A',
    card: '#12123A',
    text: '#FFFFFF',
    textSecondary: '#AAAACC',
    border: '#1E1E4A',
    button: '#D4A017',   // Gold ALWAYS stays gold — never changes
    buttonText: '#0D0D2B',
    inputBg: 'rgba(255,255,255,0.07)',
  },

  // Status
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  online: '#22C55E',

  // Verification badges — Section 8B of master plan
  // ONE shape, TWO colors only. Individuals = blue. Business = gold.
  badgeBlue: '#3B82F6',
  badgeGold: '#D4A017',
};
