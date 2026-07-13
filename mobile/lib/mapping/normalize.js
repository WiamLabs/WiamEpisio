// © 2026 WiamApp. Powered by WiamLabs
// lib/mapping/normalize.js — shared place result shape

export function isEstateLabel(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim();
  return (
    /^community\s*\d+/i.test(n)
    || /^comm\.?\s*\d+/i.test(n)
    || /^sector\s*\d+/i.test(n)
    || /^block\s*[a-z0-9]+$/i.test(n)
  );
}

export function pickFirst(...candidates) {
  for (const c of candidates) {
    const v = (c || '').trim();
    if (v && !isEstateLabel(v)) return v;
  }
  return '';
}

/** Format GhanaPost GPSName "AK4849319" → "AK-484-9319" */
export function formatGhanaDigitalAddress(raw) {
  if (!raw) return '';
  const cleaned = String(raw).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const m = cleaned.match(/^([A-Z]{2})(\d{3})(\d{4})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (/^[A-Z]{2}-\d{3}-\d{4}$/i.test(String(raw).trim())) {
    return String(raw).trim().toUpperCase();
  }
  return String(raw).trim();
}

/**
 * @typedef {object} PlaceResult
 * @property {string} city
 * @property {string} landmark
 * @property {string} region
 * @property {string} label
 * @property {string} source
 * @property {string} [digitalAddress]
 * @property {string} [district]
 * @property {string} [street]
 */

export function emptyPlace(latitude, longitude, source = 'coords') {
  return {
    city: '',
    landmark: '',
    region: '',
    digitalAddress: '',
    district: '',
    street: '',
    label: `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`,
    source,
  };
}
