-- ============================================================
-- WIAMAPP MIGRATION 031 — Rankings Restore, Spotlight Schema Fix,
-- Business Profile & Team Fields
-- © 2026 WiamApp. Powered by WiamLabs
--
-- WHY THIS IS NEEDED: a fresh sweep of every backend route found
-- three more live-breaking gaps beyond the badge/billing ones in
-- migrations 028-030:
--   1. performance_rankings (WorkerRankingsScreen's leaderboard)
--      does not exist live at all.
--   2. spotlight_posts exists live, but with a much smaller shape
--      than backend/routes/spotlight.js actually needs — missing
--      category, title, media array, moderation status, boost
--      flag, and view count. worker_profile_id is also NOT NULL,
--      which makes a Business Spotlight post structurally
--      impossible even though Section 21's web portal plan
--      explicitly includes BusinessSpotlightWebPage.
--   3. business_profiles/business_team_members are missing fields
--      the real BusinessApplicationScreen and the new "hide from
--      public search" team feature (Section 17B) need.
-- ============================================================

-- ============================================================
-- PART 1 — RESTORE performance_rankings
-- ============================================================
CREATE TABLE IF NOT EXISTS performance_rankings (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id       UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id),
  city            VARCHAR(100),
  rank_type       VARCHAR(50) CHECK (
    rank_type IN ('top_rated','fastest_responder','most_jobs_month',
                  'highest_trust','most_repeat_customers')
  ),
  rank_position   INT NOT NULL,
  score           DECIMAL(10,4),
  calculated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, category_id, rank_type)
);

CREATE INDEX IF NOT EXISTS idx_rankings_category ON performance_rankings(category_id, rank_type);

ALTER TABLE performance_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rankings_read_all"
  ON performance_rankings FOR SELECT USING (true);
-- Read-only for everyone — rankings are always public. Written
-- only by the backend's nightly ranking calculation job.

-- ============================================================
-- PART 2 — FIX spotlight_posts TO MATCH WHAT THE APP ACTUALLY NEEDS
-- ============================================================
ALTER TABLE spotlight_posts ADD COLUMN IF NOT EXISTS author_id      UUID REFERENCES users(id);
ALTER TABLE spotlight_posts ADD COLUMN IF NOT EXISTS business_id    UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE spotlight_posts ADD COLUMN IF NOT EXISTS category_id    UUID REFERENCES categories(id);
ALTER TABLE spotlight_posts ADD COLUMN IF NOT EXISTS title          VARCHAR(150);
ALTER TABLE spotlight_posts ADD COLUMN IF NOT EXISTS description    TEXT;
ALTER TABLE spotlight_posts ADD COLUMN IF NOT EXISTS media_urls     TEXT[];
ALTER TABLE spotlight_posts ADD COLUMN IF NOT EXISTS post_type      VARCHAR(20) DEFAULT 'portfolio';
ALTER TABLE spotlight_posts ADD COLUMN IF NOT EXISTS status         VARCHAR(20) DEFAULT 'pending_review'
  CHECK (status IN ('pending_review','approved','rejected'));
ALTER TABLE spotlight_posts ADD COLUMN IF NOT EXISTS is_boosted     BOOLEAN DEFAULT FALSE;
ALTER TABLE spotlight_posts ADD COLUMN IF NOT EXISTS views_count    INT DEFAULT 0;

-- A post must belong to EITHER a worker OR a business, never
-- neither and never (in practice) both — so worker_profile_id can
-- no longer be NOT NULL. Business Spotlight (Section 21, All
-- Tiers) was structurally impossible until this.
ALTER TABLE spotlight_posts ALTER COLUMN worker_profile_id DROP NOT NULL;
ALTER TABLE spotlight_posts ADD CONSTRAINT spotlight_one_owner_only
  CHECK (
    (worker_profile_id IS NOT NULL AND business_id IS NULL) OR
    (worker_profile_id IS NULL AND business_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_spotlight_status   ON spotlight_posts(status);
CREATE INDEX IF NOT EXISTS idx_spotlight_business ON spotlight_posts(business_id);

-- The live read policy only ever checked is_active — it never
-- accounted for the moderation workflow the route code already
-- implements (new posts start as pending_review and need an admin
-- to approve them before anyone but the author can see them).
DROP POLICY IF EXISTS "spotlight_read_active" ON spotlight_posts;
CREATE POLICY "spotlight_read_approved"
  ON spotlight_posts FOR SELECT USING (status = 'approved' AND is_active = true);

-- The existing "manage own" policy only covered worker ownership.
-- Add the business-side equivalent so a Business account can
-- manage (and privately preview, pre-approval) its own posts too.
CREATE POLICY "spotlight_manage_own_business"
  ON spotlight_posts FOR ALL
  USING (auth.uid() = (
    SELECT user_id FROM business_profiles WHERE id = business_id
  ));

-- A poster (worker or business) must always be able to see their
-- OWN pending/rejected posts, not just approved ones — the existing
-- "manage own" ALL policy already covers this for both, since FOR
-- ALL includes SELECT.

-- ============================================================
-- PART 3 — BUSINESS APPLICATION FIELDS (matches the real screen)
-- ============================================================
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS contact_name        TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS contact_phone       TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS requested_team_size INT;

-- ============================================================
-- PART 4 — "HIDE FROM PUBLIC SEARCH" TEAM TOGGLE (Section 17B)
-- ============================================================
ALTER TABLE business_team_members ADD COLUMN IF NOT EXISTS is_hidden_from_search BOOLEAN DEFAULT FALSE;

-- ============================================================
-- PART 5 — increment_spotlight_views RPC (route already calls it)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_spotlight_views(post_ids UUID[])
RETURNS void AS $$
BEGIN
  UPDATE spotlight_posts
  SET views_count = views_count + 1
  WHERE id = ANY(post_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 6 — USER BLOCKING (Section 21B settings expansion)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_blocks (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  blocker_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_blocks_manage_own"
  ON user_blocks FOR ALL USING (auth.uid() = blocker_id);
-- A user can only ever see/create/remove blocks where THEY are the
-- blocker. Nobody can see who has blocked them — that information
-- staying private is the whole point of the feature.

-- ============================================================
-- PART 7 — DATA EXPORT REQUESTS (Section 21B settings expansion)
-- ============================================================
CREATE TABLE IF NOT EXISTS data_export_requests (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by UUID REFERENCES users(id)
);

ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data_export_read_own"
  ON data_export_requests FOR SELECT USING (auth.uid() = user_id);
-- Backend service role writes only.

-- ============================================================
-- ✅ DONE — Migration 031 applied
-- ============================================================
