// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/team/page.js

import { createClient } from '@/lib/supabase/server';
import TeamList from '@/components/TeamList';

// Same single source of truth as backend/routes/business.js —
// duplicated here deliberately rather than imported, since the web
// app and Express backend are separate deployments; if this ever
// drifts, Section 21B-style reconciliation should catch it.
const MAX_WORKERS_BY_PLAN = { free: 0, starter: 5, growth: 25, enterprise: 9999 };

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from('business_profiles')
    .select('plan')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: teamRows } = await supabase
    .from('business_team_members')
    .select(`
      id, role, status, is_hidden_from_search, joined_at,
      worker_profiles ( users ( full_name ) )
    `)
    .eq('business_id', user.id)
    .order('joined_at', { ascending: false });

  const team = (teamRows || []).map(m => ({
    id: m.id,
    name: m.worker_profiles?.users?.full_name || 'Worker',
    role: m.role || 'Team Member',
    status: m.status,
    isHidden: m.is_hidden_from_search || false,
  }));

  const maxWorkers = MAX_WORKERS_BY_PLAN[business?.plan] ?? 5;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Team</h1>
          <p className="text-[13px] text-inkMuted mt-1">
            Workers you book regularly. Hide anyone from public search to keep them yours.
          </p>
        </div>
      </div>

      <TeamList initialTeam={team} businessId={user.id} maxWorkers={maxWorkers} />
    </div>
  );
}
