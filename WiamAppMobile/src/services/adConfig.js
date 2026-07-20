/**
 * WiamApp Ad Configuration — Google AdMob
 *
 * Ad unit IDs, frequency rules, and helpers for the ads system.
 * Replace placeholder IDs with real ones from https://admob.google.com
 * before production builds.
 */
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// AdMob Unit IDs  (test IDs used in __DEV__, real IDs in production)
// ---------------------------------------------------------------------------

const TEST_IDS = {
  BANNER: Platform.select({
    ios: 'ca-app-pub-3940256099942544/2934735716',
    android: 'ca-app-pub-3940256099942544/6300978111',
    default: '',
  }),
  INTERSTITIAL: Platform.select({
    ios: 'ca-app-pub-3940256099942544/4411468910',
    android: 'ca-app-pub-3940256099942544/1033173712',
    default: '',
  }),
  REWARDED: Platform.select({
    ios: 'ca-app-pub-3940256099942544/1712485313',
    android: 'ca-app-pub-3940256099942544/5224354917',
    default: '',
  }),
};

const PROD_IDS = {
  BANNER: Platform.select({
    ios: 'ca-app-pub-7267152032047381/6533939160',
    android: 'ca-app-pub-7267152032047381/9741632992',
    default: '',
  }),
  INTERSTITIAL: Platform.select({
    ios: 'ca-app-pub-7267152032047381/2315492556',
    android: 'ca-app-pub-7267152032047381/2350002793',
    default: '',
  }),
  REWARDED: Platform.select({
    ios: 'ca-app-pub-7267152032047381/7974924056',
    android: 'ca-app-pub-7267152032047381/5399152590',
    default: '',
  }),
};

export const AD_UNIT_IDS = __DEV__ ? TEST_IDS : PROD_IDS;

function isPlaceholderAdUnitId(id) {
  const value = String(id || '');
  return !value || value.includes('XXXXXXXX') || value.includes('BBBBBBBB') || value.includes('IIIIIIII') || value.includes('RRRRRRRR');
}

export function hasValidAdMobConfig() {
  if (__DEV__) return true;
  return !isPlaceholderAdUnitId(AD_UNIT_IDS.BANNER)
    && !isPlaceholderAdUnitId(AD_UNIT_IDS.INTERSTITIAL)
    && !isPlaceholderAdUnitId(AD_UNIT_IDS.REWARDED);
}

// ---------------------------------------------------------------------------
// Frequency & placement rules
// ---------------------------------------------------------------------------

/** Minimum seconds between interstitial ads */
export const INTERSTITIAL_COOLDOWN_SEC = 240; // 4 minutes

/** Show interstitial every Nth chapter transition */
export const INTERSTITIAL_EVERY_N_CHAPTERS = 3;

/** Skip interstitials for the first N chapters of any book */
export const INTERSTITIAL_SKIP_FIRST_CHAPTERS = 2;

/** Max rewarded ads per day per user */
export const REWARDED_DAILY_LIMIT = 3;

// ---------------------------------------------------------------------------
// Revenue attribution types
// ---------------------------------------------------------------------------

export const AD_ATTRIBUTION = {
  /** 50% creator / 50% WiamLabs — ads shown while reading a specific book */
  CREATOR_SHARE: 'creator_share',
  /** 100% WiamLabs — ads on browse, home, studio, etc. */
  PLATFORM_ONLY: 'platform_only',
};

// ---------------------------------------------------------------------------
// Screens that should NEVER show ads
// ---------------------------------------------------------------------------
export const AD_FREE_SCREENS = [
  'Login',
  'Register',
  'Profile',
  'Settings',
  'Wallet',
  'HelpCenter',
  'AccountSafety',
  'Feedback',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if ads should be shown for this user.
 * Premium users never see ads.
 */
export function shouldShowAds(user) {
  if (!user) return true; // logged-out users see ads
  if (Platform.OS === 'web') return false; // no mobile ads on web
  if (!hasValidAdMobConfig()) return false; // safety: never request ads with placeholder prod IDs
  const status = user.premium_status;
  if (status === 'active' || status === 'trial') return false;
  return true;
}

/**
 * Determine revenue attribution for a given ad placement.
 * @param {string} placement - e.g. 'reader', 'book_detail', 'home', 'studio'
 * @param {number|null} bookId - if showing ad in context of a specific book
 */
export function getAttribution(placement, bookId) {
  if (bookId && ['reader', 'book_detail', 'comments'].includes(placement)) {
    return AD_ATTRIBUTION.CREATOR_SHARE;
  }
  return AD_ATTRIBUTION.PLATFORM_ONLY;
}
