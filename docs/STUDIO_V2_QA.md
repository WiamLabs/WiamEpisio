# WiamStudio V2 — manual QA checklist

Last updated 2026-04-30 (Push 11). Use this when smoke-testing a fresh build before promoting to internal testing or production. Estimated time end-to-end: ~25 min for a creator account, ~10 min for a reader account.

## Setup

- Web: log in as **founder** at https://wiamapp.com (founder accounts are auto-granted Studio Pro on boot).
- Mobile: install the Expo build, log in with the same founder account.
- Optional: sign up a fresh reader account to also test the public Universe / Series flows.

If you can, run `python scripts/qa/comprehensive_bot.py` from the repo root once before starting — it confirms every backend route is reachable.

Versioned summary of the six safety items: [WORKSTREAM_U_PRODUCTION_SAFETY.md](WORKSTREAM_U_PRODUCTION_SAFETY.md).

---

## 0. Database safety (before any major migration)

**Do this before** running `flask migrate-studio-v2`, large `ALTER TABLE` batches, or any one-off data repair on production.

1. Open the [Supabase dashboard](https://supabase.com/dashboard) for the project linked from Render (`DATABASE_URL`).
2. Go to **Database → Backups** (or **Settings → Database** depending on UI).
3. Trigger a **manual backup** / snapshot if your plan allows it; otherwise use **Point in time** recovery window documentation and note the current time.
4. If manual snapshot is not available on your tier, run **SQL → Export** for critical tables (`users`, `content`, `w_book_content`, `w_creator_settings`) as a safety CSV before the migration.

This costs **$0** and is the fastest way to recover if a migration partially fails.

---

## 1. Creator onboarding (tiny gate)

Path: open mobile app → drawer → **Become a creator**.

- [ ] Form has only **Pen name** + **Terms** checkbox.
- [ ] Submitting promotes the user immediately (no pending state).
- [ ] `WelcomeCreatorScreen` appears with animated sparkles.
- [ ] CTA "Open WiamStudio" lands on the Studio root (Library tab).
- [ ] Push notification "Welcome to WiamStudio" arrives within ~30s.
- [ ] Drawer now shows the **Studio** entry.

Repeat on web: `/become-creator` → same single-step form.

---

## 2. Studio first-time tour

- [ ] On a brand-new creator account, opening Studio shows the 3-card tour modal (Welcome → Group what you write → Pro unlocks).
- [ ] Skipping or completing dismisses the modal.
- [ ] Tour does NOT show again on subsequent opens.
- [ ] **Settings → Replay welcome tour** brings it back.

---

## 3. Studio 5-tab navigation

Tab bar contains: **Library · Editor · Schedule · Money · Settings**.

- [ ] All 5 tabs render without crash.
- [ ] Distinct visual identity (indigo/violet, NOT app's wine/gold).
- [ ] Crown badge or Upgrade pill in Library top-right based on Pro status.

---

## 4. Library — Stories

- [ ] "+ New story" opens `NewStory`.
- [ ] Existing stories appear with cover, status, chapter count, view count.
- [ ] Tapping a story opens `StoryManager`.
- [ ] Pull-to-refresh works.

---

## 5. Library — Series & Universes

- [ ] When **NOT Pro**: "+ New series" / "+ New universe" rows show "Pro · New …" label and a lock icon. Tap routes to `StudioProPaywall`.
- [ ] When **Pro**: tap "+ New series" → `SeriesEditor` (mode=create).
- [ ] Save creates the series; appears in Library list.
- [ ] Edit series: change title / description / status; save persists.
- [ ] Add a book to series → it shows in the books-in-series list.
- [ ] Delete series prompts confirm; books are NOT deleted.
- [ ] Same flow for universes (`UniverseEditor`).

---

## 6. Schedule tab

- [ ] If no chapters scheduled, empty state with "Open a chapter, tap calendar…" CTA.
- [ ] Schedule a chapter via the chapter editor (or directly via API for QA: `POST /api/v1/studio/stories/<id>/chapter/<n>/schedule`).
- [ ] Schedule tab now lists the chapter, sorted by date.
- [ ] Tapping the row opens `ChapterEditor`.
- [ ] When the scheduled time passes (or `/api/v1/internal/publish-due` is poked), the chapter status transitions to `published` and a push goes out to followers.

---

## 7. Money tab

- [ ] Header "Money" with subtitle.
- [ ] If Pro: "You're on Studio Pro" hero with plan/status.
- [ ] If not Pro: "Unlock Studio Pro" hero — tap → paywall.
- [ ] Two stat cards (All-time earned, Available).
- [ ] "Open earnings dashboard" routes to existing `Earnings` screen.

---

## 8. Studio Pro paywall

- [ ] Hero crown icon, "Take your storytelling further" title.
- [ ] If `route.params.reason` set, shows "You hit a Pro feature: <reason>.".
- [ ] 5 feature rows visible (Series, Universes, Scheduling, Premium locking, AI tools).
- [ ] Product list loads from `/studio/pro/products` (monthly + annual).
- [ ] Tapping a product calls `/studio/pro/iap-receipt` (stub).
  - On founder account this should succeed (user is already Pro).
  - On non-Pro test account it returns success but the IAP layer is currently a stub — Push 12+ wires real RevenueCat.

---

## 9. Settings tab

- [ ] Default unit picker (chapter / episode / part / scene). Selection persists across reloads.
- [ ] Tool visibility toggles (Series, Universes, Arcs, Scheduling, Premium lock, AI tools). Each round-trips to `/studio/settings`.
- [ ] Notification toggle (`Scheduled publish notifications`) persists.
- [ ] Beta gate (`Studio V2 beta`) persists.
- [ ] **Replay welcome tour** button reopens the modal.
- [ ] **AI tools** toggle ON reveals "Preview AI roadmap & join waitlist" pill → `AIComingSoon` screen.
- [ ] AI Coming Soon **Notify me** button toggles `ai_waitlist=true`. Reopening the screen shows the green "You're on the waitlist" state.

---

## 10. Reader V2 — series progression

Setup: pick a public book that belongs to a public series.

- [ ] On `BookDetail`, a gold "SERIES — Book X of Y" banner appears under the synopsis.
- [ ] Tapping the banner opens `SeriesDetail` (ordered book list, parent universe link, "Start with `<book #1>`" CTA).
- [ ] Reading to the LAST chapter of the book — the end-of-story zone shows the "NEXT IN SERIES" card.
- [ ] Tapping "Continue the journey →" replaces the route with the next book's `BookDetail`.
- [ ] If the book is NOT in a series, the banner is silent (no error).

---

## 11. Reader V2 — Universe page

- [ ] Open `wiamapp://universe/<id>` deep link OR navigate from a series page.
- [ ] Hero cover, kind/title, creator strip, description, counts.
- [ ] Series cards each carry up to 6 mini book covers.
- [ ] Tapping a series card → `SeriesDetail`.
- [ ] Tapping a mini book → `BookDetail`.
- [ ] Share sheet uses `https://wiamapp.com/universe/<id>`.

---

## 12. Reader V2 — chapter access lookup

- [ ] `GET /books/<id>/chapter/<n>/access` returns the right shape for each user state:
  - Free chapter: `coin_locked=false`, `premium_locked=false`, `can_read=true`.
  - Coin-locked chapter (un-unlocked, not creator): `coin_locked=true`, `can_read=false`, `price_coins>0`.
  - Coin-locked chapter, creator viewing own book: `is_creator=true`, `can_read=true`.
  - Premium-locked chapter, premium subscriber: `is_premium_subscriber=true`, `can_read=true`.

---

## 13. Engagement tracking

After interacting with the app for ~5 min, verify analytics events landed in `w_analytics_events`:

```sql
SELECT event_type, COUNT(*) FROM w_analytics_events
WHERE created_at > NOW() - INTERVAL '10 minutes'
GROUP BY event_type ORDER BY 2 DESC;
```

Expect rows for: `book_view`, `home_impression`, `home_click`, `favorite`, `rating` (if you rated), `comment`, `creator_follow` (if you tapped Follow), etc.

---

## 14. Cloudinary delete-on-replace

- [ ] Upload a profile picture → confirm the new URL.
- [ ] Replace it with a different one → the old `public_id` should no longer resolve (404 from Cloudinary).
- [ ] Same for book cover (web Studio + mobile cover picker).
- [ ] Same for voice cover (WiamVox upload from mobile).

---

## 15. Wire audit

```
python scripts/qa/wire_audit.py --strict
```

Expected: `No suspicious handlers found. Every interactive surface has a handler.` Exit code 0. If anything pops up, it's a regression — fix or convert the touchable to a `<View>`.

---

## 16. Backend smoke

```
python scripts/qa/comprehensive_bot.py
```

Expected: ~80%+ probes PASS (some are intentionally `200..499` because they touch user-specific data). Anything 5xx is a regression.

---

## 17. Known limitations (Push 11 cut-off)

- Real RevenueCat IAP wiring is still a stub for Studio Pro. Founder accounts can flow through end-to-end because they're already Pro at boot.
- AI tools are intentionally NOT shipped — `AIComingSoonScreen` captures interest only.
- `apple-app-site-association` and `assetlinks.json` are served but require the production keystore SHA-256 to validate iOS/Android deep links.
- Ban-list / moderation queue UI for Cloudinary moderation rejects is logged but not yet surfaced in the QA dashboard.
