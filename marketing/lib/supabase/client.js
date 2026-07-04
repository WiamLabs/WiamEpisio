// © 2026 WiamApp. Powered by WiamLabs
// lib/supabase/client.js — browser/client-component Supabase client
// (mirrors business-web/lib/supabase/client.js)

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
