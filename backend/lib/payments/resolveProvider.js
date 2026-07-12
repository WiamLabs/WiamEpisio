// © 2026 WiamApp. Powered by WiamLabs
// lib/payments/resolveProvider.js
// Pick the payment rail for a booking / subscription by country + currency.
// Africa (GH/NG + GHS/NGN) → Paystack today.
// Rest of world / hard currencies → Stripe when enabled.

const PAYSTACK_CURRENCIES = new Set(['GHS', 'NGN', 'ZAR', 'KES']); // extend as Paystack adds
const PAYSTACK_COUNTRIES = new Set(['GH', 'NG', 'ZA', 'KE']);

/**
 * @param {{ countryCode?: string, currency?: string, prefer?: string }} opts
 * @returns {'paystack' | 'stripe'}
 */
export function resolvePaymentProvider({ countryCode, currency, prefer } = {}) {
  const forced = (prefer || process.env.PAYMENTS_FORCE_PROVIDER || '').toLowerCase();
  if (forced === 'paystack' || forced === 'stripe') return forced;

  const stripeEnabled = String(process.env.PAYMENTS_STRIPE_ENABLED || '').toLowerCase() === 'true'
    && !!process.env.STRIPE_SECRET_KEY;

  const cc = String(countryCode || '').toUpperCase();
  const cur = String(currency || 'GHS').toUpperCase();

  // Explicit Stripe currencies always prefer Stripe when enabled
  if (stripeEnabled && ['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(cur)) {
    return 'stripe';
  }

  if (PAYSTACK_COUNTRIES.has(cc) || PAYSTACK_CURRENCIES.has(cur)) {
    return 'paystack';
  }

  // Default worldwide path
  if (stripeEnabled) return 'stripe';
  return 'paystack';
}

export function listPaymentProviders() {
  return {
    paystack: {
      ready: !!process.env.PAYSTACK_SECRET_KEY,
      currencies: [...PAYSTACK_CURRENCIES],
      countries: [...PAYSTACK_COUNTRIES],
    },
    stripe: {
      ready: String(process.env.PAYMENTS_STRIPE_ENABLED || '').toLowerCase() === 'true'
        && !!process.env.STRIPE_SECRET_KEY,
      enabledFlag: process.env.PAYMENTS_STRIPE_ENABLED === 'true',
      hasSecret: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      publishableKeyConfigured: !!process.env.STRIPE_PUBLISHABLE_KEY,
    },
  };
}
