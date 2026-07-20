/**
 * Studio V2 visual identity.
 *
 * The main app uses wine + gold (constants/theme.js). Studio shares the
 * same WiamApp brand DNA — wine accent for actions, gold for Pro / premium
 * — but sits on a slightly cooler navy backdrop so creators feel like
 * they've stepped into a focused workspace.
 *
 * Use STUDIO_COLORS instead of COLORS for backgrounds, headers, tab
 * bars and Pro CTAs. Reuse COLORS for text + standard primary actions
 * so the rest of the design system stays cohesive.
 */
import { COLORS } from './theme';

export const STUDIO_COLORS = {
  // Backgrounds — deep navy, slightly cooler than the app's wine background.
  background: '#08081a',
  surface: '#10101f',
  surfaceAlt: '#161628',
  card: 'rgba(20, 20, 40, 0.85)',
  cardElevated: 'rgba(30, 30, 56, 0.92)',

  // Accent — WiamApp wine.
  accent: COLORS.primary,                          // #722f37
  accentSoft: 'rgba(114, 47, 55, 0.22)',
  accentBorder: 'rgba(114, 47, 55, 0.45)',
  accentGlow: 'rgba(114, 47, 55, 0.55)',

  // Pro / premium tint — WiamApp gold.
  pro: COLORS.secondary,                           // #d4a843
  proSoft: 'rgba(212, 168, 67, 0.14)',
  proBorder: 'rgba(212, 168, 67, 0.45)',

  // Status colors (re-using app palette so toasts look the same).
  success: COLORS.success,
  warning: '#f59e0b',
  error: COLORS.error,

  // Borders / text
  border: 'rgba(255, 255, 255, 0.08)',
  textBright: '#f3efe6',
  textBody: COLORS.text,
  textMuted: COLORS.textMuted,
};

export const STUDIO_GRADIENTS = {
  hero: ['#08081a', '#161628', '#08081a'],
  proCard: ['rgba(114, 47, 55, 0.30)', 'rgba(212, 168, 67, 0.18)'],
};

export default STUDIO_COLORS;
