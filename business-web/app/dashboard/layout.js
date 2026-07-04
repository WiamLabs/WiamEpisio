// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/layout.js — the real auth gate for every page under
// /dashboard. This explicit check is the actual security boundary
// — middleware.js only refreshes the session cookie, it does not
// gate access by itself (see CVE-2025-29927: middleware-only auth
// is not sufficient defense).

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';

export default async function DashboardLayout({ children }) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect('/login');
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userRow?.role !== 'business') {
    await supabase.auth.signOut();
    redirect('/login');
  }

  const { data: business } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <DashboardShell business={business}>
      {children}
    </DashboardShell>
  );
}
