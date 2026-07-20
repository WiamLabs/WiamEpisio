# WiamEpisio Backend — Pre-HTML Checklist

**Status:** Implemented in codebase (await HTML screens + Cloudflare credentials for real video).  
**Law:** `docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md`

## Product locks

| Rule | Implementation |
|---|---|
| Novel = top button → full novel hub | `GET /api/v1/novel/hub` (wraps `home_sections_v2`) |
| Home chips | Returned by `GET /api/v1/watch/home` |
| Wiam Origin / VIP / Anime shelves | Content flags + `GET /api/v1/watch/shelf/<shelf>` |
| Rankings (soft, not Elite Hall of Fame) | `GET /api/v1/watch/rankings` + `POST /api/v1/internal/rankings/recompute` |
| Trailer QA (Founder ON/OFF) | `PlatformConfig.ff_trailer_quality_gate` |
| No half series | `PlatformConfig.ff_require_complete_series` + publish gate |
| Featured trailers (founder-curated) | `w_featured_trailer_slots` + founder CRUD |
| Coin bands | `GET /api/v1/coins/bands` |
| USD money + local display | `GET /api/v1/coins/packages?currency=GHS` + `GET /api/v1/fx` |
| Video provider | `VIDEO_PROVIDER=stub` until Cloudflare confirmed |

## Public / creator APIs

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/watch/home` | Popular, Fresh, shelves, featured trailers |
| GET | `/api/v1/watch/rankings?period=weekly` | Soft charts |
| GET | `/api/v1/watch/shelf/origin\|vip\|anime\|standard` | Shelf lists |
| GET | `/api/v1/series/<id>` | Enriched (episode_api) |
| GET | `/api/v1/series/<id>/trailer/stream` | Free trailer preview |
| POST | `/api/v1/creator/series/<id>/trailer/upload` | Trailer upload + auto QA |
| POST | `/api/v1/creator/series/<id>/trailer/qa` | Re-run trailer QA |
| POST | `/api/v1/creator/series/<id>/publish` | Complete + trailer gates |
| GET | `/api/v1/coins/bands` | Price bands |
| GET | `/api/v1/coins/packages?currency=GHS` | Local fiat display (USD base) |
| GET | `/api/v1/fx` | FX table |
| GET | `/api/v1/novel/hub` | Novel V2 sections |
| GET | `/api/v1/vip/status` | VIP skeleton |
| POST | `/api/v1/vip/claim-stipend` | Stub claim |

## Founder APIs (JWT + `is_founder`)

| Method | Path |
|---|---|
| GET/PATCH | `/api/v1/founder/episio/flags` |
| GET/POST | `/api/v1/founder/episio/featured` |
| PATCH/DELETE | `/api/v1/founder/episio/featured/<id>` |
| PATCH | `/api/v1/founder/episio/series/<id>` |
| GET/PATCH | `/api/v1/founder/episio/coin-bands` |
| POST | `/api/v1/internal/rankings/recompute` |

## Key files

- Models: `webapp/models.py` (Content catalog/trailer fields, TrailerQualityReport, FeaturedTrailerSlot, CoinPriceBand, FxRate, SeriesRankingSnapshot)
- Migrations: `webapp/__init__.py` (idempotent ALTER/CREATE after Episio Phase 1 block)
- Routes: `webapp/routes/episio_catalog_api.py`, enrichments in `episode_api.py` + `api_v1.py` packages
- Services: `trailer_qa.py`, `series_publish_gate.py`, `coin_pricing.py`, `currency_display.py`, `rankings.py`, `video_service.py`

## Out of this pass

- Expo HTML screens (hold screen remains until mockups)
- Real Cloudflare Stream contract
- In-app episode cutter
- AI home re-ranking
