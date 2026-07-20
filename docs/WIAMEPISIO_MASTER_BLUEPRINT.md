# WIAMEPISIO MASTER BLUEPRINT
### The Complete Enterprise Transformation Plan — WiamApp → WiamEpisio
**Parent company:** WiamLabs · **Version:** 1.0 · **Date:** July 15, 2026
**Grounded in:** Step 1 Migration Audit (130 models · 611 routes · 174 web templates · 65 Expo screens)

---

## HOW TO READ THIS DOCUMENT

Your Part 1 prompt set the *ambition*. The Step 1 audit your team already ran gave us the *ground truth* of what WiamApp actually is today. This blueprint fuses both: it is not a generic "how to build a drama app" document — every recommendation below is anchored to a real table, a real route, or a real screen that already exists in your codebase, plus the net-new systems required to become a watching-first platform.

I've written this as one continuous master document rather than 20 separate chat messages, because a blueprint that's scattered across parts is harder to execute against. Where your original prompt said "the next parts will cover X," I've covered X here — and where I disagreed with an implicit assumption or saw a gap (piracy protection, African bandwidth economics, the Series/Episode naming collision, IAP compliance risk), I've flagged it explicitly as **my addition** so you know what came from the audit vs. what came from me.

This is a living document. Treat every "Recommended" as a default you can override, not a mandate.

---

## PART 0 — EXECUTIVE SUMMARY

| | |
|---|---|
| **What WiamApp is today** | A mature novel-publishing platform: 130 database models, 611 API/web routes, full monetization (coins, wallet, subscriptions, tipping, creator payouts), moderation, RBAC, and admin tooling. Zero video infrastructure. |
| **What WiamEpisio must become** | A mobile-first vertical short-drama platform where the atomic unit of content is a **video episode**, not a chapter of text. |
| **The core strategic bet** | You are not competing on catalog size (Netflix) or virality algorithms alone (TikTok). You are competing on **owning the African short-drama supply chain** — creators, coins, and distribution — before global players localize. Reading becomes a retention feature, not the product. |
| **The technical bet** | ~85% of WiamApp's backend (auth, wallet, coins, social graph, moderation, payouts, notifications, RBAC) is format-agnostic and gets **reused, not rebuilt**. The ~15% that's novel-specific (chapter reader, paragraph comments, PDF export) gets parked, not deleted. The net-new build is: video storage/CDN, a player, an upload/transcode pipeline, and a redesigned discovery feed. |
| **The single highest-risk decision** | The `Series` naming collision (today `Series` = an ordered list of books). If this isn't resolved in Phase 1, every future engineer, every AI coding agent, and every support ticket will misfire on this word. See Part 4. |
| **The single highest-risk cost** | Video bandwidth and storage in African markets with variable 2G/3G/4G connectivity. This is not a "pick a CDN" decision — it's a unit-economics decision that determines whether your coin-unlock price covers your delivery cost. See Part 6 and Part 12. |

---

## PART 1 — VISION, ROLE & COMPANY DNA
*(Your original Part 1, refined and extended)*

### 1.1 The team lens
Every recommendation in this document was produced by reasoning through the lens of: Senior Software Architect, Principal Backend/Frontend Engineers, AI Systems Engineer, Database Architect, DevOps/Cloud Infrastructure Engineer, Streaming Media Engineer, Security Engineer, UI/UX Director, Product Manager, Brand Strategist, Creator Economy Expert, Recommendation Systems Engineer, Mobile Engineering Lead, Performance Engineer, Business Analyst, and CTO. Where those lenses disagree with each other (e.g., Security Engineer wants full DRM, Business Analyst wants zero DRM cost at MVP), I've resolved the tension explicitly rather than hiding it — that's what a real leadership team does.

### 1.2 Company identity

| Layer | Definition |
|---|---|
| **Parent company** | WiamLabs |
| **Flagship product** | WiamEpisio — vertical episodic entertainment |
| **Legacy product (retained, not killed)** | WiamApp novel/reading experience — becomes a secondary "Text Edition" surface inside the same account system |
| **Adjacent product (do not touch)** | WiamVox — voice/audio stories. Already has its own listen-progress and unlock pattern (`VoiceListenProgress`, `VoiceStoryUnlock`) that is a useful *pattern reference* for `WatchProgress`/`EpisodeUnlock`, but it is a separate product line and stays untouched. |
| **North Star metric (Year 1)** | Weekly Watching Users (WWU) with ≥3 episodes completed, not registered users. Registered-but-not-watching is a vanity metric inherited from the reading era. |
| **Company-building mindset** | You are not shipping a feature. You are re-founding the company around a new atomic unit of value (the episode) while keeping the treasury (coins), the citizens (users), and the government (RBAC/admin) intact. Think "Netflix in 1998 deciding DVD-by-mail was the wedge, not the destination" — WiamEpisio's short-drama vertical feed is your DVD-by-mail: the wedge that earns you the right to build originals, animation, and eventually a full studio.

### 1.3 Non-negotiable product philosophy
- **Watching is primary, reading is optional** — but reading is never deleted. A "Text Edition" toggle on a series lets legacy readers keep reading while new users watch. This protects existing engagement and SEO equity (174 templates, years of indexed content) while the pivot happens.
- **Do not clone DramaBox.** DramaBox's UX is a reasonable floor, not a ceiling. Your differentiation is (a) African-first storytelling and languages, (b) a creator economy that's already proven on WiamApp (payouts, tipping, subscriptions all exist and work), and (c) a unified coin economy across watching, reading, *and* listening (WiamVox) — no competitor has that three-format wallet.
- **Free-first-N is the retention contract.** Episodes 1–5 free, always, on every series, no exceptions, no A/B test that removes it. This is the single mechanic DramaBox/ReelShort proved works, and it maps directly onto your existing `ChapterUnlock` → `EpisodeUnlock` economics.

---

## PART 2 — THE TRANSFORMATION DOCTRINE

### 2.1 What "transformation, not rebuild" means in practice

| Audit category | Count | Doctrine |
|---|---:|---|
| Reusable as-is (auth, wallet, coins, moderation, RBAC, notifications, payouts) | ~60 models | **Keep.** Zero schema changes required to ship MVP. |
| Migrate in meaning (Content, progress, access, social) | ~35 models | **Repoint**, don't rewrite. Same tables, new content type, new event names. |
| Redesign the surface (Studio, discovery, player) | Frontend layer | **Full UX rebuild**, same auth/session/API client underneath. |
| Secondary / park (Classics, paragraph comments, offline PDF) | ~10 models + screens | **Do not delete.** Hide from primary nav. Revisit in Phase 4+ as a "Reader Club" retention layer. |
| Net-new (video, episodes, player, transcode) | 0 → ~8 new models | **Build from scratch**, but pattern-match against `WebBookContent` (unlock/progress shape) and `VoiceStory` (media + progress shape) so it fits the existing service layer conventions. |

### 2.2 The Golden Rule for every future engineering session
> **Before writing a line of code for WiamEpisio, ask: "Does a WiamApp table/route/service already do 80% of this for a different content type?"** If yes, extend it with a discriminator column or a sibling table that reuses the same service pattern. If no, build net-new but name it so it can never collide with an existing concept (see Part 4.1).

---

## PART 3 — PRODUCT ARCHITECTURE: WiamApp → WiamEpisio

### 3.1 The core loop (yours, annotated with the systems that already exist to power each step)

```
Open app                         → GuestHome/HomeScreen (EXISTS, redesign UI)
  ↓
Cinematic trailer feed           → NET NEW: trailer field on Episode/Content
  ↓
Vertical discovery feed          → home_sections_v2.py rail engine (EXISTS, repoint)
  ↓
Recommended series                → recommendation_service.py + popularity.py (EXISTS, repoint)
  ↓
Watch Episode 1                  → NET NEW: player + video CDN
  ↓
Autoplay Episode 2                → NET NEW: player controller
  ↓
Continue watching                 → ReadingProgress pattern → WatchProgress (MIGRATE)
  ↓
Unlock premium episode            → ChapterUnlock/CoinTransaction (MIGRATE, same economics)
  ↓
Follow creator                    → Follow model (EXISTS, unchanged)
  ↓
Comment                           → ChapterComment pattern → EpisodeComment (MIGRATE)
  ↓
Share                             → ShareEvent (EXISTS, unchanged)
```

**Reading**: of 13 loop steps, **9 reuse an existing system wholesale or with a repoint**, and only **4 are genuinely net-new** (trailer feed, player, autoplay, video CDN). That ratio is your entire capital-efficiency argument to investors: this is a wedge on top of a working platform, not a rebuild.

### 3.2 Dual-format account model
Every `User` keeps one identity, one wallet, one follower graph across Watch / Read / Listen. A `CreatorProfile` gains a `primary_format` field (`video` | `text` | `audio` | `hybrid`) purely for onboarding UX (which Studio do we default them into) — it never restricts what they can publish.

---

## PART 4 — DATABASE REDESIGN

### 4.1 Resolving the naming collision (blocking decision — resolve in Phase 1, Week 1)

The audit is correct to flag this as blocking. Here is my recommendation, with reasoning:

| Option | What it does | Verdict |
|---|---|---|
| A) New drama tables, leave `w_series` alone | Adds tables, avoids migration risk | **Rejected** — permanently confusing to every future dev/AI agent typing "series" |
| B) Repurpose `Content`/`WebBookContent` directly for episodes | Minimal new tables | **Rejected** — text and video have fundamentally different fields (duration, transcode status, DRM key, subtitle tracks) and different write patterns (multipart video upload vs. text save); cramming both into one table creates a table with 40% nullable columns |
| **C) Recommended: Rename the legacy concept, introduce the new one cleanly** | `w_series` (book-list) → renamed to `w_collections` (`Series` model → `Collection`, `SeriesContent` → `CollectionItem` at the class level); `Content` is extended with a `format` enum (`novel` \| `drama`) and becomes the **Series/Show** entity for both; a new `Episode` table is introduced as the video-native sibling of `WebBookContent` | **Do this.** It's a metadata-only rename (`ALTER TABLE ... RENAME`), touches ~30 route references (mechanical, scriptable), and permanently removes the collision. One week of cleanup now saves months of confusion later. |

### 4.2 New tables (net-new, Phase 1)

```
Episode
  id, content_id (FK → Content), episode_number, title, synopsis
  video_url, hls_manifest_url, poster_url, trailer_url
  duration_seconds, transcode_status (queued|processing|ready|failed)
  subtitle_tracks (jsonb: [{lang, url}])
  dub_tracks (jsonb, for AI dubbing — Phase 4)
  is_free (bool), unlock_price_coins (int)
  publish_at, published, view_count, avg_watch_pct
  created_at, updated_at

WatchProgress
  id, user_id, episode_id, seconds_watched, completed (bool), last_watched_at
  -- mirrors ReadingProgress shape 1:1; same service pattern

EpisodeUnlock
  id, user_id, episode_id, coins_spent, unlocked_at
  -- mirrors ChapterUnlock 1:1

EpisodeComment / EpisodeCommentLike
  -- mirrors ChapterComment / ChapterCommentLike 1:1

VideoAsset
  id, episode_id, original_upload_url, processed_renditions (jsonb),
  storage_provider, storage_key, checksum, size_bytes, status

SeriesTrailer (or trailer_url directly on Content — start simple)
  content_id, video_url, poster_url

WatchlistEntry
  -- UserLibrary already covers this; add nothing, just repoint

CreatorVideoUploadJob
  id, creator_id, episode_id, upload_status, transcode_job_id, error_message
```

### 4.3 Fields to add to existing tables (repoint, not rebuild)

| Table | New field(s) | Why |
|---|---|---|
| `Content` | `format` (novel/drama), `trailer_url`, `poster_url` (in addition to existing cover), `total_episodes`, `free_episode_count` (default 5) | Turns Content into the universal Series/Show entity |
| `CreatorProfile` | `primary_format` | Onboarding routing only |
| `Notification` | new `type` values: `new_episode`, `episode_unlocked`, `series_completed` | Reuses existing notification pipeline, zero schema change beyond enum values |
| `AnalyticsEvent` | new `event` values: `watch_start`, `watch_25`, `watch_50`, `watch_75`, `watch_complete`, `episode_unlock`, `trailer_view`, `swipe_skip` | Reuses existing event table |

### 4.4 What does NOT change
`User`, `CoinBalance`, `CoinTransaction`, `CoinPackage`, all RBAC tables, `Follow`, `Notification` core, `Report`/`ModerationLog`, all payout/earnings tables, `PremiumSubscription`. This is the majority of your 130 models — untouched.

---

## PART 5 — EPISODE & CONTENT ARCHITECTURE

### 5.1 Episode rules (product law, encode these as constraints, not conventions)
- Minimum episode duration: **90 seconds** (your audit's "≥1.5 min" rule) — enforced at transcode-validation step, not just UI copy.
- Maximum episode duration: recommend **12 minutes** as a soft cap for the vertical-drama format; longer-form goes in a separate "Originals/Films" content type later, not squeezed into Episode.
- Free-first-5 is enforced **server-side** in the unlock-check endpoint, never client-side only (prevents easy piracy bypass via API replay).
- Episodes publish in strict sequential order by default; creators can schedule future episodes (`publish_at`) reusing the existing chapter-scheduling pattern from Studio V2.

### 5.2 Text Edition (your reading legacy, preserved)
Any `Content` with `format = drama` may optionally have a linked `WebBookContent` "script/novelization" per episode for readers who prefer text. This is off by default, opt-in per creator, and solves two things at once: (1) it protects your SEO equity from 174 indexed reading pages, (2) it gives you a bridge migration path — existing novel creators can convert a novel into a drama by uploading episodes that reuse their existing chapters as the Text Edition.

### 5.3 Genre taxonomy (adopting the audit's proposal, Part 2 addition: rollout order)
Ship with the audit's **Primary tier only** at launch (Drama, Romance, Thriller, Comedy, Action, Fantasy, African Originals) to avoid an empty-shelf problem — a taxonomy with 15 genres and 3 series per genre looks worse than 7 genres with real depth. Add Secondary tier once you have >15 series per Primary genre.

---

## PART 6 — STREAMING MEDIA INFRASTRUCTURE *(net-new — this is the core build)*

### 6.1 Pipeline

```
Creator uploads raw video (Studio)
   ↓ resumable multipart upload → object storage (staging bucket)
   ↓ transcode job triggered (queue-based, async)
   ↓ output: HLS adaptive bitrate ladder (240p/360p/480p/720p, cap at 720p for MVP — 1080p is bandwidth cost you don't need yet)
   ↓ auto-generate poster frame + thumbnail sprite (for scrub preview)
   ↓ AI moderation pass (frame sample + audio transcription banned-word scan) — reuses content_guard.py pattern
   ↓ status → "ready", episode becomes publishable
   ↓ CDN-fronted delivery, signed short-TTL URLs
```

### 6.2 Vendor shortlist — decision matrix

| Provider | Strength | Weakness for you | Africa fit |
|---|---|---|---|
| **Cloudflare Stream** | Simple pricing (storage + delivery per minute), built-in player, encoding included | Less granular DRM control | **Strong** — Cloudflare has extensive African PoPs, good for 2G/3G/4G adaptive delivery |
| **Mux** | Best-in-class analytics, dev experience | Pricier at scale, US/EU-centric edge | Moderate |
| **AWS (S3 + MediaConvert + CloudFront + Shield)** | Full control, cheapest at very large scale, best DRM path (Widevine/FairPlay via Speke) | High complexity, needs dedicated infra engineer | Moderate — CloudFront African edge coverage is improving but historically thinner than Cloudflare |
| **Bunny Stream** | Cheapest entry price | Weaker enterprise analytics/support SLAs | Moderate |

**Recommendation:** Launch MVP on **Cloudflare Stream** — lowest operational complexity, predictable cost, and the best African edge coverage of the low-complexity options. Plan a migration path to **AWS-based custom pipeline** at the point where (a) monthly video egress exceeds a cost threshold where AWS's per-GB pricing wins, or (b) you need real DRM (Widevine/FairPlay) for exclusive Originals — target this reassessment at Phase 4.

### 6.3 Piracy & content protection *(my addition — not in your original prompt, but necessary)*
- **MVP (Phase 1–2):** signed URLs with short TTL, referrer/domain locking, no public direct video links ever exposed in API responses (always proxy through a token endpoint).
- **Phase 3:** dynamic watermarking — overlay a faint user-ID/timestamp watermark on premium episode streams, so leaked screen-recordings are traceable to the account that unlocked them. This alone deters most casual piracy without full DRM cost.
- **Phase 4+ (Originals/exclusives only):** Widevine/FairPlay DRM via a managed Speke-compatible key server. Do not pay for full DRM on user-generated content at MVP — the cost/complexity isn't justified until you have exclusive high-value Originals worth protecting.

### 6.4 Bandwidth economics (why this section exists)
A 5-minute episode at 480p H.264 is roughly 40–60MB per full watch. If your unlock price is, say, 10 coins (~$0.05–0.10 depending on your coin pricing), and delivery cost alone can be $0.005–0.02 per view depending on provider and region, **your margin per unlock is thin before creator revenue share is even applied.** This is not a reason to avoid video — it's a reason to (a) cap bitrate aggressively for free/unlocked-once views, (b) lean on ad-supported unlocks (reward-ad-to-unlock, which you already have via `AdImpression`/reward-unlock) to subsidize non-paying watch volume, and (c) revisit coin pricing for video specifically rather than reusing novel-era coin pricing unchanged.

---

## PART 7 — CREATOR STUDIO 2.0

### 7.1 What's reused vs. rebuilt

| Studio capability | Today (novel) | Episio |
|---|---|---|
| Apply/onboarding | `ApplyScreen`, `become_creator.html` | **Reused as-is** |
| Content creation | `NewStoryScreen` → text chapters | **Rebuilt**: New Series → Episode upload (resumable video) |
| Cover/poster | Cloudinary image upload | **Reused** — poster/trailer just add a video field alongside |
| Scheduling | Chapter `publish_at` (Studio V2) | **Reused pattern**, applied to episodes |
| Monetization toggle | Coin-lock per chapter | **Reused pattern**, applied per episode, defaulting to free-first-5 |
| Analytics | `StoryAnalyticsScreen`, `creator_story_analytics_api` | **Extended**: add watch-completion funnel, drop-off-by-second chart |
| Earnings/payouts | `EarningsScreen`, `CreatorPayout*` | **Reused as-is** |
| Studio Pro | `StudioProSubscription` | **Reused**, repositioned as advanced video tools (priority transcode, higher bitrate cap, analytics export) |

### 7.2 New Creator Studio flows (net-new)
1. **Series setup wizard**: title, genre, poster, trailer, synopsis, Text Edition toggle, release cadence (daily/weekly/all-at-once).
2. **Episode upload**: drag-drop or mobile-capture → resumable upload → live transcode status indicator → auto-poster selection with manual override.
3. **Episode order/reorder**: drag-and-drop, same UX pattern as Studio V2's book reordering.
4. **Bulk scheduling**: set a release calendar for an entire season at once.
5. **AI co-pilot panel** (Phase 4): auto-generate synopsis, suggested title, thumbnail candidates, and a trailer cut from raw footage.

---

## PART 8 — AI SYSTEMS (Production, Moderation, Growth)

| System | Purpose | Phase | Builds on |
|---|---|---|---|
| AI content moderation for video | Frame-sample + audio-transcript banned-word/violence screening | Phase 2 | `content_guard.py`, `BannedWord`, `moderation.py` |
| AI subtitles + dubbing | Multi-language reach (English/French/Swahili/Hausa/Yoruba/Zulu, etc.) — critical for pan-African + eventual global expansion | Phase 3–4 | Net new; feeds `subtitle_tracks`/`dub_tracks` on `Episode` |
| AI trailer auto-cut | Reduce creator friction — auto-generate a 15-second hook trailer from raw episode footage | Phase 4 | Net new |
| AI recommendation re-ranking | Session-based re-ranking on top of rule-based rails | Phase 3 | `recommendation_service.py`, `popularity.py` |
| AI creator co-pilot | Title/synopsis/thumbnail suggestions | Phase 4 | `ai_curation.py`, `ai_service.py`, `founder_ai.py` |
| AI productions (fully AI-generated series) | Long-horizon differentiator vs. every competitor | Phase 5+ | Net new — do not commit engineering time here before Phase 3 ships |

---

## PART 9 — RECOMMENDATION ENGINE

### 9.1 Reuse the rail engine, change the signals
`home_sections_v2.py` already rotates configurable home rails. Keep the *engine*, replace the *rail definitions*:

**Launch rails:** Continue Watching · Trending Now · New Releases · For You · African Originals · Popular Creators · Because You Watched [Series] · Free Today

### 9.2 Signal evolution
- **Novel-era implicit signals**: chapter completion, favorite, rating, reading streak.
- **Episio signals (net new, higher-frequency, richer)**: watch_start, 25/50/75/100% completion, rewatch, swipe-away (rejection signal — critically valuable and something reading never captured), session binge length, share, comment.

### 9.3 Rollout
- **Phase 2**: rule-based rails only (popularity + recency + genre affinity) — this alone beats a cold-start ML model.
- **Phase 3**: collaborative filtering "For You" using `AnalyticsEvent` history — start with simple item-item similarity (co-watched series), not a full deep model.
- **Phase 4+**: session-based sequence re-ranking (the TikTok-style "what to autoplay next" model).

---

## PART 10 — WIAMCOINS ECONOMY 2.0

| Mechanic | Novel era | Episio |
|---|---|---|
| Unlock unit | Chapter | Episode |
| Free tier | Varies per book | **Hard rule: episodes 1–5 free, every series** |
| Unlock cost | Flat per chapter | Tiered by production value (indie vs. studio-backed vs. Original) — recommend 3 price bands rather than one flat price |
| Bundle | None | **New: "Series Pass"** — unlock all remaining episodes of a season at a discount vs. per-episode |
| Ad-subsidized unlock | Exists (`reward_ad_unlock`) | **Reused, promoted** — critical lever for margin protection given bandwidth economics (Part 6.4) |
| Gifting/tipping | Exists | Reused as-is, extended to "gift a Series Pass to a friend" |
| Creator revenue share | `CommissionSettings`/`RevenueRule` | Reused engine; recommend **tiered default 55–70%** creator share (higher for exclusive/Original content, to attract supply) |

---

## PART 11 — SUBSCRIPTION / PREMIUM TIER

Evolve `PremiumSubscription`/`EliteSubscription`/`CreatorSubscription` into a single **"WiamEpisio Premium"** tier:
- Ad-free watching
- Early access to new episodes (24–48h ahead of free tier)
- Monthly coin stipend (reuse `PremiumCreditsLedger`)
- Access to exclusive Originals (once Studio productions exist, Phase 5)
- Creator-specific subscription tiers (`CreatorSubTier`) remain as a *parallel*, per-creator premium layer — don't merge these two subscription concepts, they serve different jobs (platform-wide Premium vs. supporting-one-creator Patreon-style tier).

---

## PART 12 — BUSINESS MODEL & MONETIZATION

*(Illustrative planning framework, not financial guidance — validate unit economics against your actual delivery costs before committing to pricing.)*

### 12.1 Revenue streams
1. Coin purchases (episode unlocks, tips, gifts) — primary, proven mechanic
2. WiamEpisio Premium subscriptions — recurring revenue, margin-healthy
3. Creator subscriptions (platform take-rate on `CreatorSubscription`)
4. Rewarded ads (unlock-via-ad, plus standard impression ads on free tier)
5. Future: brand partnerships / sponsored Originals (Phase 5+)

### 12.2 Unit economics discipline
Every pricing decision must clear: `coin price per unlock > (video delivery cost + payment processing fee) / (1 − creator revenue share)`. Track this as a live founder-dashboard metric from Phase 2 onward — this is a **new founder dashboard page**, not something to infer manually.

### 12.3 Creator economy as moat
Your existing payout infrastructure (`CreatorPayout`, `CreatorEarnings`, `CreatorMilestone`, `TeamPayroll`-adjacent trust systems) is a 1–2 year head start no video-only competitor entering Africa will have on day one. Lead with this in creator acquisition — "get paid reliably" beats "bigger audience" for creator supply in emerging markets.

---

## PART 13 — ADMIN / FOUNDER DASHBOARD EVOLUTION

| Existing founder page | Episio evolution |
|---|---|
| `founder/content.html` | Add Series/Episode management, transcode status queue |
| `founder/analytics_content.html` | Add watch-completion funnel, drop-off heatmap |
| `founder/revenue.html` | Add video delivery cost vs. coin revenue margin tracker (Part 12.2) |
| `founder/elite.html` | Repoint to WiamEpisio Premium |
| `founder/moderation.html` | Extend to video reports + AI moderation queue |
| **New: Video Ops dashboard** | Transcode failures, storage cost trend, CDN bandwidth by region |

---

## PART 14 — API DESIGN

**Principle: additive, not breaking.** `/api/v1` stays alive for any legacy client still in an app store review queue. New episode-first surface area is added as new v1 endpoints (simplest) or a parallel `/api/v2` (cleaner longer-term) — recommend **new v1 endpoints now, v2 namespace at Phase 3** once the shape has stabilized and you're ready to deprecate the equivalent legacy chapter endpoints.

**New endpoints (illustrative set):**
```
GET  /api/v1/series                       (replaces /books for discovery)
GET  /api/v1/series/<id>
GET  /api/v1/series/<id>/episodes
GET  /api/v1/episodes/<id>/stream         (returns signed manifest URL)
POST /api/v1/episodes/<id>/unlock
POST /api/v1/watch/save-progress
GET  /api/v1/watch/continue-watching
POST /api/v1/creator/series               (Studio: create)
POST /api/v1/creator/episodes/upload      (resumable multipart)
GET  /api/v1/creator/episodes/<id>/status (transcode polling)
```

---

## PART 15 — MOBILE & WEB FRONTEND ARCHITECTURE

### 15.1 Player
`react-native-video` (or `expo-av`'s successor) with HLS support, integrated into a `FlashList`-based vertical swipe feed with viewability-triggered autoplay and 1–2 episode look-ahead pre-buffering — this is the single highest-craft component in the whole app and deserves dedicated engineering time, not a bolt-on.

### 15.2 New/redesigned screens (mapped to existing screens per the audit)

| Existing screen | Disposition |
|---|---|
| `HomeScreen`, `GuestHomeScreen` | Redesign: trailer-first, vertical rails |
| `BookDetailScreen` | Redesign → `SeriesDetailScreen` (resolve naming per Part 4.1) |
| `ReaderScreen` | Becomes `PlayerScreen` (net new component); legacy text reader survives as "Text Edition" view |
| `StudioDashboardScreen` / `NewStoryScreen` / `ChapterEditorScreen` | Redesign for episode upload flow |
| `StoryAnalyticsScreen` | Extend with watch funnel |
| `ClassicsScreen`, `OfflineReadingScreen` | Park — deprioritize nav placement, don't delete |

### 15.3 Web parity
Web (174 templates) follows the same disposition table as the audit's §4 — discover/book/reader templates redesign to series/player; auth/payment/legal/founder templates stay or evolve in place.

---

## PART 16 — FOLDER STRUCTURE ADDITIONS

```
webapp/
  services/
    video_service.py         (new)
    transcode_service.py     (new)
    watch_progress.py        (new, mirrors reading_progress patterns)
  routes/
    episode_api.py           (new)
    series_api.py            (new, or extend studio_v2_api.py)

WiamAppMobile/
  src/
    screens/watch/
      PlayerScreen.js
      DiscoverFeedScreen.js
    components/player/
      VerticalVideoPlayer.js
      EpisodeProgressBar.js
      AutoplayController.js
    api/
      episodes.js
      series.js
```

---

## PART 17 — SECURITY *(expanded per Part 6.3)*
- Signed, short-TTL video URLs — never expose raw storage URLs.
- Rate-limit unlock/stream-token endpoints (reuse `rate_guard.py`).
- Video moderation before publish, not just after-the-fact reports (reuse `content_guard.py`, extend with frame/audio sampling).
- Watermarking for premium content (Phase 3).
- Full DRM reserved for Originals/exclusives (Phase 4+) — see Part 6.3 for the cost reasoning.
- **Flag for legal review, not something I can resolve here:** confirm how app-store IAP commission rules apply to video-content coin purchases versus the text-content coin purchases your current IAP compliance was built around — video entertainment apps sometimes fall under different store review categories.

---

## PART 18 — DEVOPS, DEPLOYMENT & SCALING

- Keep existing Render-hosted Flask deploy for API/web; video storage/CDN is a **separate infrastructure concern** (Cloudflare Stream, per Part 6.2) — don't try to serve video through your existing app server.
- Transcode jobs run async via a queue (Celery/RQ or the provider's own transcode pipeline if using Cloudflare Stream/Mux, which handle this for you) — do not block the request/response cycle on transcoding.
- Add a dedicated **Video Ops** monitoring dimension: transcode success rate, average transcode time, storage growth rate, CDN egress cost trend — these are new failure modes your platform has never had to watch for.
- Free-tier CI/CD budget (per your existing QA workflow) should get a video-specific smoke test: upload → transcode → playback round-trip, run nightly, not on every commit (cost control).

---

## PART 19 — ANALYTICS & GROWTH METRICS

**Retire as primary:** total registered users, total chapters published.
**Promote to primary:** Weekly Watching Users, average episodes-completed-per-session, Day-7 watch retention, free-to-unlock conversion rate, creator upload-to-first-view latency.

---

## PART 20 — BRAND STRATEGY

- **Position:** "The home of African vertical drama" — not "an African DramaBox." Lead with originals-in-waiting and the creator-payout track record, not with catalog size you don't have yet.
- **Naming discipline:** every place "Book," "Chapter," "Read" appears in-app copy for drama content gets replaced with "Series," "Episode," "Watch." This is a copy-pass task, not a code task, but it must ship alongside the schema rename in Part 4.1 or the two will visibly disagree with each other in-app.

---

## PART 21 — IMPLEMENTATION ROADMAP

| Phase | Scope | Rough duration |
|---|---|---|
| **0 — Audit** | Done (Step 1) | ✅ |
| **1 — Foundation** | Schema rename (Part 4.1), new Episode/WatchProgress/EpisodeUnlock tables, video vendor contract signed, upload pipeline proof-of-concept | 4–6 weeks |
| **2 — Creator Studio + Player MVP** | Episode upload/transcode flow, basic vertical player, free-first-5 unlock live | 6–8 weeks |
| **3 — Discovery + Monetization** | Rail-engine repoint, coin pricing for video, Series Pass, rule-based recommendations, watermarking | 6 weeks |
| **4 — AI + Hardening + Scale** | AI moderation for video, subtitles/dubbing, session-based recs, Video Ops dashboard, cost-margin tracking live | 8–12 weeks |
| **5 — Originals & Expansion** | Studio-produced Originals, AI production pipeline, multi-country rollout, DRM for exclusives | Ongoing |

---

## PART 22 — GOVERNANCE RULES FOR FUTURE BUILD SESSIONS
*(the "Cursor rules" equivalent — for any agent, human or AI, working on this codebase)*

1. Never delete a model, route, or template without a documented replacement shipped and verified first.
2. Never reuse the word "Series" for anything other than the drama Series entity once Part 4.1 ships — the rename is permanent product law.
3. Every new video-related table must include a `format`/discriminator-compatible design so it can coexist with the novel/audio siblings, not fork the data model.
4. Every unlock/monetization change must be checked against Part 12.2's margin formula before shipping.
5. Free-first-5 is enforced server-side — any PR that only enforces it client-side is rejected.
6. No feature ships that silently breaks the Text Edition path for legacy novel content.

---

## PART 23 — RISKS & MITIGATIONS

| Risk | Mitigation |
|---|---|
| Video bandwidth cost erodes coin-unlock margin | Aggressive bitrate caps, ad-subsidized unlocks, live cost-margin dashboard (Part 12.2, 13) |
| Piracy via screen recording | Watermarking (Phase 3), full DRM for exclusives only (Phase 4+) |
| Naming collision confusion during transition | Immediate schema + copy rename (Part 4.1, 20) |
| Creator supply cold-start (no one has video content yet) | Seed with WiamLabs-commissioned originals + reuse `StoryChallenge`/`MagicBox` incentive mechanics to bootstrap creator uploads |
| Legacy novel users churn during pivot | Text Edition toggle preserves the reading experience under the same account, not a forced migration |
| IAP/app-store compliance gap for video coin purchases | Legal review before Phase 2 launch (Part 17) — not resolved in this document |

---

## APPENDIX — OPEN DECISIONS REQUIRING FOUNDER SIGN-OFF

1. Confirm Part 4.1's schema rename approach (Option C) before any Phase 1 code is written.
2. Confirm Cloudflare Stream as MVP video vendor (Part 6.2), or provide budget constraints if a different provider is preferred.
3. Confirm free-first-5 as immutable product law (Part 5.1) — flag now if this needs to vary by content tier.
4. Confirm creator revenue share bands (Part 10) — 55–70% is a starting recommendation, not a locked number.
5. Legal review of IAP compliance for video content (Part 17) before Phase 2 launch.

---

*This document is the foundation layer. Each Part above can be expanded into its own deep-dive spec (full ER diagrams, full API contracts, full Figma-ready UX flows, full cost models) on request — tell me which Part to go deeper on next.*
