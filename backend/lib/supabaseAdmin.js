// © 2026 WiamApp. Powered by WiamLabs
// backend/lib/supabaseAdmin.js
// Uses the SECRET key — only used server-side on Render, NEVER in the app

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SECRET_KEY in Render environment variables.'
  );
}

// This client bypasses RLS — only use for admin/server operations.
// This backend never subscribes to realtime channels, but Supabase's
// client still initializes its RealtimeClient eagerly on creation —
// on Node 20 (no native WebSocket, that lands in Node 22) it throws
// unless an explicit transport is provided. `ws` supplies that.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
});

// Verify a user's JWT token from the mobile app
export async function verifyUserToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header.');
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error('Invalid or expired token.');
  return user;
}
