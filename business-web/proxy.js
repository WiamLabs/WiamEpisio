// © 2026 WiamApp. Powered by WiamLabs
// proxy.js — Next.js 16 renamed "middleware" to "proxy" (the file
// convention, not the underlying behavior). Same purpose: refresh
// the Supabase session cookie on every request. Runs on the Node.js
// runtime now (Next.js 16 no longer allows Edge here) — that's
// fine for us, this file only does cookie/session work, nothing
// Edge-specific.

import { updateSession } from './lib/supabase/middleware';

export async function proxy(request) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
