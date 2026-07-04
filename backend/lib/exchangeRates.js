// © 2026 WiamApp. Powered by WiamLabs
// backend/lib/exchangeRates.js
// Converts USD amounts to local currencies
// Exchange rates updated daily via Open Exchange Rates API (free tier)

import { supabaseAdmin } from './supabaseAdmin.js';

// ─── CACHE ───────────────────────────────────────────────────
// Rates cached in memory — refreshed every 24 hours
let cachedRates = null;
let lastFetchedAt = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── FETCH RATES ─────────────────────────────────────────────

/**
 * Fetch latest exchange rates from Open Exchange Rates
 * Free tier allows 1,000 requests/month — daily fetch = 30/month (well within limit)
 */
async function fetchRates() {
  const APP_ID = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (!APP_ID) {
    console.warn('No OPEN_EXCHANGE_RATES_APP_ID — using fallback rates');
    return getFallbackRates();
  }

  try {
    const response = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${APP_ID}&base=USD&symbols=GHS,NGN,XOF,XAF`
    );
    const data = await response.json();

    if (data.rates) {
      // Store in Supabase for backup and audit
      await supabaseAdmin.from('exchange_rates').upsert({
        base_currency: 'USD',
        rates: data.rates,
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'base_currency' });

      cachedRates = data.rates;
      lastFetchedAt = Date.now();
      return data.rates;
    }
  } catch (err) {
    console.error('Exchange rate fetch failed:', err.message);
  }

  return getFallbackRates();
}

/**
 * Fallback rates when API is unavailable
 * Update these manually every few weeks
 */
function getFallbackRates() {
  return {
    GHS: 11.50,   // Ghana Cedi
    NGN: 1650.00, // Nigerian Naira
    XOF: 620.00,  // West African CFA (Ivory Coast, Senegal)
    XAF: 620.00,  // Central African CFA
  };
}

// ─── GET RATES ───────────────────────────────────────────────

/**
 * Get current exchange rates (from cache or fresh fetch)
 */
export async function getRates() {
  const cacheExpired = !lastFetchedAt || (Date.now() - lastFetchedAt > CACHE_DURATION_MS);

  if (cacheExpired || !cachedRates) {
    cachedRates = await fetchRates();
  }

  return cachedRates;
}

// ─── CONVERSION HELPERS ──────────────────────────────────────

/**
 * Convert USD amount to local currency
 * @param {number} amountUsd - Amount in USD
 * @param {string} targetCurrency - e.g. 'GHS', 'NGN'
 * @returns {number} Amount in local currency
 */
export async function usdToLocal(amountUsd, targetCurrency) {
  const rates = await getRates();
  const rate = rates[targetCurrency];
  if (!rate) return amountUsd;
  return Math.round(amountUsd * rate * 100) / 100;
}

/**
 * Convert local currency to USD
 * @param {number} localAmount - Amount in local currency
 * @param {string} fromCurrency - e.g. 'GHS', 'NGN'
 * @returns {number} Amount in USD
 */
export async function localToUsd(localAmount, fromCurrency) {
  const rates = await getRates();
  const rate = rates[fromCurrency];
  if (!rate) return localAmount;
  return Math.round((localAmount / rate) * 10000) / 10000;
}

/**
 * Format amount with currency symbol for display
 * @param {number} amountUsd - Amount in USD
 * @param {string} currency - e.g. 'GHS', 'NGN'
 * @returns {string} Formatted string e.g. "GHS 25.00" or "₦ 41,250"
 */
export async function formatPrice(amountUsd, currency) {
  const localAmount = await usdToLocal(amountUsd, currency);

  const SYMBOLS = {
    GHS: 'GHS',
    NGN: '₦',
    USD: '$',
    XOF: 'CFA',
    XAF: 'CFA',
  };

  const symbol = SYMBOLS[currency] || currency;
  return `${symbol} ${localAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get subscription price in local currency for display
 * Used by the mobile app to show prices in user's local currency
 */
export async function getSubscriptionPrices(currency = 'GHS') {
  const { data: configs } = await supabaseAdmin
    .from('subscription_config')
    .select('*')
    .eq('is_active', true);

  if (!configs) return [];

  const rates = await getRates();
  const rate = rates[currency] || 1;

  return configs.map(config => ({
    plan_key: config.plan_key,
    plan_name: config.plan_name,
    price_usd: config.price_usd,
    price_local: Math.round(config.price_usd * rate * 100) / 100,
    price_usd_web: config.price_usd_web,
    price_local_web: Math.round(config.price_usd_web * rate * 100) / 100,
    commission_rate: config.commission_rate,
    currency,
    revenuecat_id: config.revenuecat_id,
  }));
}
