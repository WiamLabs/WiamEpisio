// © 2026 WiamApp. Powered by WiamLabs
// lib/mapping/index.js
// Global Mapbox + country plug-ins (GhanaPostGPS) per Mapping Migration Blueprint.
//
// Matching truth: lat/lng from the phone GPS are authoritative.
// Place NAMES are labels only — never trust OSM community numbers alone.

import { reverseGhanaPost, geocodeGhanaPostAddress } from './plugins/ghanapost.js';
import { reverseMapbox, searchMapbox, isMapboxConfigured } from './providers/mapbox.js';
import { reverseNative } from './providers/native.js';
import { reverseNominatim } from './providers/nominatim.js';
import { emptyPlace, formatGhanaDigitalAddress } from './normalize.js';

/**
 * Detect country for plug-in selection.
 */
export function resolveMappingCountry({ countryCode, latitude, longitude } = {}) {
  const cc = String(countryCode || '').toUpperCase();
  if (cc === 'GH' || cc === 'GHA') return 'GH';

  // Rough Ghana bounding box — activates GhanaPost when GPS is in Ghana
  if (
    typeof latitude === 'number'
    && typeof longitude === 'number'
    && latitude >= 4.5 && latitude <= 11.2
    && longitude >= -3.5 && longitude <= 1.3
  ) {
    return 'GH';
  }
  return cc || 'WORLD';
}

/**
 * Reverse-geocode for registration / profile “Use my location”.
 *
 * Order (blueprint):
 * 1. Country plug-in (Ghana → GhanaPostGPS) when applicable
 * 2. Mapbox (global default) when token configured
 * 3. Native device geocoder
 * 4. Nominatim OSM — last resort only
 */
export async function reverseGeocodePlace(latitude, longitude, opts = {}) {
  const country = resolveMappingCountry({
    countryCode: opts.countryCode,
    latitude,
    longitude,
  });

  if (country === 'GH') {
    const gh = await reverseGhanaPost(latitude, longitude);
    if (gh?.digitalAddress || gh?.city || gh?.landmark) {
      return gh;
    }
  }

  if (isMapboxConfigured()) {
    const mb = await reverseMapbox(latitude, longitude);
    if (mb?.city || mb?.landmark || mb?.label) return mb;
  }

  const native = await reverseNative(latitude, longitude);
  if (native?.city || native?.landmark) return native;

  const osm = await reverseNominatim(latitude, longitude);
  if (osm) return osm;

  return emptyPlace(latitude, longitude);
}

export async function searchPlacesGlobal(query, countryCode = '') {
  if (isMapboxConfigured()) {
    const mb = await searchMapbox(query, countryCode);
    if (mb.length) return mb;
  }
  const { searchPlaces } = await import('../api/places.js');
  return searchPlaces(query, countryCode || 'GH');
}

export { isMapboxConfigured, searchMapbox } from './providers/mapbox.js';
export { geocodeGhanaPostAddress };
export { formatGhanaDigitalAddress };
