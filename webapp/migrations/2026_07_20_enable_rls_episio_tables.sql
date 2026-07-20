-- Enable RLS on Episio / public tables flagged by Supabase advisor.
-- Flask uses the DB owner / service connection (bypasses RLS).
-- PostgREST anon/authenticated get no policies → no direct table access.
-- Run in Supabase SQL Editor (project evwxgyiadhdsorqcpptc).

BEGIN;

ALTER TABLE IF EXISTS public.w_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_book_popularity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_universes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_story_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_story_bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_studio_pro_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_creator_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_episode_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_creator_video_upload_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_trailer_quality_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_coin_price_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_series_ranking_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_episio_creator_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_series_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_series_revision_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_content_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_season_quality_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_season_asset_quality_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_episio_creator_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_episio_creator_invite_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_episio_creator_public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_series_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_featured_trailer_slots ENABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders: revoke direct API grants if present (Flask still uses owner role).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'w_analytics_events','w_book_popularity','w_universes','w_story_bundles','w_arcs',
    'w_story_bundle_items','w_studio_pro_subscriptions','w_creator_settings','w_ai_suggestions',
    'w_episodes','w_watch_progress','w_episode_unlocks','w_video_assets','w_creator_video_upload_jobs',
    'w_trailer_quality_reports','w_coin_price_bands','w_fx_rates','w_series_ranking_snapshots',
    'w_episio_creator_applications','w_series_reminders','w_series_revision_requests',
    'w_content_fingerprints','w_season_quality_jobs','w_season_asset_quality_reports',
    'w_episio_creator_invites','w_episio_creator_invite_redemptions','w_episio_creator_public_profiles',
    'w_series_comments','w_featured_trailer_slots'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

COMMIT;
