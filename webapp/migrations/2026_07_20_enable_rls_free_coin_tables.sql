-- Enable RLS on free-coin / genre tables flagged by Supabase advisor (2026-07-20).
-- Flask uses the DB owner connection (bypasses RLS). PostgREST gets no policies → no direct access.
-- Run in Supabase SQL Editor (project evwxgyiadhdsorqcpptc).

BEGIN;

ALTER TABLE IF EXISTS public.w_watch_episode_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_ad_coin_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_series_finish_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_friend_invite_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.w_genre_requests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'w_watch_episode_rewards',
    'w_ad_coin_claims',
    'w_series_finish_rewards',
    'w_friend_invite_bonuses',
    'w_genre_requests'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

COMMIT;
