# WIAMEPISIO — PHASE 1 EXECUTION ORDER
## Clearing the Blockers, Connecting the Engines
**This document is a direct instruction to whoever is coding this (Cursor or any other agent). It is not a suggestion. Read it fully before writing a single line of code.**

**Prepared for:** Martin Wiafe, Founder & CEO, WiamLabs
**Status:** MANDATORY — supersedes any conflicting instruction given earlier in this project

---

## 0. WHY THIS DOCUMENT EXISTS

Cursor has already been told once to stop building on the old WiamApp Book/Chapter/Reader screens and it did not fully comply — it kept reusing old novel-reading UI for what is supposed to be a video drama platform. **This must stop completely, starting now.**

Martin is investing real money into this build. This is not a practice project, not a demo, not an experiment. Every hour spent rebuilding the wrong screen, or half-fixing an old one instead of replacing it, is money and time that does not come back. If you are an AI coding agent reading this: treat every instruction below as a hard constraint, not a style preference.

---

## 1. THE CORE RULE — READ THIS TWICE

**WiamEpisio is a NEW product living inside an OLD, proven backend engine.**

- The **engine** (auth, wallet, coins, notifications, moderation, creator payouts, RBAC) is REUSED. It already works. Do not rebuild it. Do not touch its core logic.
- The **product on top of the engine** (every screen, every content model, every user-facing word) is being REPLACED. Not edited. Not patched. **Replaced.**

Think of it like this: you are keeping the engine and the chassis of a car, but building an entirely new body, new dashboard, new seats, new steering wheel on top of it. You do not sand down the old dashboard and hope it looks different — you remove it and install the new one.

---

## 2. ZERO-PLACEHOLDER RULE (NON-NEGOTIABLE)

No screen in this build ships with:
- Fake sample data hard-coded into the component
- "TODO" comments left in place of real logic
- A UI that looks finished but isn't wired to a real database table or real API route
- A button that does nothing when tapped
- Text that says "Coming soon" as a substitute for a feature that was actually planned for this phase

**If a screen cannot be fully wired to real data in this phase, it does not ship in this phase.** It gets flagged back to Martin, not shipped half-working. A half-working screen is worse than no screen, because it hides the gap instead of surfacing it.

---

## 3. WHAT GETS ARCHIVED FROM ACTIVE NAVIGATION (NEVER DELETED)

**Hard rule: no screen file, component, or route gets deleted from the codebase during this phase. Ever. Not one.** Old novel-reading screens are moved out of the *active user-facing navigation* and into an archived location, kept fully intact, because they may power a future "Text Edition" reading feature — a small, optional way for users to still read a story as text alongside watching it as video. Martin has not decided the final shape of that feature yet, so nothing gets thrown away in the meantime.

**Action required, precisely:**
- Create a clearly-named archive location (e.g. `src/screens/_legacy_text_edition/` in Expo, and an equivalent grouped folder on the web side) and **move** — not delete, not rewrite — the following screens and their supporting components into it: `Home` (novel rails), `Browse` (novel genres), `BookDetail`, `Reader` (chapter text reader), `Library` (novel reading list), `StudioDashboard`, `NewStory`, `ChapterEditor`, `StoryManager`, `Classics`, `OfflineReading`, `ReaderStats`, `ReadingStreaks`, `ReadingListDetail`
- Remove these from the **active navigation stack only** — the tab bar, drawer, and any route a normal user can currently reach — so the new WiamEpisio experience is what users actually see
- Leave a short comment at the top of each archived file noting it was parked on this date, pending a possible future Text Edition feature, so nobody mistakes it for dead code to clean up later
- `SeriesDetail` (old meaning: books-in-a-series) is a special case — its *name* is retired per §4 below since the word "Series" is being reclaimed, but the underlying screen/logic is archived the same way as everything else in this list, not deleted

**If you catch yourself deleting a file, or editing one of the files above to "make it work for video" instead of archiving it and building a new file — stop. Both are exactly the mistake this document exists to prevent.**

---

## 4. THE NAMING COLLISION — RESOLVED NOW, NOT LATER

This was flagged in the audit as a blocking decision. It is now decided. No more ambiguity:

| Old word | Old meaning | New rule |
|---|---|---|
| `Series` (today = `w_series`, an ordered list of books) | Book collection | **Renamed to `StoryCollection` in code and database.** The word "Series" is retired from meaning "book list" everywhere in the codebase, permanently. |
| `Series` (new meaning) | A drama show made of episodes | **This is the ONLY thing "Series" means going forward, in code, in database tables, in UI copy, in variable names.** |
| `Chapter` | Text reading unit | Stays for the parked Text Edition only. Never appears in new video-facing code. |
| `Episode` | Was just a label on a text chapter | **Becomes its own real database table** — a video content unit with its own video file, duration, thumbnail, unlock position, and publish state. |
| `Book` | Primary content type | Retired from all new screens and new routes. Still exists in database for legacy Text Edition, never referenced in new WiamEpisio code paths. |

**Rule for the build:** if you are writing a new table, route, or screen and you are tempted to use the word "Series" to mean anything other than a drama show — stop and use `StoryCollection` instead. This is permanent product law from this point forward, per the original blueprint's Part 22 governance rule.

---

## 5. WHAT STAYS UNTOUCHED IN THE DATABASE (do not drop tables)

Nothing gets deleted at the database level. Old tables (`w_series`/now `StoryCollection`, `Chapter`, `ReadingProgress`, etc.) stay in the schema, powering the parked Text Edition, invisible to new users unless they specifically opt into "Text Edition." This protects existing content and existing SEO value. **Never write a migration that drops these tables.** Only new tables get added alongside them.

---

## 6. THE NEW ENGINE PARTS BEING BUILT (net-new, no shortcuts)

These do not exist yet and must be built for real, not mocked:

1. **`Series` table** (new meaning, per §4) — title, synopsis, poster, trailer, genre, creator, status
2. **`Episode` table** — belongs to a Series, has video file reference, duration, episode number, thumbnail, free/locked status, publish state
3. **`WatchProgress` table** — mirrors the pattern of the old `ReadingProgress`, but tracks video position per user per episode
4. **`EpisodeUnlock` table** — mirrors `ChapterUnlock` economics exactly (same coin-spend logic, same free-first-5 rule), just pointed at episodes instead of chapters
5. **Video storage + CDN integration** — this is a real infrastructure decision (Cloudflare Stream is the recommended default from the original blueprint Part 6.2) — not a "put a video tag on the page" shortcut
6. **Upload/transcode pipeline** — creators upload raw video, it gets transcoded and delivered via CDN; this must run asynchronously, never blocking the upload request
7. **Vertical video player** — with autoplay-next-episode, resume-from-last-position, and the same unlock gate logic as the old chapter-unlock gate

**Every one of these must be wired end-to-end — upload → transcode → store → stream → play → track progress → unlock — before that feature is considered done. A player that plays a hard-coded test video is not done. An upload button that doesn't actually transcode and store the file is not done.**

---

## 7. HOW THE NEW ENGINE CONNECTS TO THE OLD ENGINE (reuse map — do not rebuild these)

| Old engine part | Stays exactly as-is | Connects to new video system by |
|---|---|---|
| User accounts, login, JWT auth | Unchanged | Every new video screen uses the same auth session, no new auth system |
| CoinBalance, coin packages, Paystack/IAP purchase | Unchanged | `EpisodeUnlock` spends coins from the same wallet as chapter unlocks did |
| Wallet, refunds, fraud scoring | Unchanged | Applies identically to coin spend on episodes |
| Notifications + push | Unchanged | New event types added: "new episode," "episode unlocked," not a new notification system |
| Follow / Followers | Unchanged | Following a creator now surfaces new Series instead of new books |
| Creator payouts / revenue share | Unchanged | Same payout pipeline, now credited from episode unlocks instead of chapter unlocks |
| Moderation / reports / banned words | Unchanged | Extended to cover video/thumbnail moderation, not rebuilt |
| RBAC / admin / founder tools | Unchanged | Extended later to manage Series/Episodes, not rebuilt now |

**If you find yourself building a second wallet, a second notification system, or a second auth flow "just for video" — stop. That is duplicate work and it is explicitly forbidden.**

---

## 8. DESIGN SYSTEM — SAME BRAND AS WIAMAPP'S SERVICE PLATFORM

WiamEpisio uses the exact same locked brand system already defined for WiamApp's service marketplace screens (Part 13 of that project): Navy `#08081A` background, Gold `#D4A017` primary color, same typography (Inter), same component patterns (circular avatars, status pills, card radius, spacing rhythm). Full design specs for the actual WiamEpisio screens will follow in a separate document — **do not start designing or coding screens until that document is delivered.** This document is about clearing blockers and connecting engines first. Screens come after.

**Do not copy DramaBox's black-and-hot-pink visual style.** Their UX structure (trailer-first feed, membership screen layout, episode gating pattern) is a useful reference for *layout logic*, never for visual identity. WiamEpisio looks like WiamLabs, not like DramaBox.

---

## 9. ORDER OF OPERATIONS — DO NOT SKIP AHEAD

1. Rename `Series` → `StoryCollection` in database + code (§4) — nothing else starts until this is done, since every other table/route decision depends on the word "Series" being unambiguous
2. Build the new `Series`, `Episode`, `WatchProgress`, `EpisodeUnlock` tables (§6)
3. Choose and integrate the video vendor (Cloudflare Stream recommended) — confirm with Martin before signing any contract
4. Build the upload → transcode → store → stream pipeline end-to-end, test with one real video file before building any UI on top of it
5. Remove old screens from navigation (§3) — do this only once the new screens exist to replace them, never leave users with a broken nav
6. Build new screens per the design spec (coming in the next document)
7. Wire coin/wallet/notification/follow/payout connections (§7) — verify each one with a real test transaction, not a mock

---

## 10. FINAL WORD TO CURSOR

Martin has said this directly and it must be respected: **he cannot afford to spend money on something that doesn't produce real results.** That means no shortcuts that look done but aren't, no reusing old screens because it's faster, no placeholders anywhere. If something in this document is unclear or conflicts with something else in the codebase, stop and ask — do not guess and proceed. A wrong guess here costs real money.

---

*Prepared by WiaM, Executive Manager to Martin Wiafe — WiamLabs*
