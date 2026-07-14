-- © 2026 WiamApp. Powered by WiamLabs
-- One-time Founder Studio login codes (Telegram → studio.wiamlabs.com/founder/enter)

CREATE TABLE IF NOT EXISTS founder_web_login_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT UNIQUE NOT NULL,
  telegram_id TEXT NOT NULL,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_founder_web_login_expires
  ON founder_web_login_tokens (expires_at);

ALTER TABLE founder_web_login_tokens ENABLE ROW LEVEL SECURITY;
