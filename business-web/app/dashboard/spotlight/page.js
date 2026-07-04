// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/spotlight/page.js

import { createClient } from '@/lib/supabase/server';
import SpotlightManager from '@/components/SpotlightManager';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default async function SpotlightPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  let posts = [];
  try {
    const res = await fetch(`${BACKEND_URL}/api/spotlight/mine`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
      cache: 'no-store',
    });
    const json = await res.json();
    if (json.success) posts = json.data || [];
  } catch {
    // Backend may be cold-starting on Render's free tier — the
    // client component still renders with an empty list rather
    // than crashing the whole page.
  }

  return <SpotlightManager initialPosts={posts} />;
}
