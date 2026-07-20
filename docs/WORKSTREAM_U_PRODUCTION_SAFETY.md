# Workstream U — Production safety pack (the six)

User instruction: **add all six, drop none.** This file mirrors the Cursor plan so the repo has a versioned copy.

1. **DB snapshot before Push 7** — operational checklist: [STUDIO_V2_QA.md](STUDIO_V2_QA.md) **§0 Database safety** — manual Supabase backup / export before `flask migrate-studio-v2` or large ALTER batches. **$0.**

2. **Scheduled-publish notifications**
   - **Followers:** `publish_due_now` calls `notify_new_chapter` (`webapp/routes/studio_v2_api.py`).
   - **Creator:** `notify_creator_scheduled_chapter_live` in `webapp/services/notifications.py` — in-app notification + Expo push `type=scheduled_publish`, respects `CreatorSettings.notif_scheduled_publish`. Mobile: `WiamAppMobile/src/services/pushNotifications.js`.

3. **Founder Pro seed** — `webapp/__init__.py` boot path ensures every `role='founder'` user has an active `StudioProSubscription` row (no payment). **$0.**

4. **First-time Studio V2 tour** — `WiamAppMobile/src/screens/studio/v2/StudioTourModal.js` + `has_seen_v2_tour` on `CreatorSettings`; replay from Studio Settings.

5. **Search V2** — `GET /api/v1/search/v2?q=` in `webapp/routes/studio_v2_api.py` returns `books`, `universes`, `series`. Mobile uses this for “search everywhere”; plain `/search` remains books-only per blueprint comment.

6. **Beta gate** — `CreatorSettings.beta_studio_v2` + Settings toggle + founder path; see `WiamAppMobile/src/screens/studio/v2/StudioSettingsScreen.js`.
