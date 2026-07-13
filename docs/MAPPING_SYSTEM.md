# WiamApp Mapping — Migration notes
### © 2026 WiamApp. Powered by WiamLabs

Based on **WiamApp Mapping Migration Blueprint** (Mapbox global + local plug-ins).

## Verdict

| Blueprint idea | Fit for WiamApp? | Status |
|----------------|------------------|--------|
| Replace OSM Nominatim as primary | **Yes** — OSM community labels (e.g. Comm 14 vs 18) are unreliable | Done in code |
| Mapbox as global geocoding default | **Yes** — worldwide, free tier | Ready (needs `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`) |
| GhanaPostGPS Ghana plug-in | **Yes — this fixes Tema/Sakumono community mismatches** | Live when GPS is in Ghana |
| Mapbox map tiles / GL maps | Yes later | Not required to fix address labels |
| Google Maps later | Only if revenue covers cost | Optional, already stubbed in places.js |

**Important:** Mapbox alone is still partly OSM-derived in West Africa. For Ghana, **GhanaPostGPS is the accuracy layer**. Matching workers uses **lat/lng**, not the name string.

## Reverse-geocode order

1. GhanaPostGPS (if country/GPS is Ghana)  
2. Mapbox (if token set)  
3. Device native geocoder  
4. Nominatim OSM (last resort only)

## Env

```
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_public_token
```

Get a free token at https://account.mapbox.com/ — set a spending cap in the Mapbox dashboard.

GhanaPost community API needs no key for the public SperixLabs endpoints used here.

## Files

- `mobile/lib/mapping/` — providers + Ghana plug-in  
- `mobile/lib/reverseGeocode.js` — re-exports  
- Register / Customer / Worker “Use my location” wired to the new stack  

## Still true for workers

Always save **GPS coordinates**. Names are for humans. Weak GPS (±150m+) still needs outdoor retry or manual edit.
