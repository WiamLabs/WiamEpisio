// © 2026 WiamApp. Powered by WiamLabs
// lib/mapping/plugins/ghanapost.js — Ghana local accuracy plug-in (blueprint)

import { emptyPlace, formatGhanaDigitalAddress } from '../normalize.js';

const BASE = 'https://ghanapostgps.sperixlabs.org';

/**
 * Reverse: lat/lng → GhanaPost digital address + area.
 * This is what fixes OSM “Community 14 vs 18” style mismatches in Ghana.
 */
export async function reverseGhanaPost(latitude, longitude) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const body = new URLSearchParams({
      lat: String(latitude),
      long: String(longitude),
    });
    const res = await fetch(`${BASE}/get-address`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });
    const json = await res.json();
    if (!json?.found || !json?.data?.Table?.[0]) {
      return null;
    }
    const row = json.data.Table[0];
    const digitalAddress = formatGhanaDigitalAddress(row.GPSName);
    const area = (row.Area || '').trim();
    const district = (row.District || '').trim();
    const region = (row.Region || '').trim();
    const street = (row.Street || '').trim();

    // Prefer Area as landmark (e.g. community/estate name from GhanaPost),
    // District/city as city — never invent OSM community numbers.
    const city = district || area || '';
    const landmark = area && area !== city ? area : (street || '');

    return {
      city,
      landmark,
      region,
      district,
      street,
      digitalAddress,
      label: [digitalAddress, area, district, region].filter(Boolean).join(' · '),
      source: 'ghanapost',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Forward: digital address → coordinates */
export async function geocodeGhanaPostAddress(addressCode) {
  const cleaned = formatGhanaDigitalAddress(addressCode);
  if (!cleaned) return null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const body = new URLSearchParams({ address: cleaned.replace(/-/g, '') });
    const res = await fetch(`${BASE}/get-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });
    const json = await res.json();
    const row = json?.data?.Table?.[0];
    if (!row) return null;
    const lat = Number(row.CenterLatitude ?? row.NLat);
    const lng = Number(row.CenterLongitude ?? row.WLong);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      latitude: lat,
      longitude: lng,
      digitalAddress: formatGhanaDigitalAddress(row.GPSName || cleaned),
      area: row.Area || '',
      district: row.District || '',
      region: row.Region || '',
      source: 'ghanapost',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function ghanaPostUnavailablePlace(latitude, longitude) {
  return emptyPlace(latitude, longitude, 'ghanapost_failed');
}
