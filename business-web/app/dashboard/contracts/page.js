// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/contracts/page.js

import { createClient } from '@/lib/supabase/server';
import ContractsManager from '@/components/ContractsManager';
import UpgradeRequired from '@/components/UpgradeRequired';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const PLAN_RANK = { free: 0, starter: 1, growth: 2, enterprise: 3 };

export default async function ContractsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from('business_profiles')
    .select('plan')
    .eq('user_id', user.id)
    .maybeSingle();

  if ((PLAN_RANK[business?.plan] ?? 0) < PLAN_RANK.growth) {
    return (
      <UpgradeRequired
        tier="Growth"
        title="Recurring contracts"
        description="Set up a standing weekly or monthly arrangement with a worker, so you never have to rebook the same job."
        icon={<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 3h8l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>}
      />
    );
  }

  const { data: { session } } = await supabase.auth.getSession();

  const [contractsRes, teamRows] = await Promise.all([
    fetch(`${BACKEND_URL}/api/growth/contracts`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
      cache: 'no-store',
    }).then(r => r.json()).catch(() => ({ data: [] })),
    supabase
      .from('business_team_members')
      .select('id, role, worker_profiles ( id, users ( full_name ) )')
      .eq('business_id', user.id)
      .eq('status', 'active'),
  ]);

  const teamMembers = (teamRows.data || []).map(m => ({
    workerId: m.worker_profiles?.id,
    name: m.worker_profiles?.users?.full_name || 'Worker',
    role: m.role,
  })).filter(m => m.workerId);

  return <ContractsManager initialContracts={contractsRes.data || []} teamMembers={teamMembers} />;
}
