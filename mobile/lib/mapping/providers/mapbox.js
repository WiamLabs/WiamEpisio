// © 2026 WiamApp. Powered by WiamLabs
// lib/mapping/providers/mapbox.js — global default geocoding (blueprint)

import { emptyPlace, isEstateLabel, pickFirst } from '../normalize.js';

const TOKEN = () => process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

export function isMapboxConfigured() {
  const t = TOKEN();
  return !!(t && t !== 'YOUR_MAPBOX_TOKEN' && t.startsWith('pk.'));
}

/**
 * Reverse geocode via Mapbox Geocoding API.
 * Better global coverage than Nominatim; still OSM-derived in places —
 * Ghana should prefer GhanaPost plug-in first.
 */
export async function reverseMapbox(latitude, longitude) {
  if (!isMapboxConfigured()) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/`
      + `${longitude},${latitude}.json`
      + `?access_token=${encodeURIComponent(TOKEN())}`
      + `&types=address,place,locality,neighborhood,district`
      + `&limit=1`;
    const res = await fetch(url);
    const json = await res.json();
    const feature = json?.features?.[0];
    if (!feature) return null;

    const ctx = feature.context || [];
    const byId = (prefix) => ctx.find((c) => String(c.id || '').startsWith(prefix));

    const place = byId('place')?.text || '';
    const locality = byId('locality')?.text || '';
    const neighborhood = byId('neighborhood')?.text || '';
    const district = byId('district')?.text || '';
    const region = byId('region')?.text || '';
    const text = feature.text || '';

    const city = pickFirst(place, locality, district, region);
    const landmarkCand = [neighborhood, text, locality].find(Boolean) || '';
    const landmark = landmarkCand && landmarkCand !== city ? landmarkCand : '';

    // Never promote estate labels to city
    const safeCity = isEstateLabel(city) ? (place || region || '') : city;

    return {
      city: safeCity || landmark,
      landmark: isEstateLabel(landmarkCand) || (landmark && landmark !== safeCity) ? landmarkCand : landmark,
      region,
      district,
      street: feature.place_type?.includes('address') ? text : '',
      digitalAddress: '',
      label: feature.place_name || [landmark, safeCity, region].filter(Boolean).join(', '),
      source: 'mapbox',
    };
  } catch {
    return null;
  }
}

export async function searchMapbox(query, countryCode = '') {
  if (!isMapboxConfigured() || !query || query.trim().length < 2) return [];
  try {
    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/`
      + `${encodeURIComponent(query.trim())}.json`
      + `?access_token=${encodeURIComponent(TOKEN())}`
      + `&types=place,locality,neighborhood,address,district`
      + `&limit=8`
      + `&autocomplete=true`;
    if (countryCode) url += `&country=${encodeURIComponent(countryCode.toLowerCase())}`;

    const res = await fetch(url);
    const json = await res.json();
    return (json.features || []).map((f) => ({
      id: f.id,
      name: f.text || f.place_name?.split(',')[0],
      region: (f.context || []).find((c) => String(c.id).startsWith('region'))?.text || '',
      fullAddress: f.place_name,
      placeId: f.id,
      source: 'mapbox',
      lat: f.center?.[1],
      lng: f.center?.[0],
    }));
  } catch {
    return [];
  }
}

export function mapboxUnavailable(latitude, longitude) {
  return emptyPlace(latitude, longitude, 'mapbox_failed');
}
