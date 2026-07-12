// © 2026 WiamApp. Powered by WiamLabs
// Shared GPS → place name. Prefer native geocoder; Nominatim is fallback only.
// Never treat "Community 14"-style estate labels as the City field.

import * as Location from 'expo-location';

function isEstateLabel(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim();
  // Tema/Accra estate numbering + pure road codes that confuse users
  return (
    /^community\s*\d+/i.test(n)
    || /^comm\.?\s*\d+/i.test(n)
    || /^sector\s*\d+/i.test(n)
    || /^block\s*[a-z0-9]+$/i.test(n)
  );
}

function pickFirst(...candidates) {
  for (const c of candidates) {
    const v = (c || '').trim();
    if (v && !isEstateLabel(v)) return v;
  }
  return '';
}

/**
 * @returns {{ city: string, landmark: string, region: string, label: string, source: string }}
 */
export async function reverseGeocodePlace(latitude, longitude) {
  // 1) Native (Android/iOS) — usually better than OSM for Ghana suburbs
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const r = results?.[0];
    if (r) {
      const city = pickFirst(r.city, r.subregion, r.district, r.region);
      const landmark = pickFirst(
        isEstateLabel(r.district) ? r.district : '',
        isEstateLabel(r.name) ? r.name : '',
        r.street,
        r.name,
        r.district,
      );
      const region = (r.region || r.subregion || '').trim();
      if (city || landmark) {
        return {
          city: city || landmark,
          landmark: landmark && landmark !== city ? landmark : '',
          region,
          label: [landmark, city, region].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
          source: 'native',
        };
      }
    }
  } catch {
    // fall through to Nominatim
  }

  // 2) Nominatim — city-level first (zoom 12), then finer for landmark
  try {
    const headers = { 'User-Agent': 'WiamApp/1.0 (support@wiamapp.com)', Accept: 'application/json' };
    const base = 'https://nominatim.openstreetmap.org/reverse'
      + `?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;

    const [cityRes, fineRes] = await Promise.all([
      fetch(`${base}&zoom=12`, { headers }),
      fetch(`${base}&zoom=16`, { headers }),
    ]);
    const cityData = await cityRes.json();
    const fineData = await fineRes.json();
    const ca = cityData?.address || {};
    const fa = fineData?.address || {};

    const city = pickFirst(
      ca.city, ca.town, ca.municipality, ca.village,
      ca.county, ca.state_district,
      fa.city, fa.town, fa.municipality, fa.village,
      ca.state,
    );

    const landmarkRaw = pickFirst(
      fa.suburb, fa.neighbourhood, fa.residential, fa.quarter, fa.hamlet,
      fa.road, fa.amenity,
    );
    // Keep estate labels in landmark only
    const estate = [fa.suburb, fa.neighbourhood, fa.residential, fa.quarter]
      .map((x) => (x || '').trim())
      .find((x) => isEstateLabel(x));
    const landmark = estate || (landmarkRaw && landmarkRaw !== city ? landmarkRaw : '');

    const region = pickFirst(ca.state, fa.state, ca.region, fa.region);

    return {
      city: city || landmark || '',
      landmark: landmark && landmark !== city ? landmark : '',
      region,
      label: [landmark, city, region].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      source: 'nominatim',
    };
  } catch {
    return {
      city: '',
      landmark: '',
      region: '',
      label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      source: 'coords',
    };
  }
}
