// © 2026 WiamApp. Powered by WiamLabs
// lib/api/revenuecat.js
// RevenueCat in-app subscriptions
// NOTE: react-native-purchases requires a native build (EAS) — it does NOT work in Expo Go.
// This file uses a safe mock in development/Expo Go and the real SDK in production.

import { Platform } from 'react-native';
import { supabase } from '../supabase';

// ── Detect if we are running in Expo Go (no native modules available) ──
const IS_EXPO_GO = typeof __DEV__ !== 'undefined' && !Platform.constants?.reactNativeVersion?.minor;
const IS_DEV     = typeof __DEV__ !== 'undefined' && __DEV__;

// ── Try to load the real SDK — silently fall back to mock if not available ──
let Purchases     = null;
let LOG_LEVEL_VAL = null;

try {
  const rc  = require('react-native-purchases');
  Purchases = rc.default || rc.Purchases;
  LOG_LEVEL_VAL = rc.LOG_LEVEL;
} catch (e) {
  // react-native-purchases not available (Expo Go or not yet installed)
  // This is expected — subscriptions will show mock data in dev
  if (IS_DEV) console.log('[RevenueCat] Running in mock mode — real SDK not available in Expo Go');
}

// ── Mock packages shown in Expo Go / dev ─────────────────────
const MOCK_PACKAGES = [
  {
    identifier:  'starter_monthly',
    product: {
      identifier:       'com.wiamlabs.wiamapp.starter',
      priceString:      'GHS 22/mo',
      title:            'Starter Plan',
      description:      'Basic worker visibility + bookings',
      introPrice:       null,
    },
    packageType: 'MONTHLY',
  },
  {
    identifier:  'gold_monthly',
    product: {
      identifier:       'com.wiamlabs.wiamapp.gold',
      priceString:      'GHS 44/mo',
      title:            'Gold Plan',
      description:      'Priority search + Spotlight posts + Gold badge',
      introPrice:       null,
    },
    packageType: 'MONTHLY',
  },
  {
    identifier:  'platinum_monthly',
    product: {
      identifier:       'com.wiamlabs.wiamapp.platinum',
      priceString:      'GHS 105/mo',
      title:            'Platinum Plan',
      description:      'Top placement + unlimited Spotlights + Platinum badge',
      introPrice:       null,
    },
    packageType: 'MONTHLY',
  },
];

// ── INITIALIZATION ────────────────────────────────────────────
export async function initializeRevenueCat(userId) {
  if (!Purchases) return; // Mock mode — skip

  try {
    if (IS_DEV) Purchases.setLogLevel(LOG_LEVEL_VAL?.DEBUG || 4);

    const apiKey = Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

    if (!apiKey) {
      console.warn('[RevenueCat] API key not set — subscriptions will not work');
      return;
    }

    await Purchases.configure({ apiKey, appUserID: userId });
  } catch (e) {
    console.warn('[RevenueCat] Init error:', e.message);
  }
}

// ── GET AVAILABLE PACKAGES ────────────────────────────────────
export async function getSubscriptionPackages() {
  if (!Purchases) return MOCK_PACKAGES; // Return mock in Expo Go

  try {
    const offerings = await Purchases.getOfferings();
    if (!offerings.current) return MOCK_PACKAGES;
    return offerings.current.availablePackages;
  } catch (e) {
    console.warn('[RevenueCat] getOfferings error:', e.message);
    return MOCK_PACKAGES;
  }
}

// ── PURCHASE SUBSCRIPTION ─────────────────────────────────────
export async function purchaseSubscription(pkg) {
  if (!Purchases) {
    // Mock purchase in Expo Go — simulate success
    console.log('[RevenueCat] Mock purchase:', pkg.product?.title);
    return { success: true, plan: 'gold', mock: true };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const plan = getPlanFromCustomerInfo(customerInfo);
    return { success: true, plan, customerInfo };
  } catch (e) {
    if (e.userCancelled) return { success: false, cancelled: true };
    return { success: false, error: e.message };
  }
}

// ── RESTORE PURCHASES ─────────────────────────────────────────
export async function restorePurchases() {
  if (!Purchases) return { success: true, plan: 'free', mock: true };

  try {
    const customerInfo = await Purchases.restorePurchases();
    return { success: true, plan: getPlanFromCustomerInfo(customerInfo) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── CHECK CURRENT SUBSCRIPTION ───────────────────────────────
export async function getCurrentSubscription() {
  if (!Purchases) return 'free'; // Mock

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return getPlanFromCustomerInfo(customerInfo);
  } catch (e) {
    return 'free';
  }
}

// ── PURCHASE SPOTLIGHT BOOST ──────────────────────────────────
export async function purchaseSpotlightBoost(boostType, postId) {
  if (!Purchases) {
    console.log('[RevenueCat] Mock spotlight boost:', boostType, postId);
    return { success: true, boostType, postId, mock: true };
  }

  const BOOST_PRODUCT_MAP = {
    standard: 'com.wiamlabs.wiamapp.spotlight_standard',
    featured:  'com.wiamlabs.wiamapp.spotlight_featured',
    premium:   'com.wiamlabs.wiamapp.spotlight_premium',
    business:  'com.wiamlabs.wiamapp.spotlight_business',
  };

  try {
    const packages  = await getSubscriptionPackages();
    const targetPkg = packages.find(p => p.product.identifier === BOOST_PRODUCT_MAP[boostType]);
    if (!targetPkg) throw new Error(`Boost package not found: ${boostType}`);
    const { customerInfo } = await Purchases.purchasePackage(targetPkg);
    return { success: true, boostType, postId };
  } catch (e) {
    if (e.userCancelled) return { success: false, cancelled: true };
    return { success: false, error: e.message };
  }
}

// ── HELPERS ───────────────────────────────────────────────────
function getPlanFromCustomerInfo(customerInfo) {
  const active = customerInfo?.entitlements?.active || {};
  if (active['platinum_access']) return 'platinum';
  if (active['gold_access'])     return 'gold';
  if (active['starter_access'])  return 'starter';
  return 'free';
}

export function hasActiveSubscription(customerInfo) {
  return Object.keys(customerInfo?.entitlements?.active || {}).length > 0;
}
