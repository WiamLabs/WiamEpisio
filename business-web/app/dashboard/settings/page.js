// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/settings/page.js

import { createClient } from '@/lib/supabase/server';
import SettingsManager from '@/components/SettingsManager';

const PREF_KEYS = [
  'notif_booking_requests',
  'notif_team_activity',
  'notif_billing_alerts',
  'notif_product_updates',
  'hide_new_members_default',
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from('user_settings')
    .select('key, value')
    .eq('user_id', user.id)
    .in('key', PREF_KEYS);

  // Sensible defaults — booking/team/billing alerts on by default,
  // marketing off by default, matching the same defaults used on
  // the mobile WorkerSettingsScreen for consistency.
  const defaults = {
    notif_booking_requests: true,
    notif_team_activity: true,
    notif_billing_alerts: true,
    notif_product_updates: false,
    hide_new_members_default: false,
  };
  const prefs = { ...defaults };
  (rows || []).forEach(r => { prefs[r.key] = r.value === 'true'; });

  return <SettingsManager initialPrefs={prefs} userEmail={user.email} />;
}
