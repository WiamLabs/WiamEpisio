# Agent working memory

Living journal the AI agent reads at the start of every session and updates as work progresses. Mutable — overwrite freely. Durable project facts live in `.cursor/rules/project-context.mdc` instead.

**Last updated:** 2026-07-20 — **Episio Founder Web Control Panel shipped.** Session HTML under `/founder/`: Episio nav (Watchers/Creators/Catalog/Money/Ops) + Legacy novel tools collapsed. New: `/founder/episio` hub, `/episio/series` (+ detail whole-unit publish, VIP/Origin), `/episio/invites`, `/episio/applications`, `/episio/featured`, `/episio/coin-bands`, `/episio/flags`, `/founder/users/<id>` (coins adjust, VIP grant/revoke, Studio unlock, unlocks/purchases). Helpers: `webapp/services/episio_founder.py`. Overview = Episio KPIs. Novel routes kept, off primary nav.

**Previous — HTML Fidelity Build Waves 1–4 DONE.** Expo: **103** Episio screens, **0** thin shells (&lt;60 lines), all `node --check` OK. Shared UI: `EpisioGoldButton`, `EpisioCenterState`, `EpisioScreenShell`. Navigator includes `VipCheckout`, `SearchNoResults`, `StudioRevisionRequest`. Product host episio.wiamlabs.com; support@wiamapp.com. Remaining polish is continuous QA vs HTML — not a blocker to ship Expo builds.

**Previous — Wave 4 HTML fidelity (Studio pipeline):** Deepened Completeness / Episode Upload·List·Detail / Cover·Banner·Trailer / SubmitForLive·Pending·LiveSuccess / NeedsChanges / SeasonLock / RevisionRequest / Earnings·Analytics·Settings / Home·Dashboard·SeriesCreate / SoftInterest·Teaser·HelpQuality / PayoutKyc Step 2 bank+MoMo / CreatorApply step track → Accepted. Shared: EpisioScreenShell + EpisioGoldButton. Removed Dashboard DEMO_BARS. Real API only; upload uses existing completeUpload/uploadTrailer + ImagePicker probe. StudioRevisionRequest already registered.

**Previous — Wave 3 HTML fidelity (auth + onboarding):** Login, AuthRegister (phone-first → OTP → details; email kept for API), Splash, SplashReturning, Onboarding Welcome/Genres/Done, WelcomeBonus, AgeGate, OtpVerify (flow=register|forgot), ForgotPassword (Email/Phone toggle), ResetPassword (eye toggles + strength). Shared EpisioGoldButton / LogoBadge. Support copy unchanged (support@wiamapp.com); product domain episio.wiamlabs.com.

**Previous — Wave 2 HTML fidelity (money/watch):** CheckoutWeb (Paystack chrome, order card, episio.wiamlabs.com — never wiamapp.com product domain), DailyRewards (streak grid + claim API), MembershipOfferModal (coupon sheet + perks), **new** VipCheckout + SearchNoResults (registered in EpisioNavigator). Deepened BuyCoins→CheckoutWeb, TransactionHistory day buckets/icons, UnlockTakeover VIP hints. Polish: Membership/Player/Home/SeriesDetail/Search (share URL → episio.wiamlabs.com, free-ep note, tips, Daily Rewards / VIP chips). Support copy: support@wiamapp.com.

**Previous — Wave 1 HTML fidelity (10 screens):** HelpCenter, LanguagePicker (`@episio_lang`), SubtitleSettings (`@episio_subtitles`), DownloadsManager (params-only, no fake series / no downloads API), FollowSuccess toast, BlockCreator sheet (block API pending), WiamOriginIntro 2.5s splash, CreatorViewerSwitch 1.5s → StudioHome, StudioSpecs + `mediaSpecs()`, StudioPayoutKyc Step 1 (ImagePicker; KYC API pending). Shared: EpisioScreenShell / EpisioCenterState / EpisioGoldButton.

**Previous — GitHub repo renamed to `WiamLabs/WiamEpisio`** (was `WiamLabs/WiamApp`). Local `origin` retargeted; `old-wiamapp` remote removed. `WiamLabs/Old-WiamApp` archived — do not push there. **Render:** confirm the web service Git connection points at `WiamLabs/WiamEpisio` (GitHub redirects usually work, but Manual Deploy once after rename is safest). Live version stamp: `/health/version`.

**Previous — Founder 500 deploy:** Fix on `5621ce6` (safe_url_for, slim unlocks `/`, overview safe mode, `/health/version`). Founder lock off under EPISIO_SLIM.

**Previous — Mass HTML→screen build:** ~122 Episio screens; **97 Stack routes** in `EpisioNavigator` (no dups). Studio: Episode Detail/Cover/Banner/Settings/Dashboard + Apply Accepted/Rejected. Auth: Onboarding Welcome/Genres/Done, WelcomeBonus, AgeGate, OTP, ResetPassword, SplashReturning. Viewer/system: CreatorPublicProfile, Share/Rate, Unlock/Coins success, Checkout, Downloads, Watch History, Reminders, Invite, Gift, Player Error/Fullscreen, About, Legal, AccountDelete, Offline/Maintenance/ForceUpdate, etc. Profile + Settings wired to new entry points. Backend `PATCH /creator/studio/episodes/:id` added. Deploy Render for columns/routes; run Expo to QA flows.

**Previous — Team talk + Series/Season + Wave 2 Revision + whole-unit reject:** Creator copy uses “WiamEpisio team” (not cold platform). Create chooses **Series (no seasons)** vs **Season (submit season-by-season)** with explanations. Needs Changes / reject **unpublishes entire unit** (never EP1 live + EP2 dead). Wave 2: `StudioRevisionRequest` + `POST …/revision-requests` (live only · legal/rights/factual · scoped). Also built: Analytics, Earnings, Teaser preview, Help-Quality, Payout-KYC. Deploy for `structure_mode` / revision table.

**Previous — Needs Changes tracks exact assets:** SLA/founder reject builds per-asset fix cards (EP N / Trailer / Cover) with reasons + Fix→ deep links; auto-publish tells creators WiamEpisio published after Good/Excellent. Phone-friendlier shake/blur/exposure bands (score output, not cinema cams).

**Previous — SLA auto-decide + duration law:** After tier window (72/48/24/12h) with no founder action → Good/Excellent **auto-publish**, else **Needs Changes**. Flag `ff_season_qc_sla_auto_decide`. Episode length enforced **4–5 min only**; trailer **15–60s** (not 1–2 min). Planned episodes **min 20, max 200** (longer seasons OK). Service: `season_sla_auto.py`. Runs on founder “Run queue” + review-status poll.

**Previous — Full review toolkit completed (Netflix VMAF + all plan layers):** `season_quality_pipeline.py` now runs FFprobe, watermark corners, PySceneDetect sampling, OpenCV sharpness/exposure/shake, FFmpeg blackdetect/freezedetect, **VMAF (Netflix)** source-vs-delivery proxy, SSIM, EBU R128, WebRTC VAD dialogue/silence, pHash catalog duplicates (`w_content_fingerprints`). Founder `/founder/episio-quality` shows tool install status + per-layer ON/OFF + timing. Docs: `docs/WIAMEPISIO_REVIEW_TOOLS.md` (what/how/SLA). Timing truth: machine QC minutes–few hours for a season; creator promise up to **24h** (tier 72/48/24/12). Install opencv/scenedetect/webrtcvad/ImageHash + ffmpeg libvmaf on worker. Creator Studio pipeline still closed pre–Wave 2 Revision-Request.

**Previous wire pass:** Transaction History filters, Search popular, SeriesDetail Rate/Favorite/My List, Trailer Follow `creator_id`, BuyCoins/Membership Paystack verify-on-focus.

**Previous (2026-05-06):** **Critical Cursor plans snapshotted in git:** `docs/plans/critical/` now holds copies of `enterprise_monetization_e2e`, `reader-first_growth_master`, `social_identity_community`, and `wiamvox_roadmap_+_launch_docs` (planning only; no build work started). See `docs/PLANS_INDEX.md`.

**Previous (2026-05-06):** **QA bot `creator_follow` probe fixed** (`scripts/qa/comprehensive_bot.py`): hard-coded `creators/1/follow` caused 400 when QA user was `id=1` (self-follow) or when `users.id=1` was not a creator. Added `resolve_canary_creator_id()`: reads `GET /auth/me`, skips self, optionally uses env **`QA_CREATOR_CANARY_ID`**, else scans ids 1–30 with `GET /creators/:id` until a valid creator profile exists. Skip-pass if no creator found; fail if auth/me fails.

**Previous (2026-05-03):** **Continue reading ("pick up where you left off") fixed** — `ReadingProgress.user_id` is written as `wiam_id or user.id` (`POST /reader/save-position`), but home feed `prog_map`, `_fetch_continue_reading`, `/library` progress map, book-detail progress, `read_chapter` progress update, `_fetch_because_you_read`, and reader badge stats used **`user.id` only** → readers with a `wiam_id` had no visible progress on home/Profile. Unified lookups/writes to **`user.wiam_id or user.id`** in `api_v1.py` + `home_sections_v2.py`. **Mobile `HomeScreen`:** cache key was `home_screen_v3` for all users — stale/wrong home; now `home_screen_v3:u{id}` / guest. Deploy backend. **Eligibility:** backend only surfaces in-progress books that are **in My Library** (`UserLibrary`) and have chapter progress > 0 — reading alone without "Add to library" will not appear in that rail.

**Previous (2026-05-03):** **Expo Google sign-in iOS crash when env incomplete**

**Also (2026-05-03):** **Mobile creator cover upload 500 fixed** (`webapp/routes/api_v1.py` `studio_upload_cover_api`): was calling `validate_cover(cover_bytes, ct)` and unpacking `(ok, err)`, but `validate_cover` expects a seekable file-like object and returns a **dict**. Fixed with `BytesIO(cover_bytes)`, duplicate hash + strike parity with web Studio. Deploy Render for production.

## Studio publish — "live chapter shows draft" fixed
- Root cause: `studio_get_chapter_api` (`webapp/routes/api_v1.py`) returned `getattr(ch, 'is_published', True)` but `WebBookContent` has no `is_published` attribute, so it was always `True`; mobile `ChapterEditorScreen` reads `ch.status` which was missing from the JSON, so it fell back to `'draft'` for live chapters.
- `studio_get_chapter_api`: now returns explicit `status`, derived `is_published` (`status == 'published'`), `is_scheduled`, `scheduled_publish_at`, `published_at`.
- `studio_get_story_api`: chapter list now includes `is_scheduled` + `scheduled_publish_at` + `published_at` (Schedule tab can now populate from API).
- `ChapterEditorScreen.js`: tri-state publish badge — Live (green eye), Scheduled (gold clock), Draft (muted eye-off). Uses `status` then falls back to `is_published` for older API builds.
- `StoryManagerScreen.js`: chapter list shows the same tri-state badge.

## Book cover — replaced cropper with size guidance + server-side normalization
- `NewStoryScreen.pickCover` and `StoryManagerScreen.handleUploadCover`: removed `allowsEditing: true, aspect: [2,3]`. The OS crop UI was the source of the "tiny crop box" complaint. Users now pick the original file; server normalizes.
- `NewStoryScreen.js` cover tips card rewritten with explicit guidance: 600×900 (2:3), min 400×600, max 5 MB, JPG/PNG/WebP, will be center-cropped to 2:3, suggested tools (Canva, Photoshop, BookBrush).
- Backend `studio_upload_cover_api` (`api_v1.py`): intended to mirror web Studio (`validate_cover` then `normalize_cover`). **Regression (fixed 2026-05-03):** wrong `validate_cover` call triggered 500 on mobile until `BytesIO`-wrapped bytes + dict handling shipped.

## Notification system — targeted hot fixes
- Settings API (`/api/v1/settings` GET/PATCH): was reading/writing non-existent `push_enabled`/`email_notifications` columns on `User`. Fixed to use the real `notif_*` columns. Now exposes the full granular set (push, email, new_chapter, new_follower, comments, likes, mentions, announcements, coins, elite, sound) and accepts both new keys and legacy aliases.
- Push token registration: was keyed only on `user.wiam_id`, but notifications resolve recipients via `wiam_id or user.id`. Now uses `wiam_id or id` so legacy users without a `wiam_id` actually receive push.
- Mobile inbox: new `POST /notifications/mark-all-read`, `DELETE /notifications/<id>`, `DELETE /notifications/clear` endpoints. `GET /notifications` now also returns `unread_count`.
- Paragraph comments (`POST /api/v1/reader/comment`): now fires `notify_comment` to the creator on top-level comments and `notify_comment_reply` to the parent author on replies (skips self-pings, runs after commit so notification failures don't roll back the comment).
- Sticker gifts: `notify_gift_received` now stores `type='gift'` (was misusing `'coins'`), so the sticker activity icon and filters can distinguish gifts from coin/tip events.
- Mobile `NotificationsScreen`: rewritten — header actions for "mark all read" and "clear all"; long-press to delete one; deep-link parser correctly handles `/book/<id>/read?ch=<n>` (was broken: `link.split('/').pop()` returned `'read?ch=5'`); supports new `gift` and `scheduled_publish` types.

## SEO — accurate crawl signals + brand entity reinforcement
- `webapp/routes/seo.py` `robots.txt`: replaced no-op `Disallow: /auth/` with real auth paths (`/login`, `/register`, …); scoped `/team/` block to `/team/admin/` so `/team/careers` (public hiring) can be indexed; explicitly disallowed `/api/`, `/internal/`, `/settings`, `/wallet`.
- Sitemap: dropped phantom URLs (`/auth/login`, `/auth/register`, `/careers`, `/elite`, `/become-creator` — wrong paths or login-walled). Added real public hubs (`/programs/`, `/programs/rising`, `/programs/challenges`, `/premium/`, `/premium/apex`, `/team/careers`).
- `base.html`: added `meta name="robots"`, `og:locale`, `og:image:alt`, `twitter:site`, `twitter:image`, optional `google-site-verification` (env-gated). Twitter blocks now default to OG values via `self.og_*()` so per-page overrides don't have to set everything twice. New `og_type`, `og_url`, `og_image_width/height/alt`, `canonical_url`, `jsonld_extra` blocks for child templates.
- `Organization` JSON-LD: added `alternateName` (`Wiam App`, `WiamLabs`, `Wiam`), `legalName`, structured `logo` ImageObject, `foundingDate`, populated `sameAs` (Play Store, social profiles), `contactPoint` for support email.
- `WebSite` JSON-LD: added `alternateName` and `publisher`.
- `book_detail.html`: emits `Book` JSON-LD (title, image, description, genre, author Person link, publisher, ebook format, isAccessibleForFree, datePublished) + `BreadcrumbList`. OG tags moved into `og_*` blocks (no more duplicate `<meta property="og:title">` from `extra_head`). Cover image becomes the OG image at 600×900.
- `creator_profile.html`: emits `Person` JSON-LD with creator name, url, avatar, bio, `worksFor` WiamApp; OG tags use proper blocks.
- `landing.html`: H1 now leads with `WiamApp` so branded queries can latch on (was just `"Discover Stories That Move Your Soul"`). Hero badge also gets the brand name.
- `about.html`: title strengthened to `About WiamApp — Africa's home for free stories`.

## Action items before flipping live
- Push to GitHub master → Render auto-deploys backend.
- `cd WiamAppMobile && npm install && npm run start:offline` for local QA, then `eas build --profile production --platform android` for the next bundle.
- (Optional) set `GOOGLE_SITE_VERIFICATION` env on Render to surface the meta tag for Search Console.

---

**Previous (2026-05-02):** Brand visual overhaul: Landing, Onboarding, Post-Onboarding, Studio V2 (local, ready to deploy):

1. **New / rebuilt screens (mobile, all branded wine + gold + Playfair):**
   - `screens/auth/LandingScreen.js` — full rebuild: brand wordmark, marquee of latest covers, Continue Card with Email + Google live, Facebook + Discord disabled with "Soon" pill, feature pills, full footer with About/Careers/Privacy/Terms/Help and copyright.
   - `screens/auth/LoginScreen.js` — Google sign-in button + divider added; uses `BrandToast` instead of `Alert`.
   - `screens/auth/OnboardingFlowScreen.js` — fully redesigned 4-step flow (welcome → reading style → genres ≥3 → done) with gold dots, brand glow, sentence-case copy, and `BrandToast` errors.
   - `screens/auth/RegistrationFinishScreen.js` — redesigned avatar + bio/pronouns flow with brand glow + `BrandToast`.
   - `screens/auth/WelcomeBonusScreen.js`, `PostOnboardingPremiumScreen.js`, `PostOnboardingCreatorScreen.js`, `PostOnboardingMissionScreen.js` — 4 full-screen branded post-onboarding pages, each with skip + continue, replacing the old `Alert.alert` chain in `HomeScreen`.
   - `components/auth/PostOnboardingShell.js` — shared shell (brand glow, step dots, gold CTA, skip).
   - `components/common/BrandToast.js` — replaces system Alerts in new flows.
   - `navigation/PostOnboardingNavigator.js` — sequenced stack: WelcomeBonus → Premium → Creator → Mission → `clearPostOnboarding()`.
   - `navigation/AppNavigator.js` — new `phase_post_onboarding` between Onboarding and Main; remounts when `postOnboardingPending` flips. Old `Alert.alert` block in `HomeScreen.js` removed.

2. **Google Sign-In (mobile + backend):**
   - `services/googleAuth.js` (new): `useGoogleSignIn` hook over `expo-auth-session/providers/google`, exchanges Google `id_token` for WiamApp JWT via `POST /api/v1/auth/google`. Returns `ready=false` and surfaces "Coming soon" toast when client IDs unset.
   - `api/auth.js`: added `googleLogin()` helper (sends `id_token` + device fingerprint + platform).
   - `app.config.js` + `.env.example`: `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (web), `_IOS`, `_ANDROID` (optional). When unset, the buttons show as "Coming soon" gracefully.
   - `package.json`: added `expo-auth-session ~7.0.8` and `expo-crypto ~15.0.7` (run `npm install` in `WiamAppMobile/` before next EAS build).
   - **Backend (`webapp/routes/api_v1.py`):** new `POST /auth/google` — verifies `id_token` against allowed audiences (`GOOGLE_CLIENT_ID`/`_IOS`/`_ANDROID` env, comma-separated supported), finds-or-creates user (links by `google_id` or email), respects `PlatformConfig.is_login_blocked`, returns same `{token,user}` shape as `/auth/login`. New mobile-source signups land with `registration_completed=False` so they go through `RegistrationFinishScreen` like email signups. **Action item before flipping live:** set `GOOGLE_CLIENT_ID` (web client id) on Render and the matching `EXPO_PUBLIC_GOOGLE_CLIENT_ID*` envs in `eas.json`/EAS dashboard.

3. **Studio V2 brand realignment** (`constants/studioTheme.js`): replaced violet `#a855f7` accent + light-violet text with WiamApp wine `#722f37` accent and gold `#d4a843` Pro tint. All Studio V2 screens (`StudioLibraryScreen`, `StudioMoneyScreen`, `StudioScheduleScreen`, `StudioSettingsScreen`, `StudioProPaywallScreen`, `UniverseEditorScreen`, `SeriesEditorScreen`, `StudioTourModal`, `AIComingSoonScreen`) re-skin automatically via `STUDIO_COLORS`.

4. **Bug fixes (still in place from previous session):** `RegisterScreen` autofill yellow + reliable password eye + green/red username status + suggestions; `CircularCropModal` slider with `PanResponder` + 44px hit area; `BrandHeader` for Login/Register/Forgot/Reset; `useAuthStore.checkAuth` re-fetches `me()` if cached user is missing `registration_completed`/`onboarding_completed`.

5. **Out of scope for this session (planned):** book cover crop UX (likely move to "submit URL/file with size guidance"), creator publish errors + lingering `draft` UI on live chapters, full notification system rebuild, Google SEO push.

---

**Previous (2026-05-01):** Registration tail + onboarding split:

1. **Backend**
   - `users.registration_completed` (model + idempotent migration default `TRUE`). New mobile API signups (`platform` `ios`/`android`) get `FALSE` until `POST /auth/complete-registration` after `avatar_url` is set.
   - `auth_register`: password min **8**; mobile requires **username** + **date_of_birth** (13+); optional **phone**; `registration_completed` gated by mobile vs web; web keeps generated username when omitted.
   - `PUT /auth/profile`: **pronouns**, **show_pronouns**, **dob_visible**, **phone**, **date_of_birth** (+ existing fields). Shared `_parse_date_of_birth` helper.
   - `POST /auth/complete-registration` (JWT): sets `registration_completed` when avatar present.
   - `_user_json` includes **`registration_completed`** for mobile gating.
2. **Mobile**
   - `RegisterScreen`: 4-step wizard (credentials → name → username check → DOB/phone) then `setAuth`.
   - `RegistrationFinishScreen`: circular crop → upload → optional bio/pronouns → `complete-registration`.
   - `AppNavigator`: **Auth → (registration_completed false) RegistrationFinish → (onboarding) Onboarding → Main**.
   - `OnboardingFlowScreen`: **4 steps**, **no** display name/username; welcome → taste → genres (min 3) → finish + welcome reward.
   - `auth.js`: object-shaped `register`, `completeRegistration`, extended `updateProfile`.

**Previous (2026-05-01):** Onboarding gate wired to registration + first-mission rewards (see below).

**Previous update:** 2026-05-01 — **Onboarding gate wired to registration (in progress, local):**

1. Backend (`webapp/routes/api_v1.py`):
   - `_user_json` now includes `onboarding_completed` so mobile can reliably gate entry.
   - `/auth/register` now forces `onboarding_completed=False` for brand-new email signups (instead of inheriting model default `True`).
2. Rewards/coins updated to match approved onboarding growth flow:
   - `webapp/services/ledger.py`: `WELCOME_BONUS_COINS` changed from 50 -> 10.
   - Added first mission reward support in ledger: `FIRST_MISSION_COINS=10`, `has_claimed_first_mission_bonus()`, `claim_first_mission_bonus()`.
   - `webapp/routes/api_v1.py` now exposes:
     - `GET /api/v1/rewards/first-mission/status`
     - `POST /api/v1/rewards/first-mission/claim`
   - Mission completion rule: user must have at least one `book_view` analytics event and at least one creator follow.
3. Mobile (`WiamAppMobile/`):
   - Added `src/screens/auth/OnboardingFlowScreen.js` (5-step flow) to capture identity + genre picks, persist profile + `/genres/preferences`, and finish with reward claim (`/rewards/welcome`).
   - `AppNavigator` now blocks authenticated users with `onboarding_completed=false` from entering Home and routes them to `Onboarding` first.
   - `useAuthStore` extended with `postOnboardingPending` + `onboardingWelcomeCoins` flags to trigger post-onboarding sequence once.
   - `HomeScreen` now runs the approved post-onboarding sequence: show coin gift confirmation, then prompt Premium (`PremiumScreen`), then invite non-creators to apply (`Apply`), then mission prompt/auto-claim for first mission.
   - API clients updated: `auth.updateProfile` now supports `username`; `walletApi` exposes welcome + first mission reward endpoints.

**Previous update:** 2026-05-01 — **Daily Rotating Home V2 shipped (3 pushes, all deployed):**

1. `10d83a5` — Backend: new `webapp/services/home_sections_v2.py` with 22-section `SECTION_REGISTRY`, daily rotation seeded by `f"{user.id}:{date.today()}"`, cross-section dedup; wired `UserGenrePreference` (onboarding genres) into `recommendation_service._build_user_profile()` at weight=2 so brand-new users finally get personalized recs from day 1; `api_v1.home_feed` rebuilt around `build_home()` returning both new `sections[]` array and legacy keys (backwards-compat for older app installs).
2. `8a98149` — Mobile: `WiamAppMobile/src/screens/main/HomeScreen.js` rewritten as a `sections[]` iterator with layout dispatch (`continue|spotlight|pulse|mosaic|stream`), Lucide icon name → component map, fallback `sectionsFromLegacy()` if backend response lacks `sections[]`. New components: `MosaicRail.js` (generic mosaic, 1 BIG + 2 small stacked) and `ContinueRail.js` (extracted continue-reading rail with progress bar).
3. `24253c0` — Empirical fix after deploy: with thin staging data (~15 scored books) only 2 sections were surviving rotation because `latest` (24 books by `published_at`) was draining the pool before `pulse`/`stream`. Added `ASSEMBLY_PRIORITY` constant — engagement-first dedup order (continue_reading → for_you → spotlight → pulse → stream → top_rated → ... → recently_updated → latest). Render order remains pinned (`PINNED_ORDER`) + daily-shuffled rotating; only the dedup pass uses priority order under the hood. Lowered `min_books` from 4-6 to 3-4 across rotating sections so home survives small catalogues without compromising prod.

**Pinned (always show when eligible):** continue_reading, for_you, spotlight, top_rated, from_creators_you_follow.
**Rotating pool (4-6 picked daily from 17):** pulse, stream, latest, premium_picks, hidden_gems, quick_reads, long_reads, completed_stories, most_favorited_week, recently_updated, wiam_originals, editor_pick, because_you_read, popular_in_genre_1/2/3.

**QA probes (`scripts/qa/comprehensive_bot.py` `run_home_v2_invariants`):** (a) `sections[]` non-empty, (b) cross-section dedup invariant (no book in two rails except continue_reading), (c) personalized rail (`for_you`/`because_you_read`/`popular_in_genre_*`/`from_creators_you_follow`) survives for authenticated bot. No new GitHub Actions minutes — added inside the existing `bot-comprehensive` run.

**Live verification (anonymous):** `https://wiamapp.com/api/v1/home` returns 3 sections (spotlight/stream/pulse), 0 duplicates across rails. Production-scale data will fill more rails automatically.

**Plans:** Home V2 plan at `c:\Users\DELL\.cursor\plans\daily_rotating_home_v2_11cf907d.plan.md`. Original deep tracking plan at `c:\Users\DELL\.cursor\plans\deep_tracking_and_home_fix_e21a8a4d.plan.md`.

**Prior update (2026-05-01):** Home-feed mixing fix (`976bf50`, deployed) — `premium_picks` was `stream_json[:6]` so Stream/Premium rails showed same books. Added `premium_books()` to `popularity.py` joining on `WebBookContent.is_locked` / `is_premium_locked`. **Testing path: Expo Go via `npx expo start`** — no EAS build needed since `AdBanner` is guarded for missing AdMob native module.

**Prior update (2026-04-30):** Workstream U (six safety items): `docs/STUDIO_V2_QA.md` §0 documents manual Supabase backup before migrations; plan `deep_tracking_and_home_fix` updated with **Workstream U** + frontmatter todo. **Creator scheduled-publish push:** `notify_creator_scheduled_chapter_live` in `webapp/services/notifications.py` (respects `CreatorSettings.notif_scheduled_publish`), called from `publish_due_now` in `webapp/routes/studio_v2_api.py` — followers already received `notify_new_chapter`. Wire-audit baseline unchanged (349 interactive mobile components, 0 unwired).

## Current plan progress

Plan: `c:\Users\DELL\.cursor\plans\deep_tracking_and_home_fix_e21a8a4d.plan.md`

| Push | Status | Workstreams | Summary |
| --- | --- | --- | --- |
| 1 — Foundation | **DONE (deployed `9d5e918`)** | A + K docs | `AnalyticsEvent` model + `track()` helper + `_canonical_user_id` + Cloudinary `delete_*` helpers wired into account-delete and book hard-delete + `CLOUDINARY_*` documented in `.env.example` + startup status log |
| 2 — Tiny creator gate + activation | **DONE (deployed `431e81a`)** | H + J | One-tap pen-name + terms; backfill all pending; WelcomeCreatorScreen; push deep link |
| 3 — Engagement instrumentation | **DONE (deployed)** | B + D | Mobile JWT `/record-view`, all `track()` calls, mobile publish parity, fix `publish_all_chapters` |
| 4 — Home data layer | **DONE (deployed)** | C + E | New `home_feed` shape, dedupe, per-user shuffle, `book_popularity_score`, lazy recompute |
| 5 — Home redesign UI + creator analytics | **DONE (deployed)** | I + F | `BookTile` + `SpotlightRail` + `PulseRail` + `StreamRail`, refresh control, `/creator/stories/<id>/analytics`, `StoryAnalyticsScreen` |
| 6 — Cloudinary hardening + QA | **DONE (deployed)** | K rest + G | NSFW scan on mobile cover, voice cover stable IDs, chapter inline image sanitizer (`bleach`), QA bot probes |
| 7 — Studio V2 schema | **DONE (deployed)** | L + DB snapshot | Universe / Series / Arc / StudioProSubscription / CreatorSettings / AISuggestion + Content + WebBookContent extensions |
| 8 — Studio V2 backend | **DONE (deployed)** | M + Q server + search V2 | Full CRUD, `_studio_pro_required`, scheduled-publish job WITH notifications, IAP receipts, search V2, founder Pro seed, before_request scheduler tick |
| 9 — Studio V2 mobile rebuild | **DONE (deployed)** | N + P + R + tour + beta | 5-tab StudioNavigator, Library/Editor/Schedule/Money/Settings, visual identity (indigo/violet/gold), beta gate, first-time tour, Universe/Series editors, paywall |
| 10 — Reader V2 + Pro paywall | **DONE (deployed)** | O + Q client | Public Universe & Series pages, series-context banner on BookDetail, next-in-series CTA on Reader's last chapter, chapter access state endpoint, deep links for `/universe/:id` and `/series/:id` |
| 11 — AI stub + wire-audit + final QA | **DONE (local, awaiting push)** | S + T | `AIComingSoonScreen` w/ waitlist, `ai_waitlist` column on `CreatorSettings`, `scripts/qa/wire_audit.py` (349 components, 0 issues), `docs/STUDIO_V2_QA.md` (17-section manual checklist), wired 4 unwired stat-cards/profile-row to `<View>` |

### Push 1 details (just shipped locally)

Files touched:

- `webapp/models.py` — appended `AnalyticsEvent` model (`w_analytics_events` table) with three indexes (event_type+created_at, content_id+created_at, user_id+created_at). user_id is canonical `User.id` (PK), never `wiam_id` — kills the legacy split.
- `webapp/__init__.py` — added the `CREATE TABLE IF NOT EXISTS w_analytics_events` + 3 `CREATE INDEX IF NOT EXISTS` statements to `_run_safe_migrations`. Added a Cloudinary status log in `create_app` that prints `Cloudinary configured` or `Cloudinary NOT configured — image uploads will fail` listing missing env vars.
- `webapp/services/analytics.py` — **new file**, single source of truth for `track(event_type, user, ...)` + `_canonical_user_id(user)` + `track_batch(events)` + `_detect_client()`. Best-effort, never raises, no commit (rides parent transaction).
- `webapp/services/image_service.py` — replaced stale "Falls back to PostgreSQL ImageStore" docstring; `delete_image()` now treats Cloudinary `not_found` as success (idempotent); added `extract_public_id_from_url(url)`, `delete_image_url(url)`, `delete_avatar(user_id)`, `delete_cover(book_id)`, `delete_voice_cover(story_id_or_url)` named helpers.
- `webapp/routes/api_v1.py` `delete_account` — soft-delete now also destroys the user's avatar + every owned book cover + every owned voice cover from Cloudinary. Wrapped in try/except so cleanup failure never blocks the soft-delete.
- `webapp/routes/studio.py` `_hard_delete_book` — now calls `delete_cover(book_id)` AND `delete_image_url()` for any legacy `ext_<url>` cover_file_id. Best-effort, won't block the hard delete.
- `.env.example` — added `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` block with sign-up link and clear consequence note.

Syntax-checked all six files via `python -m py_compile`. No new lints.

Commit message ready: `feat(push-1): analytics events foundation + cloudinary delete-on-replace`.

### Push 2 details (just shipped locally)

Files touched:

- `webapp/routes/api_v1.py` `apply_creator` — replaced the rubric-based mobile endpoint with the tiny one-tap gate (pen_name + accepted_terms). On success calls `finalize_creator_upgrade`, fires `track('creator_upgrade')`, then `notify_creator_welcome`. Returns `status='approved'` immediately. Added `creator_pen_name` to `_me_json` so the mobile welcome screen has a stable fallback.
- `webapp/routes/profile.py` `become_creator` — same tiny shape on the web. Pen name + terms checkbox -> instant promote.
- `webapp/templates/become_creator_form.html` — replaced multi-field rubric form with pen_name + terms checkbox.
- `webapp/templates/become_creator.html` — dropped the pending/rejected branching (no longer reachable in tiny-gate model).
- `webapp/services/creator_approval.py` — module docstring marked DEPRECATED; `_has_spam` retained as the single live function used by both gates.
- `webapp/services/notifications.py` — added `notify_creator_welcome(user)` writing a `type='creator_welcome'` Notification + email + Expo/Web push deep-linked to `/creator/welcome`.
- `webapp/__init__.py` — added `_backfill_pending_creators()` boot helper (idempotent) called after `_cleanup_soft_deleted_books()`. Promotes every `creator_application_status='pending'` user under the new model and fires their welcome push. Re-runs are no-ops because no pendings exist after the first pass.
- `WiamAppMobile/src/screens/creator/ApplyScreen.js` — full rewrite to the tiny gate UI: hero ("One tap. Then you write."), 4 perk rows, single pen-name input, terms checkbox row, single CTA. Deep-links to Linking opens `https://wiamapp.com/terms`. On success `navigation.replace('WelcomeCreator', { penName })`.
- `WiamAppMobile/src/screens/creator/WelcomeCreatorScreen.js` — **new file**. Full-screen welcome: animated sparkle field (18 hand-rolled Reanimated stars, no extra deps), Playfair-display heading "Welcome, <pen_name>", 3 staggered FadeInDown feature cards (Studio / Followers / Earnings), primary CTA "Open WiamStudio" + secondary "See my creator profile". Success haptic on mount.
- `WiamAppMobile/src/navigation/AppNavigator.js` — registered `WelcomeCreator` Stack.Screen with `slide_from_bottom` animation and gestures disabled.
- `WiamAppMobile/src/services/pushNotifications.js` — `_handleNotificationNavigation` now routes `type='creator_welcome'` -> `WelcomeCreator` and `type='scheduled_publish'` -> `BookDetail` (Push 8 will start using this second branch).

Backend syntax-checked via `python -m py_compile`. Mobile + templates passed lints. No new dependencies added (Reanimated 4.1.1 + expo-haptics 15.0.8 already in `package.json`).

Commit message ready: `feat(push-2): tiny creator gate + activation tour + backfill pending`.

### Push 3 details (just shipped locally)

Backend
- `webapp/routes/api_v1.py` — added 4 new endpoints at the end of the file:
  - `POST /books/<id>/record-view` (JWT) — mobile reader pings here after 30s; server dedupes per user/book/day via `AnalyticsEvent` index. Bumps `Content.views` and writes `book_view` row.
  - `POST /track/home-impression` (jwt_optional) — batch (≤60 events) of `home_impression` rows with `section_key` + `position`.
  - `POST /track/home-click` (jwt_optional) — single tap.
  - `POST /track/push-open` (JWT) — push CTR.
- `webapp/routes/api_v1.py` instrumented:
  - `toggle_favorite` -> `track('favorite' / 'unfavorite')`
  - `rate_book` -> `track('rating' / 'rating_update')`
  - `toggle_follow` -> `track('follow' / 'unfollow')`
  - `search` -> `track('search')`
  - `add_comment_api` -> `track('comment')`
  - `like_comment_api` -> `track('comment_like' / 'comment_unlike')`
- `webapp/routes/api_v1.py` mobile publish parity:
  - `studio_publish_chapter_api` — runs `scan_chapter_on_publish`, blocks rejected, stamps `published_at`, fires `notify_new_chapter` (only on first publish), tracks event.
  - `studio_publish_story_api` — stamps `Content.published_at` on first transition out of draft, fires `notify_new_book_published`, tracks event.
  - `studio_publish_all_chapters_api` — same parity in bulk; returns rejected list to the mobile UI.
- `webapp/routes/book.py` `record_view` and `track_share` — added `track()` calls.
- `webapp/routes/studio.py`:
  - `publish_chapter` — added `published_at` stamp + `track('publish_chapter')` event.
  - `publish_all_chapters` — full parity rewrite: scans every chapter, skips rejected, stamps `published_at`, fires `notify_new_chapter` per published chapter, tracks events. Web no longer bypasses moderation.
- `webapp/models.py` `WebBookContent` — added `published_at = db.Column(db.DateTime, nullable=True)` (Push 3).
- `webapp/__init__.py` — added `ALTER TABLE w_book_content ADD COLUMN IF NOT EXISTS published_at TIMESTAMP` to the safe-migrations list.

Mobile
- `WiamAppMobile/src/api/books.js` — added `recordView(bookId)` helper (returns `{counted, views}`).
- `WiamAppMobile/src/api/tracking.js` — **new file**. Exposes `queueImpression`, `flushImpressions`, `homeClick`, `pushOpen`. Buffers up to 20 impressions and flushes every 8s or when buffer fills (Push 5 will use this from `BookTile`/`SpotlightRail`/etc.).
- `WiamAppMobile/src/screens/content/ReaderScreen.js` — added a 30-second `setTimeout` per chapter that calls `booksApi.recordView(bookId)`. Cleared on chapter change so a reader who flips chapters fast doesn't double-count.
- `WiamAppMobile/src/services/pushNotifications.js` — `responseListener` now also fires `trackingApi.pushOpen(type, url)` before navigating, so we get accurate CTR per push type.

Backend syntax-checked + linted. No new mobile dependencies. The new tracking endpoints are exercise-safe: every `track()` call is wrapped in try/except so a broken event never blocks the parent request.

Commit message ready: `feat(push-3): engagement instrumentation + mobile publish parity + record-view`.

### Push 9 details (just shipped locally)

Goal: rebuild the mobile Studio surface around 5 V2 tabs with a distinct visual identity, gate Pro features, and ship a first-time tour. Backend (Push 8) is already deployed — Push 9 is mobile-only.

Files added (mobile):

- `WiamAppMobile/src/api/studioV2.js` — wraps every Push 8 endpoint (`/universes`, `/series`, `/series/<id>/books`, `/stories/<id>/arcs`, `/arcs/<id>`, `/studio/stories/<id>/chapter/<n>/schedule`, `/studio/settings`, `/studio/pro/{status,products,iap-receipt}`). 402 responses are surfaced as a structured `{proRequired: true}` error so screens can route to the paywall.
- `WiamAppMobile/src/constants/studioTheme.js` — distinct STUDIO_COLORS palette (indigo `#0a0a1f` + violet `#a855f7` + gold pro `#fbbf24`) so Studio looks visibly different from main app's wine/gold.
- `WiamAppMobile/src/screens/studio/v2/StudioLibraryScreen.js` — V2 root tab. Lists Stories, Series and Universes with pro-gated "+ New …" actions. Triggers first-time tour when `has_seen_v2_tour=false`.
- `WiamAppMobile/src/screens/studio/v2/StudioTourModal.js` — 3-card welcome modal (Welcome / Group what you write / Pro unlocks). Sets `has_seen_v2_tour=true` on dismiss.
- `WiamAppMobile/src/screens/studio/v2/StudioScheduleScreen.js` — V2 Schedule tab. Iterates `studioApi.getStory()` per book to surface every chapter with `scheduled_publish_at` in the future, sorted ascending. Tapping opens `ChapterEditor`.
- `WiamAppMobile/src/screens/studio/v2/StudioMoneyScreen.js` — V2 Money tab. Quick earnings stats + Pro hero + deep link into existing `Earnings` screen.
- `WiamAppMobile/src/screens/studio/v2/StudioSettingsScreen.js` — V2 Settings tab. Default unit picker (chapter / episode / part / scene), tool visibility toggles (Series, Universes, Arcs, Scheduling, Premium lock, AI tools), notification toggle, beta_studio_v2 gate, "Replay welcome tour" affordance.
- `WiamAppMobile/src/screens/studio/v2/StudioProPaywallScreen.js` — paywall surface. Hero + 5 feature rows + product list from `/studio/pro/products`. Stub IAP via `/studio/pro/iap-receipt` until Push 10 wires RevenueCat.
- `WiamAppMobile/src/screens/studio/v2/UniverseEditorScreen.js` — minimal create/edit/delete (title, description, visibility). Pro-gated for create.
- `WiamAppMobile/src/screens/studio/v2/SeriesEditorScreen.js` — minimal create/edit/delete (title, description, status). Adds book add/remove list when editing. Pro-gated for create.

Files modified (mobile):

- `WiamAppMobile/src/navigation/StudioNavigator.js` — full rewrite. Root is now a 5-tab `BottomTabNavigator` (Library / Editor / Schedule / Money / Settings) wrapped in a Stack so legacy editor routes (NewStory, StoryManager, ChapterEditor, Earnings, OrderApprovals, StoryAnalytics) AND new V2 routes (StudioProPaywall, UniverseEditor, SeriesEditor) remain reachable. Editor tab points at the existing `StudioDashboardScreen` so deep editing flows are unchanged.

No new dependencies. `@react-navigation/bottom-tabs@7.15.6` and `lucide-react-native` were already in `package.json`. ReadLints clean.

Commit message ready: `feat(push-9): WiamStudio V2 mobile rebuild — 5-tab navigator, paywall, universes & series, tour`.

### Push 10 details (just shipped locally)

Goal: surface the V2 universe / series structure to readers, add series progression to the reader, and ship a chapter-access lookup so the reader can render unlock UI without a 403 round-trip.

Backend (mounted under `/api/v1`):

- `GET /universes/<id>/public` — reader-facing universe page (no JWT). Returns the universe + its public series (with up-to-6 sample books each) + a creator strip. Hidden universes return 404 to avoid leaking existence.
- `GET /series/<id>/public` — reader-facing series page (no JWT). Returns the series + ordered book list + parent universe + creator strip.
- `GET /books/<id>/series-context` — used by `BookDetail` to show "Book 2 of 5" banners. Returns `{series, books[], position, total}` or empty if the book isn't in a public series.
- `GET /books/<id>/next-in-series` — used by `Reader` after the final chapter. Returns the next sibling book in any public series the current book belongs to.
- `GET /books/<id>/chapter/<n>/access` (`@jwt_optional`) — per-user lock-state lookup. Returns `coin_locked`, `premium_locked`, `price_coins`, `is_creator`, `has_access`, `has_unlock`, `is_premium_subscriber`, `coin_balance`, `can_read`, and `unlock_method_hint` so the mobile reader can render the right CTA before pulling the chapter body.

All five routes import `jwt_optional` (added to studio_v2_api.py imports). Each returns sane payloads when called by guests.

Mobile:

- `WiamAppMobile/src/api/studioV2.js` — extended with `getUniversePublic`, `getSeriesPublic`, `getBookSeriesContext`, `getNextInSeries`, `getChapterAccess` helpers.
- `WiamAppMobile/src/screens/content/UniverseDetailScreen.js` — full reader page. Hero cover with 240-px parallax, kind/title/creator strip, description + counts, then a vertical list of series cards each carrying up to 6 mini book covers. Tapping a series → `SeriesDetail`; tapping a mini book → `BookDetail`. Share button + back button overlay the cover.
- `WiamAppMobile/src/screens/content/SeriesDetailScreen.js` — reader page for an ordered series. Shows the parent universe (clickable), a "Start with `<book #1>`" primary CTA, and a numbered list of books with cover, genre, views, snippet. Visual identity stays in main-app wine/gold (this is reader-side).
- `WiamAppMobile/src/screens/content/BookDetailScreen.js` — fetches `getBookSeriesContext` on mount and renders a gold "SERIES — Book X of Y" banner above the reviews block. Tap routes to `SeriesDetail`. Banner is hidden when the book isn't in a public series.
- `WiamAppMobile/src/screens/content/ReaderScreen.js` — when the reader is on the final chapter we silently fetch `getNextInSeries`. If we get a hit, the end-of-story zone now also renders a "NEXT IN SERIES" card under the "you're caught up" message with the next book's title + description and a "Continue the journey →" CTA that `navigation.replace`s to the next book.
- `WiamAppMobile/src/navigation/AppNavigator.js` — registered `UniverseDetail` and `SeriesDetail` Stack.Screens (slide_from_right) above the Studio root.
- `WiamAppMobile/src/navigation/linking.js` — added deep-link routes: `wiamapp://universe/:universeId` → `UniverseDetail`, `wiamapp://series/:seriesId` → `SeriesDetail`. Universal links work too (`https://wiamapp.com/universe/<id>`, `/series/<id>`). Existing reader/book/creator links untouched.

QA:

- `scripts/qa/comprehensive_bot.py` — added 5 read-only probes for `/books/<id>/series-context`, `/books/<id>/next-in-series`, `/books/<id>/chapter/<n>/access`, `/universes/<id>/public`, `/series/<id>/public`. All run inside the existing `bot-comprehensive` job → no extra GitHub Actions minutes.

`python -m py_compile webapp/routes/studio_v2_api.py` clean. ReadLints across all touched mobile files clean.

Commit message ready: `feat(push-10): Reader V2 — public Universe/Series pages, series banner & next-in-series CTA, chapter access lookup`.

### Push 11 details (just shipped locally)

Goal: make the AI roadmap honest (no surprise costs), scan the entire mobile app for unwired buttons (zero), and produce a manual QA checklist that anyone can execute end-to-end.

Backend:
- `webapp/models.py` — added `ai_waitlist BOOLEAN DEFAULT FALSE` to `CreatorSettings`.
- `webapp/__init__.py` — added `ai_waitlist` column to the `w_creator_settings CREATE TABLE` and a separate `ALTER TABLE … ADD COLUMN IF NOT EXISTS ai_waitlist` for backfill.
- `webapp/routes/studio_v2_api.py` — `_settings_json` now exposes `ai_waitlist`; PATCH `/studio/settings` accepts it as a boolean.

Mobile:
- `WiamAppMobile/src/screens/studio/v2/AIComingSoonScreen.js` — **new file**. Honest "Smart, not loud" coming-soon page. Hero icon + 3 features (writing suggestions, series reminders, reader-aware ideas) + 4 explicit promises (no training on your content, opt-in, off-switch, founders grandfathered). "Notify me" toggles `ai_waitlist=true` via the existing settings PATCH.
- `WiamAppMobile/src/screens/studio/v2/StudioSettingsScreen.js` — when `show_ai_tools=true`, surfaces a small "Preview AI roadmap & join waitlist" pill below the toggle that opens `AIComingSoon`.
- `WiamAppMobile/src/navigation/StudioNavigator.js` — registered `AIComingSoon` Stack.Screen in the Studio outer stack.

Wire-audit:
- `scripts/qa/wire_audit.py` — **new file**. Static scan over every `.js`/`.jsx` under `WiamAppMobile/src` (124 files, 349 interactive components today). Flags `onPress={() => {}}` no-ops AND actionable touchables that have no `onPress` at all. `--strict` exits 1 if any no-op handlers exist.
- First run found 4 actionable `<TouchableOpacity>`s with no handler (3 dashboard stat cards + 1 profile row header). Converted them to `<View>` (informational, not actionable). Second run is **clean: 0 missing, 0 no-op**.

Documentation:
- `docs/STUDIO_V2_QA.md` — **new 17-section** manual QA checklist covering creator onboarding, the 5 Studio tabs, Pro paywall, AI waitlist, Reader V2 series progression / Universe / Series pages, chapter access lookup, engagement tracking, Cloudinary delete-on-replace, and known limitations (RevenueCat stub, AI deferred, etc.).

`python -m py_compile webapp/routes/studio_v2_api.py webapp/models.py webapp/__init__.py scripts/qa/wire_audit.py` clean. All ReadLints clean.

Commit message ready: `feat(push-11): AI coming-soon waitlist + wire-audit (0 issues) + Studio V2 manual QA checklist`.

---

## Deployment & backup (agent protocol)

After `webapp/` (or Dockerfile) fixes, **`git push` to `master` is enough**: GitHub is the surviving copy if hardware dies; Render rebuilds/deploys automatically when auto-deploy is on for this repo. Skip separate “deploy ping” workflows unless Render auto-deploy gets turned off.

---

## 2026-04-30 — Creator activation & mobile Studio

- **Follow model:** `Follow.creator_id` / `user_id` align with `User.id` (PK) in API and web `Follow()` creation. Web dashboard follower counts + lists use `current_user.id` and `User.id` lookups; `creator_sub_service._get_creator_metrics` follower count uses `creator.id`.
- **API:** `_me_json` matches `/auth/me`; `/apply/submit` returns `user` on approve/reject/pending. Creator/studio endpoints use `_creator_api_forbidden()` including `/creator/ad-earnings` and all `/studio/*` mutating routes.
- **Mobile:** Root stack registers `Studio` → `StudioNavigator` (dashboard, new story, manager, chapter editor, earnings, order approvals). Drawer + Profile link to Studio (`getParent()?.navigate('Studio')`). Deep link `wiamapp://studio` / `https://wiamapp.com/studio`. Non-creators hitting studio home are redirected to `Main`. Removed phantom `MainTabs` Studio path from linking config.

## Readiness verdict (2026-04-29)

**Verdict: NOT yet ready to publish to Production. Ready to start Internal Testing once 4 fixes land.**

Mobile build is healthy (`expo-doctor` 17/17, all assets present, plugins correct, package id good). Backend is healthy (41/43 mobile endpoints PASS — every screen the app needs has a working route, with auth-protected routes correctly returning 401). Two Apple/Android verification files are missing, and there are real money-flow gaps that will silently break IAP in a production build.

### Hard launch blockers (must fix before paying for the build)

1. **RevenueCat keys missing from production env.** `WiamAppMobile/src/services/iap.js` reads `EXPO_PUBLIC_RC_APPLE_KEY` and `EXPO_PUBLIC_RC_GOOGLE_KEY` from build-time env. `WiamAppMobile/eas.json` `build.production.env` only has `EXPO_PUBLIC_API_URL`. If we build today, every coin-pack purchase and every subscription purchase will silently fail with `[IAP] No RevenueCat API key for android` — Play will see broken IAP and reject. Fix: add both keys to `eas.json` production env (after the user creates the RevenueCat project).
2. **Play Integrity cloud project number missing.** `WiamAppMobile/src/utils/playIntegrity.js` returns `missing_cloud_project_number` if `EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER` is unset. Backend's `/security/play-integrity/verify` will then refuse purchases. Fix: set the value in `eas.json` production env after creating the Google Cloud project.
3. **No public account-deletion landing page.** Play Console requires a URL that anyone (including reviewers, not logged in) can visit to learn how to delete their account. Today `https://wiamapp.com/account/delete` redirects to `/login`. Fix: add a no-auth `/data-deletion` page describing the in-app flow + a contact email for users who can't log in.
4. **No Google Play Developer account yet.** $25 one-time, ID + address verify takes 2-7 days for new accounts. Then 14-day mandatory closed test before Production access. Start this before everything else — it is on the critical path.

### Soft blockers (will hurt UX or trigger Play warnings, not outright reject)

5. **`assetlinks.json` not served.** `app.json` declares `intentFilters[0].autoVerify: true` for `wiamapp.com/book` and `/creator`. Without `https://wiamapp.com/.well-known/assetlinks.json` (signed with the production keystore SHA-256), Android won't auto-verify deep links → tapping a `wiamapp.com/book/...` link opens the browser instead of the app. Fix path: after the first EAS build, run `npx eas-cli credentials -p android` to get the SHA-256, then add a Flask route that serves the file. (Or remove `autoVerify: true` and accept the "open with…" chooser.)
6. **`apple-app-site-association` not served.** Same shape as #5 but iOS-only. Not blocking Android Play launch.
7. **Apple/Google IAP products not yet created in stores.** Backend + RevenueCat code is complete (per `IAP_COMPLETION_PLAN.md`); only the store-side product creation is pending. 5 coin packs + 4 subscriptions to create in Play Console, all matching IDs in `WiamAppMobile/src/services/iapProducts.js`.
8. **EAS placeholder `projectId`.** `app.json` has `extra.eas.projectId: "wiamapp-mobile"`. `eas init` overwrites this to a real UUID on first run; will fail before that.
9. **Empty `eas.json` `submit.production`.** Means `eas submit --platform android` won't work without manual config. Not blocking the first manual upload, but will block automation later.

### Things that are actually fine

- All 6 required Play assets present (`icon`, `splash-icon`, 3 adaptive-icon variants, `favicon`).
- Privacy policy + terms both 200 from prod (verified).
- 41/43 mobile endpoints reachable on `https://api.wiamapp.com/api/v1`. Auth-protected routes correctly enforce 401. (Probe script: `scripts/qa/readiness_probe.py`.)
- AdMob: real publisher ID (`ca-app-pub-7267152032047381`) configured; test IDs gate-checked in `__DEV__`; placeholder detection helper exists; premium users excluded from ads.
- In-app account-deletion endpoint + soft-delete is implemented (`/auth/delete-account` in `webapp/routes/api_v1.py`).
- Dev-only `/premium/dev-activate` is locked to founder accounts in production.
- No hardcoded localhost URLs in production code paths.
- Only 0 real TODO/FIXME blockers (regex matches were false positives).
- `expo-doctor` 17/17 passing.
- QA pipeline (`qa-enterprise-ceo-rest-mode`) is live and stays in the GitHub Actions free tier.

### Suggested fix order

1. Open Play Developer account (parallel to all other work — slowest gate).
2. Add public `/data-deletion` page to webapp + deploy.
3. Create RevenueCat project + Google Cloud project; collect the 3 missing env values.
4. Update `eas.json` production env with all 3 values.
5. `eas init` → first `eas build -p android --profile production`.
6. After build, `eas credentials` → grab SHA-256 → add `assetlinks.json` route → deploy.
7. Upload AAB to Internal Testing → enroll ≥12 testers.
8. Create Play Console listing entries (descriptions, screenshots, content rating, data safety, target audience).
9. Promote to Closed Testing → wait the mandatory 14 days.
10. Apply for Production access → ship.

---

## Currently active task

**Goal:** Register WiamApp on the Google Play Store.

**Why now:** User is ready to ship. Codebase already passes the static `playstore-readiness` CI gate (privacy + terms 200, all 6 required assets, deeplink host `wiamapp.com`, package `com.wiamapp.mobile`, all required Expo plugins).

**Reference checklist:** `WiamAppMobile/docs/PLAY_RELEASE_CHECKLIST.md` — track progress against its sections.

### Status by checklist section

| Section | State | Note |
| --- | --- | --- |
| 0.1 Open Play Console developer account ($25) | TODO (user action) | 2-7 days for ID/address verification on new accounts. Start ASAP — blocks everything. |
| 0.2 `eas init` to lock real EAS `projectId` | TODO | `app.json` still has placeholder `wiamapp-mobile`. Needs user logged into Expo. |
| 0.3 First production AAB | TODO | `npx eas-cli build -p android --profile production` — cloud build, ~30-60 min. |
| 0.4 Internal Testing track + ≥12 testers | TODO | Manual upload first time, then `eas submit --platform android` once service-account JSON is in place. |
| 0.5 Closed Testing 14-day window | TODO (mandatory for new accounts) | Cannot publish to Production until this completes. |
| 0.6 Apply for Production access | TODO | 1-3 days after 0.5 passes. |
| 0.7 Promote to Production | TODO | Minutes once 0.6 approved. |
| §1 Code and config | DONE per checklist (all 7 items checked). | — |
| §2 AdMob account readiness | TODO (user action in AdMob console). | — |
| §3 Play Console requirements (privacy URL, data safety, content rating, app access, deletion URL, target audience + ads). | TODO (filled in Play Console UI). | — |
| §4 Pre-launch quality gates (Play pre-launch report + 7 critical flows). | TODO. | — |

### Code-side work — DONE 2026-04-29

- [x] `WiamAppMobile/eas.json` now declares `EXPO_PUBLIC_RC_APPLE_KEY`, `EXPO_PUBLIC_RC_GOOGLE_KEY`, `EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER` on all three build profiles. Values are clearly-marked `REPLACE_ME_*` placeholders pending external account setup. See `WiamAppMobile/EAS_SETUP.md` for what to fill in.
- [x] `WiamAppMobile/eas.json` `submit.production.android` wired to upload AABs to the `internal` track via `./play-service-account.json` (gitignored).
- [x] Public `/data-deletion` landing page added (`webapp/templates/data_deletion.html` + route in `webapp/routes/seo.py`). No-auth, anyone can read it. Linked from sitemap.
- [x] Flask route for `/.well-known/assetlinks.json` added. Reads `ANDROID_APP_SHA256_FINGERPRINTS` env var on Render — returns `[]` until populated, real JSON once set. Comma-separated values supported.
- [x] Flask route for `/.well-known/apple-app-site-association` added. Reads `APPLE_TEAM_ID` env var; returns valid empty AASA until set.
- [x] QA workflow now probes `/data-deletion`, `/.well-known/assetlinks.json`, `/.well-known/apple-app-site-association` on every run. Heartbeat covers them.
- [x] `.gitignore` now blocks `play-service-account.json` from accidental commit.
- [x] Full registration runbook documented in `WiamAppMobile/REGISTER.md`.

### Remaining work — external (you, on Google's / Expo's web UIs)

1. **Open Google Play Developer account** — $25 one-time at https://play.google.com/console/signup. 2-7 days to verify. *Critical path — start first.*
2. **Set up RevenueCat** — create project, add iOS + Android apps, copy public API keys into `eas.json` (overwriting the `REPLACE_ME_*` strings). Walkthrough: `WiamAppMobile/EAS_SETUP.md`.
3. **Create Google Cloud project + enable Play Integrity API** — copy 12-digit project number into `eas.json`.
4. **Create Play service-account JSON** — save as `WiamAppMobile/play-service-account.json` (already gitignored).
5. **Run `eas init`** — interactive Expo login required. After it rewrites `app.json`, commit + push so the `playstore-readiness` CI step verifies the new UUID.
6. **First production build** — `npx eas-cli build --profile production --platform android`. ~30 min.
7. **Capture signing-key SHA-256** — `npx eas-cli credentials -p android` → set `ANDROID_APP_SHA256_FINGERPRINTS` on Render → redeploy → curl `/.well-known/assetlinks.json` to verify it now returns the array.
8. **Create IAP products in Play Console** — 5 coin packs + 4 subscriptions, IDs must match `WiamAppMobile/src/services/iapProducts.js`. Walkthrough: `IAP_COMPLETION_PLAN.md`.
9. **Upload AAB to Internal Testing track + invite ≥12 testers**.
10. **Fill Play Console listing forms** — listing copy, screenshots, feature graphic, content rating, data safety, target audience, ads disclosure, privacy URL `https://wiamapp.com/privacy`, deletion URL `https://wiamapp.com/data-deletion`.
11. **14-day Closed Testing** (mandatory for new accounts).
12. **Apply for Production access** → 1-3 days review → ship.

### Decisions made

- User picked option `play_store` (register WiamApp/WiamVox on Google Play). Started with WiamApp; WiamVox is a separate Play Console listing handled later.
- Persistent memory system: `.cursor/rules/project-context.mdc` (alwaysApply rule) + this file (mutable journal). Created 2026-04-29.

### Blockers / waiting on

- User to choose registration scope (minimal fixes vs full prep vs both apps vs build-now). Last attempt to ask was interrupted before answer was given — re-ask next turn.

---

## Standing reminders for the agent

- **Expo Go + `@expo/app-integrity`:** Never static-import — lazy `require()` only when `Constants.appOwnership !== 'expo'`, or the app crashes with `Cannot find native module 'ExpoAppIntegrity'`. Fixed 2026-04-29 in `WiamAppMobile/src/utils/playIntegrity.js`.
- This is a Windows host. Use `curl.exe` not `curl` (PowerShell aliases `curl` to `Invoke-WebRequest`).
- `eas-cli` is available via `npx eas-cli` (no global install needed). First `npx` run downloads ~30s.
- Don't add jobs to `qa-enterprise-ceo-rest-mode.yml` without checking the minute budget at the top of the file.
- WiamVox's `app.json` is much thinner than WiamApp's — it lacks adaptive-icon assets, deeplink intent filters, notifications plugin, and `extra.eas.projectId`. It will fail the same readiness checks WiamApp passes today. Address before its own Play registration.

---

## Active security follow-ups (2026-04-29)

These are real but **contained** because the GitHub repo is **private** (`isPrivate: true`, verified via `gh repo view WiamLabs/WiamApp`). Anyone you've added as a collaborator can read all the secrets below.

| Secret | Where leaked | Rotate? | Priority |
| --- | --- | --- | --- |
| `FLASK_SECRET_KEY` | `.env.render` line 4 | **YES** — anyone with this can forge admin/founder login sessions | **HIGH** |
| `BOT_TOKEN` (Telegram) | `.env.render` line 2 | **YES** — anyone with this controls @WiamAppTestBot | **HIGH** |
| Neon DB password (`npg_3NP4qGIoFCJV`) | `.env.render` line 1 | YES (legacy DB but still readable as a backup) | MEDIUM |
| Founder Telegram ID `8597991576` | `.env.render` line 5 | Cannot rotate (real ID); already public-ish | LOW |
| MoMo number `+233 552 690 290` | `.env.render` line 8 | Cannot rotate easily (real phone) | LOW |
| Bank account `2030407344315` (Wiafe Martin) | `.env.render` line 9 | Cannot rotate (real bank account) | LOW (but be aware) |

Plus once rotations are done:
- Remove `.env.render` from git tracking (`git rm --cached`), add to `.gitignore`.
- Optionally rewrite history to purge it (only worth it if you'll ever make repo public — not urgent today).

## Recently completed (rolling log, newest on top)

- 2026-04-29 — **Username uniqueness system:** Added GET `/auth/check-username` (returns availability + 5 suggestions), updated PUT `/auth/profile` to accept username with uniqueness check, updated registration to validate/generate unique usernames, added `unique=True` to User.username model. Mobile `OnboardingStep2.js` now has live username check with checkmark/cross, error message, and clickable suggestions. Remaining: DB migration for existing duplicates, SettingsScreen edit UI.
- 2026-04-29 — **Extended QA bot coverage (zero cost):** Added 6 new test categories to `scripts/qa/comprehensive_bot.py`: payment smoke (coin packages shape, IAP store_product_ids, bogus purchase rejection), push infra (notifications feed, invalid token rejection, token deletion), image upload (1x1 base64 PNG to avatar endpoint), mini load test (10 concurrent /home requests), resilience (9 bad-input patterns testing for 5xx crashes), screen-flow simulation (home→book detail→chapter→creator profile). ~17 new probes, all run inside the existing `bot-comprehensive` job — no new jobs, no budget increase.
- 2026-04-29 — **CRITICAL: api.wiamapp.com DNS broken** — resolves to 127.0.0.1, mobile app would be dead. Switched `PROD_API_URL` and all `eas.json` profiles to `https://wiamapp.com/api/v1`. Pushed `8b00c30`.
- 2026-04-29 — **Fixed 4 Content.rating crashes**: `recommendation_service.py` lines 70, 155, 333, 383 all used `book.rating` / `c.rating` / `b.rating` on `Content` objects which only have `.avg_rating` (@property). Also fixed missing `import logging` + `log` in `api_v1.py` (secondary NameError in except block). Pushed `43714e3` + `a7f7b38`.

- 2026-04-29 — Repo-wide doc cleanup: replaced "Neon" with "Supabase" in active docs (`README.md`, `WiamAppMobile/README.md`, `WiamAppMobile/docs/EXPO_BUILD.md`, `WiamLabs/KNOWN_LIMITATIONS.md`, `.env.example`, `render.yaml` comment, `engineer_dashboard.html`, `docs/privacy-policy.html` + `.txt`). Added "HISTORICAL" header notes to Fly.io-era docs (`WiamLabs/DEPLOYMENT_RUNBOOK.md`, `BACKUP_RESTORE.md`, `ARCHITECTURE_MAP.md`). Marked old migration plans as COMPLETED / SUPERSEDED. Did NOT touch: code comments in `webapp/routes/*.py` (no behavior impact), `cover_scanner.py` ("neon" = colors), `.env.render` (handled separately as a security item), historical perf snapshots in `WiamLabs/SCALE_*.md` (preserve real measurement context).
- 2026-04-29 — **Production DB host clarified: Supabase Postgres** (project `evwxgyiadhdsorqcpptc`), NOT Neon. Repo docs/`.env.render` were stale — rule file updated. Ran `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every table in `public` via Supabase SQL Editor; all ~150 `rls_disabled_in_public` + 7 `sensitive_columns_exposed` advisor warnings cleared. Flask backend unaffected (uses owner role, bypasses RLS).
- 2026-04-29 — Documented SUPPORT_EMAIL vs COMPANY_EMAIL in `webapp/config.py` (support@ vs labs@), wired team forgot-password + QA dashboard + privacy/data_deletion templates; `.env.example` updated.
- 2026-04-29 — Closed all 4 code-side launch blockers: eas.json env wiring, public `/data-deletion`, `/.well-known/assetlinks.json` + `apple-app-site-association` routes, REGISTER.md runbook, `.gitignore` for service-account JSON.
- 2026-04-29 — Built `scripts/qa/readiness_probe.py`. First run: 41/43 PASS, 2 FAIL (assetlinks + AASA — fixed by route additions, will flip to PASS after deploy).
- 2026-04-29 — Set up persistent memory system (this file + `.cursor/rules/project-context.mdc`).
- 2026-04-29 — Verified `https://wiamapp.com/privacy` and `/terms` both return 200.
- 2026-04-29 — Confirmed `npx eas-cli` works (eas-cli/18.8.1, node v22.22.0).
