// © 2026 WiamApp. Powered by WiamLabs
// lib/mapping/providers/native.js — device geocoder

import * as Location from 'expo-location';
import { emptyPlace, isEstateLabel, pickFirst } from '../normalize.js';

export async function reverseNative(latitude, longitude) {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const r = results?.[0];
    if (!r) return null;

    const city = pickFirst(r.city, r.subregion, r.district, r.region);
    const landmark = pickFirst(
      isEstateLabel(r.district) ? r.district : '',
      isEstateLabel(r.name) ? r.name : '',
      r.street,
      r.name,
      r.district,
    );
    const region = (r.region || r.subregion || '').trim();
    if (!city && !landmark) return null;

    return {
      city: city || landmark,
      landmark: landmark && landmark !== city ? landmark : '',
      region,
      district: r.district || '',
      street: r.street || '',
      digitalAddress: '',
      label: [landmark, city, region].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      source: 'native',
    };
  } catch {
    return null;
  }
}

export function nativeUnavailable(latitude, longitude) {
  return emptyPlace(latitude, longitude, 'native_failed');
}
