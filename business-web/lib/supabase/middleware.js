// © 2026 WiamApp. Powered by WiamLabs
// lib/supabase/middleware.js — refreshes the Supabase session cookie
// on every request. Called from proxy.js (Next.js 16's renamed
// convention — was middleware.js in Next.js 15). This alone is NOT
// the security boundary — per CVE-2025-29927, middleware/proxy-only
// auth is insufficient. Every protected page also calls getUser()
// itself (see app/dashboard/layout.js) as the real defense-in-depth
// check.

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session if it's expired — required for Server
  // Components, which can't write cookies themselves.
  await supabase.auth.getUser();

  return supabaseResponse;
}
