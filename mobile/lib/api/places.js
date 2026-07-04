// © 2026 WiamApp. Powered by WiamLabs
// lib/api/places.js
// Google Places API — works for EVERY Ghana town, village, district
// Replaces Nominatim (OpenStreetMap) which misses small Ghana towns
// API Key: EXPO_PUBLIC_GOOGLE_PLACES_KEY (set in .env)

const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;

// ── SEARCH CITIES / TOWNS / VILLAGES ─────────────────────────
// Works for: Accra, Kwahu Tafo, Juaben, Berekum, Dambai, everywhere
export async function searchPlaces(query, countryCode = 'GH') {
  if (!query || query.trim().length < 2) return [];

  // If no Google key set, fall back to improved Nominatim
  if (!PLACES_KEY || PLACES_KEY === 'YOUR_GOOGLE_PLACES_KEY') {
    return searchPlacesNominatim(query, countryCode);
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json`
      + `?input=${encodeURIComponent(query)}`
      + `&types=(cities)`
      + `&components=country:${countryCode.toLowerCase()}`
      + `&key=${PLACES_KEY}`;

    const res  = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[Places] Google API error:', data.status, data.error_message);
      return searchPlacesNominatim(query, countryCode); // Fallback
    }

    return (data.predictions || []).map(p => ({
      id:          p.place_id,
      name:        p.structured_formatting?.main_text        || p.description.split(',')[0],
      region:      p.structured_formatting?.secondary_text   || '',
      fullAddress: p.description,
      placeId:     p.place_id,
      source:      'google',
    }));
  } catch (e) {
    console.warn('[Places] Google search error:', e.message);
    return searchPlacesNominatim(query, countryCode);
  }
}

// ── SEARCH ANY ADDRESS (for booking address field) ────────────
// Includes streets, landmarks, schools, markets — not just cities
export async function searchAddresses(query, countryCode = 'GH') {
  if (!query || query.trim().length < 2) return [];

  if (!PLACES_KEY || PLACES_KEY === 'YOUR_GOOGLE_PLACES_KEY') {
    return searchPlacesNominatim(query, countryCode);
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json`
      + `?input=${encodeURIComponent(query)}`
      + `&components=country:${countryCode.toLowerCase()}`
      + `&key=${PLACES_KEY}`;

    const res  = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return searchPlacesNominatim(query, countryCode);
    }

    return (data.predictions || []).map(p => ({
      id:          p.place_id,
      name:        p.structured_formatting?.main_text        || p.description.split(',')[0],
      region:      p.structured_formatting?.secondary_text   || '',
      fullAddress: p.description,
      placeId:     p.place_id,
      source:      'google',
    }));
  } catch (e) {
    return searchPlacesNominatim(query, countryCode);
  }
}

// ── GET COORDINATES FOR A PLACE ───────────────────────────────
// Use after user selects a place — get lat/lng for GPS
export async function getPlaceCoordinates(placeId) {
  if (!PLACES_KEY || PLACES_KEY === 'YOUR_GOOGLE_PLACES_KEY') return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json`
      + `?place_id=${placeId}`
      + `&fields=geometry,formatted_address,name`
      + `&key=${PLACES_KEY}`;

    const res  = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK') return null;
    const loc = data.result?.geometry?.location;
    return {
      lat:     loc?.lat,
      lng:     loc?.lng,
      address: data.result?.formatted_address,
      name:    data.result?.name,
    };
  } catch (e) {
    console.warn('[Places] getCoordinates error:', e.message);
    return null;
  }
}

// ── IMPROVED NOMINATIM FALLBACK ───────────────────────────────
// Used when Google API key is not set
// Fixed: includes ALL place types (hamlet, locality, administrative etc.)
// This finds Kwahu Tafo, Juaben, small Ghana towns that the old version missed
async function searchPlacesNominatim(query, countryCode = 'GH') {
  try {
    const cc  = countryCode.toLowerCase();
    // ✅ KEY FIX: Removed the strict type filter that was blocking small towns
    // Old code: .filter(r => ['city','town','village'].includes(r.type))
    // New code: accepts ALL place types including hamlet, locality, administrative
    const url = `https://nominatim.openstreetmap.org/search`
      + `?q=${encodeURIComponent(query)}`
      + `&countrycodes=${cc}`
      + `&format=json`
      + `&addressdetails=1`
      + `&limit=8`
      + `&featuretype=settlement`; // Gets cities, towns, villages, AND hamlets

    const res  = await fetch(url, {
      headers: { 'User-Agent': 'WiamApp/1.0 (support@wiamapp.com)' },
    });
    const data = await res.json();

    const seen = new Set();
    const results = [];

    for (const r of data) {
      // Extract the best name from the result
      const name = r.address?.city
        || r.address?.town
        || r.address?.village
        || r.address?.hamlet        // ✅ NEW: includes hamlets
        || r.address?.locality      // ✅ NEW: includes localities
        || r.address?.suburb
        || r.display_name.split(',')[0].trim();

      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      results.push({
        id:          r.place_id,
        name,
        region:      r.address?.state || r.address?.region || r.address?.county || '',
        fullAddress: r.display_name,
        placeId:     null,
        source:      'nominatim',
        lat:         parseFloat(r.lat),
        lng:         parseFloat(r.lon),
      });
    }

    return results;
  } catch (e) {
    console.warn('[Places] Nominatim error:', e.message);
    return [];
  }
}
