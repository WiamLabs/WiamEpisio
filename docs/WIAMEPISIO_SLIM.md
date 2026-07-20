# WiamEpisio slim mode — what we cut (and what we did not)

## Goal

Make the product feel lighter without destroying engines we still need (auth, coins, Novel hub, Studio, Episio catalog).

## Backend (`EPISIO_SLIM=1` default)

**Not registered at boot** (code files kept; **DB tables not dropped**):

| Surface | Why parked |
|---|---|
| Classics | Novel-era library surface |
| Voice / WiamVox API | Separate product |
| WiamBot | Novel chat bot |
| Elite web routes | Replaced by soft **Rankings** APIs |
| Programs | Growth extras — not Episio MVP |
| Gifts / stickers routes | Optional later |

**Still registered (keep):**

Auth · books/reader (Novel hub) · Studio / Studio V2 · payments · coins · notifications · Bulletin · Premium · Founder · `api_v1` · `episode_api` · `episio_catalog_api` · SEO · apply/team/dashboard

**Restore heavy routes:** set Render env `EPISIO_SLIM=0` and redeploy.

## Mobile

Parked UI moved **out of `src/`** so Metro does not scan it:

- `WiamAppMobile/_parked/screens_legacy_text_edition/` (74 screens)
- `WiamAppMobile/_parked/components_legacy_text_edition/` (22 components)

Live UI: `EpisioHoldScreen` only until HTML mockups.

## Explicitly not deleted

- Novel BookDetail / Reader / V2 home screens (parked for Novel top button)
- Coin / wallet / ledger tables
- Bulletin / Studio tables
- Elite / Apex **tables** (retargeted as Rankings / Origin in new APIs)

## Do not

- Drop Postgres tables for “cleanup”
- Delete `_parked/` folders
- Re-enable every blueprint without a product reason
