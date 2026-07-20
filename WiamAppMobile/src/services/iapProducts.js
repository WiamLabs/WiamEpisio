/**
 * IAP Product IDs — must match RevenueCat dashboard + App Store / Play Store.
 * These are the product identifiers configured in Apple App Store Connect
 * and Google Play Console, then mapped in RevenueCat.
 */

// ── Consumable Coin Packages ──
export const COIN_PRODUCTS = {
  wiamcoins_100:  { coins: 100,  bonus: 0,    label: 'Starter',    tier: 1 },
  wiamcoins_550:  { coins: 500,  bonus: 50,   label: 'Popular',    tier: 2 },
  wiamcoins_1200: { coins: 1000, bonus: 200,  label: 'Best Value', tier: 3 },
  wiamcoins_2600: { coins: 2000, bonus: 600,  label: 'Super',      tier: 4 },
  wiamcoins_7000: { coins: 5000, bonus: 2000, label: 'Mega',       tier: 5 },
};

export const COIN_PRODUCT_IDS = Object.keys(COIN_PRODUCTS);

// ── Subscription Products ──
export const SUBSCRIPTION_PRODUCTS = {
  wiampremium_basic:     { plan: 'basic',     label: 'WiamPremium Basic',     tier: 1 },
  wiampremium_plus:      { plan: 'plus',      label: 'WiamPremium Plus',      tier: 2 },
  wiampremium_unlimited: { plan: 'unlimited', label: 'WiamPremium Unlimited', tier: 3 },
  wiamelite_monthly:     { plan: 'monthly',   label: 'WiamElite Monthly',     type: 'elite' },
};

export const SUBSCRIPTION_PRODUCT_IDS = Object.keys(SUBSCRIPTION_PRODUCTS);

// ── All product IDs (for RevenueCat getProducts) ──
export const ALL_PRODUCT_IDS = [...COIN_PRODUCT_IDS, ...SUBSCRIPTION_PRODUCT_IDS];

// ── RevenueCat Entitlement IDs ──
export const ENTITLEMENTS = {
  PREMIUM: 'premium',
  ELITE: 'elite',
};
