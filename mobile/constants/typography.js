// © 2026 WiamApp. Powered by WiamLabs
// constants/typography.js
// WiamApp Typography System — used across every screen
// Import this anywhere you need text styles

export const Typography = {

  // ── Font Sizes ────────────────────────────────────────────
  size: {
    xs:   10,   // copyright, tiny labels
    sm:   12,   // captions, helper text, timestamps
    base: 14,   // body text, descriptions, list items
    md:   15,   // slightly emphasized body, benefit text
    lg:   17,   // button text, section descriptions
    xl:   20,   // card titles, screen subtitles
    xl2:  22,   // section titles
    xl3:  26,   // page headlines
    xl4:  30,   // hero headlines
    xl5:  36,   // splash/large display text
  },

  // ── Font Weights ──────────────────────────────────────────
  weight: {
    regular:   '400',
    medium:    '500',
    semibold:  '600',
    bold:      '700',
    extrabold: '800',
  },

  // ── Line Heights ──────────────────────────────────────────
  lineHeight: {
    tight:   1.2,   // headlines
    normal:  1.5,   // body
    relaxed: 1.7,   // descriptions
  },

  // ── Letter Spacing ────────────────────────────────────────
  tracking: {
    tight:  -0.5,
    normal:  0,
    wide:    0.5,
    wider:   1.5,
    widest:  3,
  },

  // ── Preset Text Styles ────────────────────────────────────
  // Use these directly in your components

  // Headings
  h1: {
    fontSize:   30,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize:   24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize:   20,
    fontWeight: '700',
    lineHeight: 28,
  },
  h4: {
    fontSize:   17,
    fontWeight: '600',
    lineHeight: 24,
  },

  // Body
  bodyLarge: {
    fontSize:   16,
    fontWeight: '400',
    lineHeight: 26,
  },
  body: {
    fontSize:   14,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodySmall: {
    fontSize:   12,
    fontWeight: '400',
    lineHeight: 18,
  },

  // Labels and tags
  label: {
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize:   11,
    fontWeight: '400',
    lineHeight: 16,
  },

  // Buttons
  btnLarge: {
    fontSize:   16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btn: {
    fontSize:   14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnSmall: {
    fontSize:   12,
    fontWeight: '600',
  },

  // App name — WiamApp hero display
  appName: {
    fontSize:      28,
    fontWeight:    '800',
    letterSpacing: 0.5,
  },
};

// ── Text Colors ───────────────────────────────────────────────
// Use these for text — not raw hex values in screens

export const TextColors = {
  // On dark/navy backgrounds
  dark: {
    primary:    '#FFFFFF',          // main text
    secondary:  'rgba(255,255,255,0.6)',  // descriptions, subtitles
    muted:      'rgba(255,255,255,0.35)', // timestamps, placeholders
    gold:       '#D4A017',          // highlights, links, labels
    goldMuted:  'rgba(212,160,23,0.5)',   // subtle gold
    danger:     '#EF4444',          // errors
    success:    '#22C55E',          // success states
    warning:    '#F59E0B',          // warnings
    disabled:   'rgba(255,255,255,0.2)', // disabled text
  },

  // On light/white backgrounds
  light: {
    primary:    '#0D0D2B',          // main text
    secondary:  '#666680',          // descriptions
    muted:      '#AAAACC',          // timestamps, placeholders
    gold:       '#D4A017',          // highlights, links
    danger:     '#EF4444',
    success:    '#22C55E',
    warning:    '#F59E0B',
    disabled:   '#CCCCCC',
  },
};
