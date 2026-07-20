/**
 * WiamApp IAP Service — RevenueCat wrapper for iOS & Android.
 *
 * Handles:
 *   - SDK initialization (configure with Apple/Google API keys)
 *   - Fetching available products from the store
 *   - Purchasing consumables (coin packs) and subscriptions
 *   - Confirming purchases with our backend
 *   - Restoring purchases
 *
 * Env vars (set in eas.json or .env):
 *   EXPO_PUBLIC_RC_APPLE_KEY  — RevenueCat Apple API key
 *   EXPO_PUBLIC_RC_GOOGLE_KEY — RevenueCat Google API key
 */
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import Constants from 'expo-constants';
// apiClient imported lazily inside functions to avoid require cycle
// (iap → client → useAuthStore → iap)
import { COIN_PRODUCT_IDS, SUBSCRIPTION_PRODUCT_IDS, ALL_PRODUCT_IDS } from './iapProducts';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const extra = Constants.expoConfig?.extra || {};
const RC_APPLE_KEY = extra.rcAppleKey || '';
const RC_GOOGLE_KEY = extra.rcGoogleKey || '';

let _initialized = false;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize RevenueCat SDK. Call once on app start after user is authenticated.
 * @param {string|number} userId - The user's wiam_id (used as RC app_user_id)
 */
export async function initIAP(userId) {
  if (_initialized) return;
  if (Platform.OS === 'web') return; // IAP not available on web

  // Skip RevenueCat entirely in Expo Go — preview mode triggers internal
  // errors (e.g. accessing .length on undefined customer info).
  if (Constants.appOwnership === 'expo') {
    console.log('[IAP] Skipping RevenueCat in Expo Go');
    return;
  }

  const apiKey = Platform.OS === 'ios' ? RC_APPLE_KEY : RC_GOOGLE_KEY;
  if (!apiKey) {
    console.warn('[IAP] No RevenueCat API key for', Platform.OS);
    return;
  }

  try {
    Purchases.configure({ apiKey, appUserID: String(userId) });
    _initialized = true;
    console.log('[IAP] RevenueCat configured for', Platform.OS, 'user:', userId);
  } catch (err) {
    console.error('[IAP] Configure error:', err);
  }
}

/**
 * Check if IAP is available (native platform + SDK initialized).
 */
export function isIAPAvailable() {
  return _initialized && Platform.OS !== 'web';
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/**
 * Fetch available products from RevenueCat / store.
 * Returns { coinProducts: [...], subscriptionProducts: [...] }
 */
export async function getProducts() {
  if (!isIAPAvailable()) {
    return { coinProducts: [], subscriptionProducts: [] };
  }

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;

    if (!current) {
      console.warn('[IAP] No current offering');
      return { coinProducts: [], subscriptionProducts: [] };
    }

    const allPackages = current.availablePackages || [];

    const coinProducts = [];
    const subscriptionProducts = [];

    for (const pkg of allPackages) {
      const product = pkg.product;
      const productId = product.identifier;

      const item = {
        _rcPackage: pkg,  // Original RC package for purchasePackage()
        packageId: pkg.identifier,
        productId,
        title: product.title,
        description: product.description,
        price: product.price,
        priceString: product.priceString,
        currencyCode: product.currencyCode,
      };

      if (COIN_PRODUCT_IDS.includes(productId)) {
        coinProducts.push(item);
      } else if (SUBSCRIPTION_PRODUCT_IDS.includes(productId)) {
        subscriptionProducts.push(item);
      }
    }

    return { coinProducts, subscriptionProducts };
  } catch (err) {
    console.error('[IAP] getProducts error:', err);
    return { coinProducts: [], subscriptionProducts: [] };
  }
}

// ---------------------------------------------------------------------------
// Purchasing
// ---------------------------------------------------------------------------

/**
 * Purchase a coin pack via RevenueCat.
 * After store purchase completes, confirms with our backend.
 *
 * @param {object} product - Product object from getProducts()
 * @returns {{ ok, balance, coins_credited, error? }}
 */
export async function purchaseCoinPack(product) {
  if (!isIAPAvailable()) {
    return { ok: false, error: 'IAP not available on this platform' };
  }

  try {
    // RevenueCat handles the store purchase flow — use original package object
    const pkg = product._rcPackage || product;
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    const store = Platform.OS === 'ios' ? 'apple' : 'google';

    // Extract transaction ID from the latest transaction
    const nonSubs = customerInfo.nonSubscriptionTransactions || [];
    const latest = nonSubs.length > 0 ? nonSubs[nonSubs.length - 1] : null;
    const transactionId = latest?.transactionIdentifier || '';

    // Confirm with our backend
    const { default: apiClient } = await import('../api/client');
    const resp = await apiClient.post('/iap/confirm', {
      rc_user_id: customerInfo.originalAppUserId,
      product_id: product.productId,
      store,
      transaction_id: transactionId,
    });

    return resp.data;
  } catch (err) {
    if (err.userCancelled) {
      return { ok: false, error: 'Purchase cancelled', cancelled: true };
    }
    console.error('[IAP] purchaseCoinPack error:', err);
    return { ok: false, error: err.message || 'Purchase failed' };
  }
}

/**
 * Purchase a subscription via RevenueCat.
 * After store purchase completes, confirms with our backend.
 *
 * @param {object} product - Product object from getProducts()
 * @returns {{ ok, plan, expires_at, error? }}
 */
export async function purchaseSubscription(product) {
  if (!isIAPAvailable()) {
    return { ok: false, error: 'IAP not available on this platform' };
  }

  try {
    const pkg = product._rcPackage || product;
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    const store = Platform.OS === 'ios' ? 'apple' : 'google';

    // Extract subscription transaction info
    const activeSubs = customerInfo.activeSubscriptions || [];
    const entitlements = customerInfo.entitlements?.active || {};
    let transactionId = '';
    let expiresAt = '';

    // Try to get info from entitlements
    for (const [, ent] of Object.entries(entitlements)) {
      if (ent.productIdentifier === product.productId) {
        transactionId = ent.originalPurchaseDateMillis
          ? String(ent.originalPurchaseDateMillis)
          : '';
        expiresAt = ent.expirationDate || '';
        break;
      }
    }

    const { default: apiClient } = await import('../api/client');
    const resp = await apiClient.post('/iap/confirm-subscription', {
      rc_user_id: customerInfo.originalAppUserId,
      product_id: product.productId,
      store,
      transaction_id: transactionId,
      expires_at: expiresAt,
    });

    return resp.data;
  } catch (err) {
    if (err.userCancelled) {
      return { ok: false, error: 'Purchase cancelled', cancelled: true };
    }
    console.error('[IAP] purchaseSubscription error:', err);
    return { ok: false, error: err.message || 'Purchase failed' };
  }
}

// ---------------------------------------------------------------------------
// Restore Purchases
// ---------------------------------------------------------------------------

/**
 * Restore previous purchases (e.g. after reinstall).
 * @returns {{ ok, activeSubscriptions, entitlements }}
 */
export async function restorePurchases() {
  if (!isIAPAvailable()) {
    return { ok: false, error: 'IAP not available on this platform' };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const active = customerInfo.activeSubscriptions || [];
    const entitlements = customerInfo.entitlements?.active || {};

    return {
      ok: true,
      activeSubscriptions: active,
      entitlements: Object.keys(entitlements),
    };
  } catch (err) {
    console.error('[IAP] restorePurchases error:', err);
    return { ok: false, error: err.message || 'Restore failed' };
  }
}

// ---------------------------------------------------------------------------
// Customer Info
// ---------------------------------------------------------------------------

/**
 * Get current customer info from RevenueCat.
 */
export async function getCustomerInfo() {
  if (!isIAPAvailable()) return null;

  try {
    const info = await Purchases.getCustomerInfo();
    return info;
  } catch (err) {
    console.error('[IAP] getCustomerInfo error:', err);
    return null;
  }
}

/**
 * Log out of RevenueCat (call on app logout).
 */
export async function logoutIAP() {
  if (!_initialized) return;
  try {
    await Purchases.logOut();
    _initialized = false;
  } catch (err) {
    console.error('[IAP] logout error:', err);
  }
}
