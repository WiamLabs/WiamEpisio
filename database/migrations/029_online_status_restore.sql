-- ============================================================
-- WIAMAPP MIGRATION 029 — Restore user_online_status
-- © 2026 WiamApp. Powered by WiamLabs
--
-- WHY THIS IS NEEDED: backend/routes/online.js (heartbeat, offline,
-- status endpoints) and Section 15 of the Master Plan (Online
-- Status System) both already assume this table exists. It was
-- defined in the older migrations/007_to_015.sql but was dropped
-- when WIAMAPP_DATABASE_SETUP_V4.sql did its clean-slate rebuild.
-- Right now, every call to /api/online/heartbeat, /offline, or
-- /status fails live with "relation does not exist" against the
-- real database. This restores it exactly as the route code
-- already expects, no application code changes needed for this
-- part.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_online_status (
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  is_online      BOOLEAN DEFAULT false,
  last_seen_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_online_status ENABLE ROW LEVEL SECURITY;

-- Anyone can read online status (needed to show green/amber dots
-- on other people's profiles in search/category/chat screens) —
-- this is not sensitive data, matching Section 15's design intent.
CREATE POLICY "online_status_read_all"
  ON user_online_status FOR SELECT USING (true);

-- A user can only ever write their OWN online status row.
CREATE POLICY "online_status_write_own"
  ON user_online_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "online_status_update_own"
  ON user_online_status FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- ✅ DONE — Migration 029 applied
-- ============================================================
