---
name: Social identity community
overview: Document how usernames and mention plumbing work today versus gaps; recommend phased community surfaces (beyond Bulletin and in-reader threads); decide phone capture now vs gated with SMS later—with privacy and moderation implications.
todos:
  - id: mentions-parse-notify
    content: Parse @username in /reader/comment (and replies); resolve User; notify_mention + tests + caps
    status: pending
  - id: mentions-mobile-ux
    content: "ReaderScreen composer: suggestion list or picker; tap mention opens profile/deep link"
    status: pending
  - id: discussion-discovery
    content: "Low-risk discovery: trending/active threads per book (read API + UI rail)"
    status: pending
  - id: book-discussion-hub
    content: "Phase M3 optional: Discussion tab / threads model + moderation hooks"
    status: pending
  - id: phone-optional-policy
    content: Optional phone in profile/settings + Privacy/Data safety copy; defer verified flag until SMS
    status: pending
  - id: doc-social-plan
    content: Add docs/WiamApp_social_identity_and_community_plan.md and AGENT_MEMORY link on execution
    status: pending
isProject: false
---

# Username, mentions, tags, community, and phone — WiamApp plan

## How it works today (repo-backed)

### Usernames

- Stored on [`users.username`](webapp/models.py) (unique text, nullable). Used in JWT user payloads (`/auth/*`, `_user_json`) and surfaced in [`BulletinScreen`](WiamAppMobile/src/screens/main/BulletinScreen.js) as `@creator.username`.
- Mobile registration validates via [`api_v1.py`](webapp/routes/api_v1.py): `_USERNAME_RE`, `_normalize_username`, availability checks, suggestion flow. Google signup generates a derived unique handle.
- **Profile / discovery**: Other screens can show `@username`; treat **handle** as the stable **social identity** alongside `wiam_id` for APIs.

### Mentions (“@…”)

- **User preference** exists: `users.notif_mentions`, mapped in [`/api/v1/settings`](webapp/routes/api_v1.py) and toggle in [`ProfileScreen.js`](WiamAppMobile/src/screens/main/ProfileScreen.js).
- **Notification plumbing** exists: [`notify_mention`](webapp/services/notifications.py) creates `Notification` type `mention` + push routing in [`pushNotifications.js`](WiamAppMobile/src/services/pushNotifications.js); [`NotificationsScreen.js`](WiamAppMobile/src/screens/main/NotificationsScreen.js) handles `mention` type.
- **Gap:** Paragraph/chapter [`POST /reader/comment`](webapp/routes/api_v1.py) flow **does not** appear to **parse `@username` / `@[handle]` from comment text** to resolve users and call `notify_mention`. So mentions are **prepared**, not **end-to-end**. No dedicated “tags” hashtag model was found—**genre** is book metadata, not reader-generated `#tags` on posts.

### Where readers “meet and talk” today

| Surface | Who speaks | Anchor | Reader–reader chat? |
|--------|-------------|--------|---------------------|
| **Bulletin Feed** ([`bulletin.py`](webapp/routes/bulletin.py), mobile [`BulletinScreen.js`](WiamAppMobile/src/screens/main/BulletinScreen.js)) | **Creators** post; readers **react with emojis** only | Creator channel + optional book_share | **No** free-form reader threads |
| **In-reader discussion** ([`POST /reader/comment`](webapp/routes/api_v1.py), [`ReaderScreen.js`](WiamAppMobile/src/screens/content/ReaderScreen.js) paragraph thread) | Any authenticated user comments / replies | **Book + chapter + paragraph** | **Yes**, but **only in context of that story** |

There is **no** general-purpose lobby, book club forum, or DMs layer in these paths—a **Discord** entry on landing is explicitly “coming soon,” not in-app realtime.

---

## Recommendation: should WiamApp add “places to talk about books”?

**Yes, but phased**—because open social feeds explode **moderation, safety, spam, and legal** cost faster than Bulletin-style broadcast.

Suggested strategy:

1. **Short term (high leverage, lower risk)**  
   - **Ship real @mentions** in paragraph/book comments—reuses existing notification stack.  
   - Improve **discovery of active discussions** (e.g. “trending threads” per book—can be purely read-model).  
   - Keep **Bulletin** as creator-to-audience; avoid turning it into public reader chat overnight.

2. **Medium term (structured community)**  
   - Add **book-scoped forums** (“Discussion” tab on book detail) backed by existing comment model **or** a thin `DiscussionThread` table if you want separation from paragraph comments.  
   - Optionally **moderation queue** reuse (reports already exist elsewhere in product narrative).

3. **Long term (high cost)**  
   - Cross-book **clubs**, realtime chat, off-platform bridging—only after trust/safety tooling and staffing are real.

---

## Recommendation: phone number — now vs SMS later

**Data model**: [`users.phone`](webapp/models.py) already exists.

**Recommendation**

- **Now (optional capture):** Allow **optional** phone in profile/onboarding **if** Privacy Policy + Data Safety say what it is used for (support, optional recovery)—**do not claim SMS login** until infra exists.  
- **SMS verification gate:** Turn on **verification** (`phone_verified` column + OTP flow provider) **only when** you are ready for **budget + deliverability + abuse handling** (rate limits, disposable numbers, retry costs). Repo shows phone switch UX without real SMS ([`auth.py`](webapp/auth.py) comment: no SMS cost).  
- **Risk of “collect now”: low** if optional and transparent; **risk of “require now”**: drop-off at signup/regions without reliable SMS.

**If Boss wants one rule:** collect **optional** phone early for **support continuity**; add **OTP verification** later as a **distinct phase** tied to SMS provider and cost.

---

## Implementation phases (when you execute, not now)

### Phase M1 — Mentions E2E

- Server: extract `@mentions` from comment body (reuse `_USERNAME_RE` rules); resolve to `User` by `username`; exclude self/creator duplication rules; rate-limit; call `notify_mention` per unique mention; cap mentions per comment.  
- Client: autocomplete / pick handle (optional UX); tap mention → navigate to profile.  
- Privacy: respect `privacy_profile_visible` / block list if you add blocks later.

### Phase M2 — Tags (optional product choice)

- If you mean **social hashtags**, add `DiscussionTag` / join table—not reuse genre alone. If you mean **browse by genre**, already separate.

### Phase M3 — Structured book discussion hub

- Book detail tab; optional thread list; moderation + report integration.

### Phase M4 — Phone

- Optional field + formatting validation; encrypt-at-rest policy if warranted; **`phone_verified`** when SMS ships.

---

## Deliverable on execution

- New doc [`docs/WiamApp_social_identity_and_community_plan.md`](docs/WiamApp_social_identity_and_community_plan.md) (copy this plan + decision log).  
- Link from [`docs/AGENT_MEMORY.md`](docs/AGENT_MEMORY.md) when work starts.

---

## Open product choice (Boss)

- Confirms **mentions first** vs **forum tab first**.  
- Confirms phone: **optional only** vs **required**—strongly advise optional until SMS.
