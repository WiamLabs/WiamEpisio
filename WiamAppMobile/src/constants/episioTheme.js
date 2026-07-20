/**
 * Watch UI tokens — aliases onto the navy design system (theme.js).
 * Kept so watch components keep importing EPISIO.* without brown/ink colors.
 */
import { COLORS, FONTS, RADIUS, SPACING } from './theme';

export const EPISIO = {
  ink900: COLORS.navy,
  ink800: COLORS.navyCard,
  ink700: COLORS.navySoft,
  ember: COLORS.gold,
  emberDeep: COLORS.goldDark,
  coral: COLORS.error,
  paper: COLORS.text,
  smoke: COLORS.textDim,
  smokeDim: COLORS.textFaint,
  ringTrack: 'rgba(255,255,255,0.14)',
  screenBg: COLORS.navy,
  borderSubtle: COLORS.navyLine,
  borderRow: COLORS.navyLine,
};

export const EPISIO_FONTS = {
  display: FONTS.bold,
  displayBold: FONTS.extraBold,
  displayItalic: FONTS.semi,
  ui: FONTS.regular,
  uiMedium: FONTS.medium,
  uiSemi: FONTS.semi,
  uiBold: FONTS.bold,
};

export const EPISIO_SPACE = {
  1: SPACING.xs,
  2: SPACING.sm,
  3: 12,
  4: SPACING.md,
  5: 20,
  6: SPACING.lg,
  8: 32,
};

export const EPISIO_RADIUS = {
  card: RADIUS.md,
  poster: RADIUS.md,
  hero: 18,
  pill: RADIUS.full,
};

export const PLACEHOLDER_POSTERS = [
  require('../../assets/watch/photo_1_2026-02-13_09-12-54.jpg'),
  require('../../assets/watch/photo_2_2026-02-13_09-12-54.jpg'),
  require('../../assets/watch/photo_3_2026-02-13_09-12-54.jpg'),
  require('../../assets/watch/photo_4_2026-02-13_09-12-54.jpg'),
  require('../../assets/watch/photo_5_2026-02-13_09-12-54.jpg'),
  require('../../assets/watch/photo_6_2026-02-13_09-12-54.jpg'),
];

export function placeholderPosterFor(id) {
  const n = Number(id) || 0;
  return PLACEHOLDER_POSTERS[Math.abs(n) % PLACEHOLDER_POSTERS.length];
}

export const GENRE_CHIPS = [
  'For you',
  'Drama',
  'Romance',
  'Thriller',
  'Comedy',
  'African originals',
];
