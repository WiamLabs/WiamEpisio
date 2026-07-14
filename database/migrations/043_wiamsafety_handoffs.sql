-- © 2026 WiamApp. Powered by WiamLabs
-- WiamSafety Section 9 — single-use handoff tokens (product side).
-- Run in Supabase SQL Editor. Does not touch WiamSafety Core DB.

CREATE TABLE IF NOT EXISTS public.wiamsafety_handoffs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash      TEXT NOT NULL UNIQUE,
  reference_id    TEXT NOT NULL,
  product_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  consumed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wiamsafety_handoffs_reference
  ON public.wiamsafety_handoffs (reference_id);

CREATE INDEX IF NOT EXISTS idx_wiamsafety_handoffs_user
  ON public.wiamsafety_handoffs (product_user_id);

ALTER TABLE public.wiamsafety_handoffs ENABLE ROW LEVEL SECURITY;
-- No client policies — service role only (backend).

COMMENT ON TABLE public.wiamsafety_handoffs IS
  'WiamSafety recovery handoff tokens consumed by POST /api/wiamsafety/recovery';
