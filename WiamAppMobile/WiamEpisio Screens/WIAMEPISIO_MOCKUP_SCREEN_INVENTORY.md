# WiamEpisio — Full Mockup Screen Inventory

**For:** Martin — design every HTML mockup against this list before build  
**Brand (do not change):** Navy `#08081A` · Card `#12122A` · Soft `#161634` · Line `#1E1E42` · Gold `#D4A017` · Gold-dark `#A07810` · Dim `#7D7D97` · Faint `#5A5A75` · Font **Inter**  
**Product law:** **High quality beats speed.** Soft followers/interest still apply, but if quality fails, nothing goes public.  
**Status:** Mockup brief — not a code blueprint yet  
**Progress (2026-07-18):** 67 of ~83–103 in-scope screens delivered as HTML (Section I / Founder ops excluded by request) — includes the original 19 + all newly built files, marked **(HAVE)** below. See `WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md` for the section-by-section breakdown and build order for what's left.  

---

## 0. Video & image specs creators must see (show on upload screens)

Every upload / Studio screen must display these rules clearly (not buried in FAQ).

### Episode video (main content)

| Rule | Spec |
|------|------|
| Orientation | **Vertical only** |
| Aspect ratio | **9:16** (exact) |
| Preferred resolution | **1080 × 1920** |
| Minimum resolution | **720 × 1280** |
| Max resolution | **1080 × 1920** (reject higher for cost/control in v1) |
| Codec / container | **H.264 + AAC in MP4** |
| Target duration | **4–5 minutes** |
| Accept band | **3:00 – 6:00** (outside = fail QA or force human review) |
| Max file size (v1) | **500 MB** per episode (tunable) |
| Audio | Stereo or mono, clear dialogue preferred |
| Forbidden | Horizontal 16:9, square 1:1, TikTok watermark dumps as final, black bars that break 9:16 |

### Trailer video

| Rule | Spec |
|------|------|
| Aspect | **9:16** |
| Resolution | Same as episode (prefer 1080×1920) |
| Duration | **15–60 seconds** |
| Purpose | Hook only — quality gate for publish |
| Same codec | H.264 MP4 |

### Cover / poster

| Rule | Spec |
|------|------|
| Role | Series thumbnail on Home rails |
| Aspect | **2:3** (portrait poster) |
| Min size | **600 × 900** |
| Preferred | **1080 × 1620** |
| Formats | JPG / PNG / WebP |
| Max size | **5 MB** |

### Cover banner (series detail / hero)

| Rule | Spec |
|------|------|
| Role | Wide hero behind series title (or tall hero if vertical brand) |
| Aspect (mobile hero) | **9:16** trailer poster **or** **16:9** banner — **pick one in mockups; recommend vertical trailer frame for Episio** |
| Recommended for Episio | Use **trailer poster frame 9:16** as hero; optional wide banner later |
| If wide banner used | **1920 × 720** (8:3), max 5 MB |

### Episode thumbnail (optional override)

| Rule | Spec |
|------|------|
| Aspect | **9:16** |
| Min | **720 × 1280** |
| Auto | System can pull first frame; creator may replace |

**Quality principle on UI copy:** “We reject soft, blurry, wrong-size, or incomplete series. Finish the show. Match the frame. Then we go live.”

---

## 1. Creator ladder (reminder for Studio screens)

1. **Apply** (with sample) → accepted  
2. **Private WiamStudio** (upload, no public earn)  
3. **Hard quality** (complete series + trailer QA + size/duration) — **highest priority**  
4. **Soft interest** (followers **or** Remind-me on teaser)  
5. **Go live** (reviewer if team free within ~72h, else auto if gates green)  
6. **Earn**  

Later tier (not entry): Verified Studio / multi-series / Wiam Origin deals.

---

## 2. Already mocked (keep; refine if needed)

Suggested filenames match your pack. Mark **HAVE** = exists in `WiamAppMobile/WiamEpisio Some Of The Screens/`.

| # | Suggested HTML file | Notes |
|---|---------------------|--------|
| 1 | `WiamEpisio-Splash.html` | HAVE |
| 2 | `WiamEpisio-Home.html` | HAVE |
| 3 | `WiamEpisio-For-You-Feed.html` | HAVE (Discover) |
| 4 | `WiamEpisio-Register.html` | HAVE |
| 5 | `WiamEpisio-Player.html` | HAVE |
| 6 | `WiamEpisio-Series-Detail-Sheet.html` | HAVE |
| 7 | `WiamEpisio-Episode-List-Sheet.html` | HAVE |
| 8 | `WiamEpisio-My-List.html` | HAVE |
| 9 | `WiamEpisio-My-List-Reminder-Empty.html` | HAVE |
| 10 | `WiamEpisio-My-List-Choose-Mode.html` | HAVE |
| 11 | `WiamEpisio-Profile.html` | HAVE |
| 12 | `WiamEpisio-Profile-Guest.html` | HAVE |
| 13 | `WiamEpisio-Membership.html` | HAVE |
| 14 | `WiamEpisio-Membership-Offer-Modal.html` | HAVE |
| 15 | `WiamEpisio-Buy-Coins.html` | HAVE |
| 16 | `WiamEpisio-Unlock-Takeover.html` | HAVE |
| 17 | `WiamEpisio-Welcome-Bonus.html` | HAVE |
| 18 | `WiamEpisio-Wiam-Origin-Intro.html` | HAVE |
| 19 | `WiamEpisio-Next-Suggestion.html` | HAVE |

---

## 3. Full inventory — what the user sees (design every one)

Use suggested filenames. For each: **who**, **what they see**, **tools/controls**, **states**.

---

### A. Boot & first session

#### A01 — `WiamEpisio-Splash.html` (HAVE)
- **Who:** Everyone  
- **See:** Gold “W” mark, wordmark Wiam**Episio**, tagline “African Vertical Drama”, loader, footer © WiamLabs  
- **Tools:** None (auto advance)

#### A02 — `WiamEpisio-Onboarding-Welcome.html` (HAVE)
- **Who:** New user after signup  
- **See:** Brand hero, 1 sentence value (“Vertical African drama”), Continue  
- **Tools:** Continue / Skip

#### A03 — `WiamEpisio-Onboarding-Genres.html` (HAVE)
- **Who:** New user  
- **See:** Genre grid (Drama, Romance, Revenge, etc.), “Pick at least 3”  
- **Tools:** Multi-select chips, Continue (disabled until 3)

#### A04 — `WiamEpisio-Onboarding-Done.html` (HAVE)
- **Who:** New user  
- **See:** Success, optional welcome coins teaser  
- **Tools:** Start watching

#### A05 — `WiamEpisio-Welcome-Bonus.html` (HAVE)
- **Who:** After register  
- **See:** Coin burst, free coins amount, CTA to watch  
- **Tools:** Claim / Start watching

---

### B. Auth

#### B01 — `WiamEpisio-Register.html` (HAVE)
- **See:** “Get free coins”, phone (optional), email, password, Continue, Google, guest link  
- **Tools:** Inputs, Continue, social, close, guest

#### B02 — `WiamEpisio-Login.html` (HAVE)
- **See:** Email, password, Forgot, Sign in, link to Register  
- **Tools:** Same + Forgot password

#### B03 — `WiamEpisio-Forgot-Password.html`
- **See:** Email field, Send reset  
- **Tools:** Submit, back

#### B04 — `WiamEpisio-Reset-Password.html`
- **See:** New password ×2, Save  
- **Tools:** Submit

#### B05 — `WiamEpisio-OTP-Verify.html` (if phone OTP later)
- **See:** 6-digit code, resend timer  
- **Tools:** Code boxes, Resend, Verify

#### B06 — `WiamEpisio-Age-Gate.html`
- **See:** DOB or “I am 13+”, legal note  
- **Tools:** Confirm

---

### C. Main tabs — Viewer

#### C01 — `WiamEpisio-Home.html` (HAVE)
- **See:** Logo + Sign In / search, chips (Popular · Fresh · Rankings · Categories · Wiam Origin · Anime · VIP), hero TRAILER card, genre chips, Continue Watching, Trending, Origin, Coming Soon + Remind Me  
- **Tools:** Search entry, chip tabs, play hero, poster tap, Remind Me, bottom nav  
- **Note:** Add **Novel** as top control (hub entry) when you mock Novel — not only a chip if product law says top button

#### C02 — `WiamEpisio-Home-Rankings.html` (HAVE)
- **See:** Soft chart list #1–#50, period Weekly/Monthly, posters + rank badges  
- **Tools:** Period toggle, tap series

#### C03 — `WiamEpisio-Home-Categories.html` (HAVE)
- **See:** Category grid / list (Drama, Romance…)  
- **Tools:** Tap category → shelf

#### C04 — `WiamEpisio-Category-Shelf.html` (HAVE)
- **See:** Title of category, filterable poster grid  
- **Tools:** Sort (Popular / Fresh), poster tap

#### C05 — `WiamEpisio-Home-Origin-Shelf.html` (HAVE)
- **See:** Wiam Origin exclusives rail/grid + short Origin explainer strip  
- **Tools:** Tap series / Origin intro

#### C06 — `WiamEpisio-Home-Anime-Shelf.html` / `WiamEpisio-Home-VIP-Shelf.html` (VIP shelf HAVE — Anime shelf uses same pattern, still open)
- **See:** Shelf posters; VIP locked badge if not member  
- **Tools:** Tap / Membership CTA

#### C07 — `WiamEpisio-For-You-Feed.html` (HAVE) — Discover tab
- **See:** Tall vertical cards, play affordance, title/meta  
- **Tools:** Swipe/scroll, tap open series/player

#### C08 — `WiamEpisio-Search.html` (HAVE)
- **See:** Search field, recent searches, results (series + creators)  
- **Tools:** Keyboard search, clear, result tap

#### C09 — `WiamEpisio-Search-Empty.html` / `WiamEpisio-Search-No-Results.html` (No-Results HAVE — Empty state open)
- **See:** Empty / no results states with suggestions

#### C10 — `WiamEpisio-Membership.html` (HAVE)
- **See:** VIP card, perks list, plan price or “Coming soon”, link Buy Coins  
- **Tools:** Subscribe CTA, plan picker (when live)

#### C11 — `WiamEpisio-Membership-Offer-Modal.html` (HAVE)
- **See:** Timed offer overlay  
- **Tools:** Accept / Dismiss

#### C12 — `WiamEpisio-My-List.html` (HAVE)
- **See:** History rows (poster, progress bar, EP x/y), Most Trending grid  
- **Tools:** Tap continue, remove (long-press), mode switch

#### C13 — `WiamEpisio-My-List-Empty.html` / Reminder empty (HAVE)
- **See:** Empty illustration + Sign in / browse CTA

#### C14 — `WiamEpisio-My-List-Choose-Mode.html` (HAVE)
- **See:** History vs Reminders vs Downloads (if any)  
- **Tools:** Mode chips

#### C15 — `WiamEpisio-Reminders.html`
- **See:** Coming soon series user reminded  
- **Tools:** Cancel reminder, open teaser

#### C16 — `WiamEpisio-Profile.html` (HAVE)
- **See:** Avatar, name, coins / following / list counts, menu: Membership, Buy Coins, History, Daily Rewards, Become Creator / Studio, Notifications, Settings, Help, Sign out  
- **Tools:** Every row navigates

#### C17 — `WiamEpisio-Profile-Guest.html` (HAVE)
- **See:** Guest CTA Sign up / keep browsing

#### C18 — `WiamEpisio-Notifications.html` (HAVE)
- **See:** List: new episode, unlock, coins, creator accepted, series live, system  
- **Tools:** Tap, mark all read, clear

#### C19 — `WiamEpisio-Settings.html` (HAVE)
- **See:** Account, playback (autoplay), download wifi-only, language, currency display, notification toggles, legal links, version  
- **Tools:** Toggles, links

#### C20 — `WiamEpisio-Help-Center.html`
- **See:** FAQ categories, contact support@wiamapp.com  
- **Tools:** Expand FAQ, email / form

#### C21 — `WiamEpisio-About.html`
- **See:** Brand story, WiamLabs line, version

#### C22 — `WiamEpisio-Legal-Privacy.html` / `WiamEpisio-Legal-Terms.html`
- **See:** Scrollable legal text (or WebView chrome)

---

### D. Series, trailer, player, unlock

#### D01 — `WiamEpisio-Series-Detail-Sheet.html` (HAVE)
- **See:** Hero (trailer poster), title, views/rating placeholder, tabs Synopsis | Episodes, tags, More Like This  
- **Tools:** Close, Play, tab switch, tag browse, rec posters  
- **Must show:** episode count, free tier hint, Origin/VIP badge if any

#### D02 — `WiamEpisio-Episode-List-Sheet.html` (HAVE)
- **See:** Numbered episodes, lock icons, free badges, prices in coins  
- **Tools:** Tap ep → play or unlock

#### D03 — `WiamEpisio-Trailer-Player.html` (HAVE)
- **See:** Full trailer play (9:16), series title, Remind Me, Follow creator, “Watch series”  
- **Tools:** Play/pause, scrub, Remind, Follow, close  
- **Quality:** Trailer is the public taste test

#### D04 — `WiamEpisio-Player.html` (HAVE) — YouTube-style
- **See:** Contained video frame (not TikTok-only full bleed), top back, scrub, EP label, fullscreen, below: title, synopsis, Like/Comment/Share/List, episode strip  
- **Tools:** Play, skip prev/next ep, fullscreen/zoom, actions, ep chips  
- **Must support:** portrait + fullscreen zoom

#### D05 — `WiamEpisio-Player-Fullscreen.html` (HAVE)
- **See:** Immersive player, minimal chrome, pinch/zoom hint  
- **Tools:** Exit fullscreen, scrub

#### D06 — `WiamEpisio-Player-Buffering.html` / `WiamEpisio-Player-Error.html` (Error HAVE — includes buffering spinner as inline variant)
- **See:** Spinner / error + Retry / quality tip

#### D07 — `WiamEpisio-Unlock-Takeover.html` (HAVE)
- **See:** Lock icon, coin price, Unlock CTA, Buy coins, Sign in if guest  
- **Tools:** Unlock, Buy coins, close

#### D08 — `WiamEpisio-Unlock-Success.html` (HAVE)
- **See:** Brief success → auto continue playback

#### D09 — `WiamEpisio-Next-Suggestion.html` (HAVE)
- **See:** End of episode / series → next series card  
- **Tools:** Play next / Not now

#### D10 — `WiamEpisio-Rate-Series.html` (HAVE)
- **See:** Star rating sheet  
- **Tools:** Stars, submit

#### D11 — `WiamEpisio-Share-Sheet.html` (HAVE)
- **See:** Share link / copy / native share targets  
- **Tools:** Copy, share apps

#### D12 — `WiamEpisio-Comments.html` (if v1 includes comments)
- **See:** Thread under episode  
- **Tools:** Post, like, report  
- **Note:** Can Phase-2; if Phase-1 skip, do not mock as live

#### D13 — `WiamEpisio-Creator-Public-Profile.html` (HAVE)
- **See:** Creator avatar, bio, follower count, series grid, Follow  
- **Tools:** Follow, open series

#### D14 — `WiamEpisio-Wiam-Origin-Intro.html` (HAVE)
- **See:** Origin brand story, exclusives promise  
- **Tools:** Browse Origin / Close

---

### E. Coins, wallet, VIP purchase

#### E01 — `WiamEpisio-Buy-Coins.html` (HAVE)
- **See:** Balance, pack grid (coins + bonus + local price), footer billing note  
- **Tools:** Tap pack → checkout

#### E02 — `WiamEpisio-Checkout-Web.html` (HAVE) / Paystack chrome
- **See:** External checkout feel (or in-app WebView chrome mock)

#### E03 — `WiamEpisio-Coins-Success.html` / `WiamEpisio-Coins-Failed.html` (Success HAVE — includes failed state as inline variant)
- **See:** Success balance update / fail retry

#### E04 — `WiamEpisio-Transaction-History.html` (HAVE)
- **See:** List purchases, unlocks, bonuses  
- **Tools:** Filter

#### E05 — `WiamEpisio-Daily-Rewards.html` (HAVE)
- **See:** Check-in calendar, claim coin  
- **Tools:** Claim

#### E06 — `WiamEpisio-VIP-Checkout.html` (HAVE)
- **See:** Plan select Weekly/Monthly, price, restore purchase  
- **Tools:** Pay, restore

#### E07 — `WiamEpisio-Currency-Note.html` (HAVE) (small)
- **See:** “Prices shown in GHS; billed in USD on server” helper

---

### F. Novel hub (top button — separate from Home chips)

#### F01 — `WiamEpisio-Novel-Hub.html`
- **See:** V2-home style for **reading** (rails), entry from top Novel button  
- **Tools:** Open book detail / reader  
- **Note:** Parked text engine may power later; mock as hub shell

#### F02 — `WiamEpisio-Novel-Book-Detail.html`
- **See:** Cover, synopsis, chapters list, Read  
- **Tools:** Add library, start read

#### F03 — `WiamEpisio-Novel-Reader.html`
- **See:** Text reader chrome (font size, progress)  
- **Tools:** Next chapter, settings  
- **Phase:** Can be later; include in mockup pack so design is ready

---

### G. Become a Creator — Apply (before Studio)

#### G01 — `WiamEpisio-Creator-Apply-Intro.html` (HAVE)
- **See:** “High quality African drama”, rules summary (9:16, complete series, no half shows), what you earn after live  
- **Tools:** Start application / Not now

#### G02 — `WiamEpisio-Creator-Apply-Identity.html` (HAVE)
- **See:** Legal name, country, phone, channel name, bio  
- **Tools:** Next

#### G03 — `WiamEpisio-Creator-Apply-Pitch.html` (HAVE)
- **See:** Genres (max 3), first series pitch, planned episode count, target length reminder (4–5 min)  
- **Tools:** Next

#### G04 — `WiamEpisio-Creator-Apply-Sample.html` (HAVE)
- **See:** **Upload sample (60–180s) OR paste past-work link OR trailer draft**  
- **Must show size rules:** 9:16, 720×1280 min, H.264 MP4  
- **Tools:** Pick file, paste URL, preview, Next

#### G05 — `WiamEpisio-Creator-Apply-Rights.html` (HAVE)
- **See:** Rights checkbox, complete-series checkbox, quality standards checkbox  
- **Tools:** Submit application

#### G06 — `WiamEpisio-Creator-Apply-Submitted.html` (HAVE)
- **See:** Pending review, typical wait time  
- **Tools:** Done / Back home

#### G07 — `WiamEpisio-Creator-Apply-Accepted.html`
- **See:** Congrats → Open WiamStudio  
- **Tools:** Enter Studio

#### G08 — `WiamEpisio-Creator-Apply-Rejected.html`
- **See:** Reason (quality / rights / incomplete), Re-apply date  
- **Tools:** Re-apply / Help

---

### H. WiamStudio (creator private workspace) — CRITICAL MOCKUPS

> Creators cut video in **their own editors**. Studio = upload, metadata, QA status, completeness, submit for live — **not** an in-app NLE (no timeline editor).

#### H01 — `WiamStudio-Home.html` (HAVE)
- **Who:** Accepted creator  
- **See:**  
  - Header: WiamStudio + coin/earnings peek  
  - Status banner: Draft / Needs work / Ready for review / Live  
  - Cards: My Series list (poster, ep progress e.g. 12/40 uploaded, quality flags)  
  - CTA: New Series  
  - Checklist reminder: “Public needs: complete eps · trailer pass · soft interest · review”  
- **Tools:** New Series, open series, Help / Specs

#### H02 — `WiamStudio-Specs-Guide.html` (HAVE)
- **See:** Full video/image table from §0 (screen size, duration, trailer, poster, banner)  
- **Tools:** Close / Download checklist PDF later

#### H03 — `WiamStudio-Series-Create.html` (HAVE)
- **See:** Wizard step 1 — Title, genres, synopsis, planned episode count (min 20 for first public), language  
- **Tools:** Save draft, Next  
- **Quality copy:** Planned count locks completeness gate

#### H04 — `WiamStudio-Series-Cover.html` (HAVE)
- **See:** Upload **Cover / Poster** (2:3), crop guide overlay, examples good/bad  
- **Tools:** Pick image, replace, Next  
- **Show specs:** 600×900 min, 1080×1620 preferred

#### H05 — `WiamStudio-Series-Banner.html` (HAVE)
- **See:** Optional hero / banner upload OR “Use trailer poster as hero” toggle  
- **Tools:** Upload / Use trailer frame, Next

#### H06 — `WiamStudio-Series-Trailer.html` (HAVE)
- **See:** Trailer upload zone, duration meter (15–60s), 9:16 preview frame, **QA status** (Pending / Pass / Fail + reasons)  
- **Tools:** Upload trailer, Replace, Run/Refresh QA, Preview  
- **Fail reasons examples:** wrong aspect, too long, too short, low resolution, black frames

#### H07 — `WiamStudio-Series-Dashboard.html` (HAVE)
- **See:** One series hub:  
  - Cover + title  
  - Progress: Uploaded X / Planned Y  
  - Trailer QA badge  
  - Soft interest meter (followers / Remind-me)  
  - Buttons: Episodes, Trailer, Cover, Submit for Live, Analytics (if live)  
- **Tools:** All section entries, Submit (disabled until hard gates green)

#### H08 — `WiamStudio-Episode-List.html` (HAVE)
- **See:** Ordered list EP1…EPN, each: thumb, duration, size check, transcode status (Processing / Ready / Failed), lock order  
- **Tools:** Add episode, reorder (if allowed before live), open episode, delete draft

#### H09 — `WiamStudio-Episode-Upload.html` (HAVE)
- **See:** Big drop/pick zone; **fixed spec callout box** (9:16 · 1080×1920 · 4–5 min · MP4); progress bar; reject screen if wrong aspect  
- **Tools:** Pick video, Cancel upload, Retry  
- **States:** Uploading · Processing · Ready · Rejected (wrong size)

#### H10 — `WiamStudio-Episode-Detail.html` (HAVE)
- **See:** Episode number, title, synopsis, duration read-only from file, custom thumb override, replace video  
- **Tools:** Save metadata, Replace video, Delete

#### H11 — `WiamStudio-Episode-Reject-Wrong-Size.html` (HAVE)
- **See:** Clear error: “Video must be 9:16. Yours was 16:9.” How to fix in CapCut/Premiere export settings  
- **Tools:** Re-upload, Specs guide

#### H12 — `WiamStudio-Completeness-Gate.html` (HAVE)
- **See:** Checklist: all planned eps Ready · trailer Pass · cover set · synopsis · rights  
- **Red items** block Submit  
- **Tools:** Fix links to each missing item

#### H13 — `WiamStudio-Soft-Interest.html`
- **See:** “Before public live: 50 followers OR 200 Remind-me on teaser”  
  - Current counts  
  - Button: Publish teaser trailer only (trailer public, series locked)  
- **Tools:** Publish teaser, Share teaser link, View public teaser page

#### H14 — `WiamStudio-Teaser-Public-Preview.html`
- **See:** What viewers see for Coming Soon teaser (trailer + Remind Me)  
- **Tools:** Share, Unpublish teaser

#### H15 — `WiamStudio-Submit-For-Live.html` (HAVE)
- **See:** Final confirm: quality summary, “Team reviews within 72h or auto if gates pass”, earnings note  
- **Tools:** Submit / Cancel

#### H16 — `WiamStudio-Submit-Pending.html` (HAVE)
- **See:** In review queue, countdown SLA, cannot edit published fields  
- **Tools:** Withdraw submission (if allowed)

#### H17 — `WiamStudio-Live-Success.html` (HAVE)
- **See:** Series is live, link to public page, tips to grow  
- **Tools:** View public, Studio home

#### H18 — `WiamStudio-Needs-Changes.html` (HAVE)
- **See:** Reviewer notes (audio, story, visual quality, rights)  
- **Tools:** Open items to fix, Resubmit

#### H19 — `WiamStudio-Analytics.html`
- **See:** Views, watch completion, unlocks, coins earned (after live)  
- **Tools:** Date range, series picker

#### H20 — `WiamStudio-Earnings.html`
- **See:** Balance, pending, paid out, link KYC/payout  
- **Tools:** Request payout (if eligible)

#### H21 — `WiamStudio-Payout-KYC.html`
- **See:** Identity / bank or Mobile Money fields  
- **Tools:** Submit KYC

#### H22 — `WiamStudio-Settings.html`
- **See:** Channel name, avatar, notifications for review status  
- **Tools:** Save

#### H23 — `WiamStudio-Help-Quality.html`
- **See:** Examples of accepted vs rejected trailers/episodes (stills), lighting/audio tips  
- **Tools:** Back

**Publishing tools Studio does NOT include (do not mock as editors):**
- Multi-track timeline NLE  
- Effects / transitions studio  
- In-app film cutting  

**Publishing tools Studio DOES include:**
- Cover, banner/hero, trailer upload + QA  
- Episode upload + processing status  
- Metadata, completeness checklist  
- Teaser publish, submit for live, analytics, earnings  

---

### I. Founder / Reviewer ops (web or app — mock as phone or desktop frames)
**⏭️ EXCLUDED FROM THIS MOCKUP PASS — by request. Not being built. Skip when handing to Cursor.**

#### I01 — `WiamEpisio-Founder-Apply-Queue.html`
- **See:** List of applications + sample preview  
- **Tools:** Accept / Reject + reason

#### I02 — `WiamEpisio-Founder-Review-Queue.html`
- **See:** Series waiting for live; SLA timer; quality checklist  
- **Tools:** Approve live / Request changes / Reject

#### I03 — `WiamEpisio-Founder-Series-Inspect.html`
- **See:** Watch trailer, spot-check episodes, cover, planned vs uploaded  
- **Tools:** Approve / Changes

#### I04 — `WiamEpisio-Founder-Featured-Trailers.html`
- **See:** Curate Home hero trailers  
- **Tools:** Add/remove/reorder slots

#### I05 — `WiamEpisio-Founder-Flags.html`
- **See:** Trailer QA gate ON/OFF, require complete series ON/OFF, VIP flag, coin bands  
- **Tools:** Toggles, save

#### I06 — `WiamEpisio-Founder-Unpublish.html`
- **See:** Confirm unpublish + reason to creator  
- **Tools:** Confirm

#### I07 — `WiamEpisio-Founder-Origin-Rights.html`
- **See:** Mark series Origin / VIP; rights notes  
- **Tools:** Save

---

### J. System / edge / trust

#### J01 — `WiamEpisio-Offline.html`
- **See:** No network  
- **Tools:** Retry

#### J02 — `WiamEpisio-Force-Update.html`
- **See:** Must update app  
- **Tools:** Store link

#### J03 — `WiamEpisio-Maintenance.html`
- **See:** Down for maintenance

#### J04 — `WiamEpisio-Report-Content.html`
- **See:** Report reasons (spam, copyright, sexual, violence)  
- **Tools:** Submit

#### J05 — `WiamEpisio-Block-Creator.html`
- **See:** Confirm block  
- **Tools:** Confirm

#### J06 — `WiamEpisio-Account-Delete.html`
- **See:** Warning, confirm delete  
- **Tools:** Delete / Cancel

#### J07 — `WiamEpisio-Device-Limit.html`
- **See:** Too many devices / login blocked message

#### J08 — `WiamEpisio-Empty-Catalog.html`
- **See:** Honest empty Home when no series yet (launch day)

---

### K. Modals / toasts (small but design them)

| # | File | What user sees |
|---|------|----------------|
| K01 | `WiamEpisio-Toast-Success.html` | Gold check toast |
| K02 | `WiamEpisio-Toast-Error.html` | Error toast |
| K03 | `WiamEpisio-Confirm-Dialog.html` | Generic yes/no |
| K04 | `WiamEpisio-Coin-Spend-Confirm.html` | “Spend X coins?” |
| K05 | `WiamEpisio-Follow-Success.html` | Followed creator |
| K06 | `WiamEpisio-Remind-Set.html` | Reminder set |
| K07 | `WiamEpisio-Login-Required-Sheet.html` | Soft wall to auth |
| K08 | `WiamEpisio-Quality-Rejected-Banner.html` | Inline Studio banner |

---

## 4. Count summary (for your mockup sprint)

| Group | Approx. screens / states |
|-------|---------------------------|
| A Boot / onboarding | 5 |
| B Auth | 6 |
| C Main viewer tabs + settings | ~22 |
| D Series / player / unlock | ~14 |
| E Coins / VIP | 7 |
| F Novel hub | 3 |
| G Creator apply | 8 |
| H WiamStudio | **23** (design these carefully) |
| I Founder / review | 7 |
| J System / trust | 8 |
| K Modals | 8 |
| Already HAVE (overlap) | 19 |
| **Target unique mockups to produce** | **~90–110** including HAVE refinements + new |

You do not need 100 empty names — you need **every real surface above**. Studio alone is ~23 serious screens.

---

## 5. Mockup priorities (what to design first)

**P0 — Viewer money path**  
Home, Series detail, Trailer, Player, Unlock, Buy coins, Register, Profile, My List  

**P0 — Quality creator path**  
Apply (all steps), Studio Home, Specs guide, Cover, Trailer+QA, Episode upload + wrong-size reject, Completeness gate, Soft interest, Submit for live, Pending, Needs changes, Live success  

**P1**  
Rankings, Categories, Search, Notifications, Settings, Founder queues, Analytics, Earnings/KYC  

**P2**  
Novel hub, Comments, Daily rewards polish, VIP checkout polish  

---

## 6. What to put inside WiamStudio (checklist for designers)

When you open **WiamStudio**, the product must *look* like a serious publisher console:

1. **Series identity** — title, synopsis, genres, planned episode count  
2. **Cover / poster** — 2:3 upload + guides  
3. **Banner / hero** — trailer poster or optional banner  
4. **Trailer** — upload, 9:16 preview, QA pass/fail reasons  
5. **Episodes** — upload list, duration, processing, wrong-size errors  
6. **Specs always visible** — 9:16, 1080×1920, 4–5 min  
7. **Completeness** — X/Y ready before Submit enables  
8. **Soft interest** — followers / Remind-me meters + teaser publish  
9. **Submit / review states** — pending, changes, live  
10. **Earnings** — only after live (empty state before)  
11. **No fake NLE** — no timeline editor screens  

---

## 7. After you finish mockups

1. Drop new HTML into `WiamAppMobile/WiamEpisio Some Of The Screens/` (or a new `Mockups-Full/` folder).  
2. Tell the agent: **mockups ready — write master E2E blueprint then build**.  
3. Blueprint will map each file → route → API → acceptance test (“every tap works”).

---

## 8. Quality reminder (Martin lock)

- Soft interest without quality = **still blocked**.  
- Wrong screen size = **reject upload**, show fix screen.  
- Incomplete series = **cannot submit for live**.  
- Trailer QA fail = **cannot go live**.  
- This is how we stay Netflix-serious without YouTube chaos.

---

*Document version: 2026-07-17 — Mockup inventory for WiamEpisio E2E design sprint.*
