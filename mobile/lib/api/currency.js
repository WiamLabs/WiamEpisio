// © 2026 WiamApp. Powered by WiamLabs
// lib/api/currency.js — Currency conversion for mobile app
// Mirrors backend/lib/exchangeRates.js, USD always as the base.

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

let cachedRates = null;
let cachedAt = 0;
const CACHE_MS = 1000 * 60 * 30; // 30 minutes — rates don't need to be fetched on every keystroke

/**
 * Get current exchange rates, USD as base (e.g. { GHS: 12.5, NGN: 1600 }).
 * Cached in memory for 30 minutes to avoid hammering the backend.
 */
export async function getExchangeRates() {
  if (cachedRates && Date.now() - cachedAt < CACHE_MS) return cachedRates;
  const res = await fetch(`${BACKEND_URL}/api/currency/rates`);
  const data = await res.json();
  if (!data.success) throw new Error('Could not load exchange rates.');
  cachedRates = data.data;
  cachedAt = Date.now();
  return cachedRates;
}

/**
 * Convert an amount in a local currency (e.g. GHS) to USD, using the
 * real cached rate — never a fabricated/guessed conversion factor.
 */
export async function localToUsd(amountLocal, currencyCode) {
  if (!amountLocal) return null;
  if (currencyCode === 'USD') return amountLocal;
  const rates = await getExchangeRates();
  const rate = rates[currencyCode];
  if (!rate) throw new Error(`No exchange rate available for ${currencyCode}.`);
  return Math.round((amountLocal / rate) * 100) / 100;
}

/**
 * Convert a USD amount to a local currency for display.
 */
export async function usdToLocal(amountUsd, currencyCode) {
  if (!amountUsd) return null;
  if (currencyCode === 'USD') return amountUsd;
  const rates = await getExchangeRates();
  const rate = rates[currencyCode];
  if (!rate) throw new Error(`No exchange rate available for ${currencyCode}.`);
  return Math.round(amountUsd * rate * 100) / 100;
}
