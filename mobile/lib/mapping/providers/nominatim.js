// © 2026 WiamApp. Powered by WiamLabs
// lib/mapping/providers/nominatim.js — LAST-resort OSM fallback only

import { emptyPlace, isEstateLabel, pickFirst } from '../normalize.js';

export async function reverseNominatim(latitude, longitude) {
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
    const estate = [fa.suburb, fa.neighbourhood, fa.residential, fa.quarter]
      .map((x) => (x || '').trim())
      .find((x) => isEstateLabel(x));
    const landmark = estate || (landmarkRaw && landmarkRaw !== city ? landmarkRaw : '');
    const region = pickFirst(ca.state, fa.state, ca.region, fa.region);

    return {
      city: city || landmark || '',
      landmark: landmark && landmark !== city ? landmark : '',
      region,
      district: '',
      street: fa.road || '',
      digitalAddress: '',
      label: [landmark, city, region].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      source: 'nominatim',
    };
  } catch {
    return emptyPlace(latitude, longitude, 'nominatim_failed');
  }
}
