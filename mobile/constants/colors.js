// © 2026 WiamApp. Powered by WiamLabs
// Part 13 Design System — LOCKED. Do not restyle or invent new tokens.

/**
 * Source of truth:
 * WiamApp Some Of The Screens/WiamApp-Master-Plan-Part13-Design-System.md
 *
 * Main app background is Navy (#08081A) for every role.
 * Gold gradient (135°) for avatars, hero cards, primary CTAs.
 */

export const Colors = {
  // ── Part 13 core tokens ───────────────────────────────────
  navy:       '#08081A', // Main app background
  navyCard:   '#12122A', // Cards, list rows, inputs
  navySoft:   '#161634', // Bottom nav, elevated surfaces
  navyLine:   '#1E1E42', // Borders, dividers
  gold:       '#D4A017', // Primary brand
  goldDark:   '#A07810', // Gradient partner
  textDim:    '#7D7D97', // Secondary text
  textFaint:  '#5A5A75', // Tertiary / inactive nav
  white:      '#FFFFFF',

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#3B82F6',
  online:  '#22C55E',

  // Verification badges (master plan — blue individual / gold business)
  badgeBlue: '#3B82F6',
  badgeGold: '#D4A017',

  // Layout constants from Part 13
  screenPad: 20,
  cardRadius: 24,
  bottomNavHeight: 84,

  // Legacy aliases (screens still importing these — map to Part 13)
  navyDeep: '#08081A',
  navyMid:  '#12122A',
  goldLight: '#F0C040',

  /** @deprecated Part 13 is dark for all roles — use Colors directly */
  light: {
    background: '#08081A',
    surface:    '#161634',
    card:       '#12122A',
    text:       '#FFFFFF',
    textSecondary: '#7D7D97',
    border:     '#1E1E42',
    button:     '#D4A017',
    buttonText: '#08081A',
    inputBg:    '#12122A',
  },

  dark: {
    background: '#08081A',
    surface:    '#161634',
    card:       '#12122A',
    text:       '#FFFFFF',
    textSecondary: '#7D7D97',
    border:     '#1E1E42',
    button:     '#D4A017',
    buttonText: '#08081A',
    inputBg:    '#12122A',
  },
};

/** Gold → Gold Dark at 135° (avatars, hero cards, primary surfaces) */
export const goldGradient = ['#D4A017', '#A07810'];
