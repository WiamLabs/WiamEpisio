-- © 2026 WiamApp. Powered by WiamLabs
-- Country availability for Master God Mode (Studio Countries panel).

CREATE TABLE IF NOT EXISTS public.platform_country_settings (
  id              TEXT PRIMARY KEY DEFAULT 'global',
  country_mode    TEXT NOT NULL DEFAULT 'ALL'
                    CHECK (country_mode IN ('ALL', 'ALLOWLIST')),
  open_countries  TEXT[] NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_country_settings (id, country_mode, open_countries)
VALUES ('global', 'ALL', '{}')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_country_settings ENABLE ROW LEVEL SECURITY;
-- Service role only (backend / Studio proxy).
