# WiamEpisio Pass 1 — native test checklist

Watch-first core loop. Novel reader UI removed from nav (data/API intact). Design: `html/watch-home.html`, `series-detail.html`, `player.html`, `design-system.css`.

## Setup

1. `cd WiamAppMobile && npm install`
2. Native rebuild if `expo-video` / fonts need it
3. API: `EXPO_PUBLIC_API_URL` → `https://wiamapp.com/api/v1` (or LAN)

## Pass 1 smoke

- [ ] Cold start (guest) → **Watch Home** (Wiamepisio wordmark, chips, hero) — no login wall, no Novel button
- [ ] Genre chip / Browse → **CategoryResults** → series card → **SeriesDetail**
- [ ] SeriesDetail sticky **Watch episode 1** → **Player**
- [ ] Free episodes stream as guest; locked shows unlock / signup gate
- [ ] Library → continue watching when logged in; guest signup CTA
- [ ] `wiamapp://book/1` / `novels` → Watch Home (redirect)
- [ ] `wiamapp://series/<id>` → SeriesDetail
- [ ] `wiamapp://watch/<seriesId>/<episodeId>` → Player
- [ ] Studio New story / chapter editor → Coming soon stub (no crash)

## Deferred (Pass 2 / 3)

EpisodeUnlockSheet, SeriesPass, Comments, episode upload wizard, Premium merge, WatchStats/Streaks, full Profile/Creator redesign.
