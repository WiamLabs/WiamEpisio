// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/vendors/page.js

import { createClient } from '@/lib/supabase/server';
import UpgradeRequired from '@/components/UpgradeRequired';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default async function VendorsPage() {
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
        title="Verified vendor database"
        description="Keep a trusted, pre-vetted list of workers your whole company can rebook with confidence."
        icon={<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-3-3.87"/><path d="M4 21v-2a4 4 0 013-3.87"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
      />
    );
  }

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BACKEND_URL}/api/enterprise/vendors`, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
    cache: 'no-store',
  }).then(r => r.json()).catch(() => ({ data: [] }));

  const vendors = res.data || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[21px] font-bold text-ink">Verified vendor database</h1>
        <p className="text-[13px] text-inkMuted mt-1">
          Workers your company trusts and rebooks. Add a worker as a vendor from their profile after booking them.
        </p>
      </div>

      {vendors.length === 0 ? (
        <div className="bg-white border border-line rounded-card py-14 text-center">
          <p className="text-[13px] text-inkMuted">No vendors added yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-card divide-y divide-line">
          {vendors.map((v) => {
            const worker = v.worker_profiles;
            const user = worker?.users;
            return (
              <div key={v.id} className="p-4.5 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-navy text-gold flex items-center justify-center font-display font-bold text-sm flex-shrink-0">
                  {(user?.full_name || 'W')[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{user?.full_name || 'Worker'}</div>
                  <div className="text-[12px] text-inkMuted mt-0.5">
                    ★ {worker?.average_rating?.toFixed(1) || '–'} · {worker?.total_jobs_done || 0} jobs
                    {v.notes ? ` · ${v.notes}` : ''}
                  </div>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md flex-shrink-0 ${v.worker_confirmed ? 'bg-greenTint text-green' : 'bg-amberTint text-amber'}`}>
                  {v.worker_confirmed ? 'Confirmed' : 'Pending confirmation'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
