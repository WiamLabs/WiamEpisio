// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/locations/page.js

import { createClient } from '@/lib/supabase/server';
import LocationsManager from '@/components/LocationsManager';
import UpgradeRequired from '@/components/UpgradeRequired';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default async function LocationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from('business_profiles')
    .select('plan')
    .eq('user_id', user.id)
    .maybeSingle();

  if (business?.plan !== 'enterprise') {
    return (
      <UpgradeRequired
        tier="Enterprise"
        title="Multi-location"
        description="Manage every branch from one account, with bookings and spend broken out by location."
        icon={<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>}
      />
    );
  }

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BACKEND_URL}/api/enterprise/locations`, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
    cache: 'no-store',
  }).then(r => r.json()).catch(() => ({ data: [] }));

  return <LocationsManager initialLocations={res.data || []} />;
}
