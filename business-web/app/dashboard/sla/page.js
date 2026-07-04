// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/sla/page.js

import { createClient } from '@/lib/supabase/server';
import UpgradeRequired from '@/components/UpgradeRequired';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default async function SlaPage() {
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
        title="SLA dashboard"
        description="Track response-time and completion guarantees across every worker your company books."
        icon={<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>}
      />
    );
  }

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BACKEND_URL}/api/enterprise/sla`, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
    cache: 'no-store',
  }).then(r => r.json()).catch(() => ({ data: { contracts: [], breaches: [] } }));

  const { contracts, breaches } = res.data || { contracts: [], breaches: [] };
  const totalCredits = breaches.reduce((s, b) => s + parseFloat(b.credit_issued_usd || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[21px] font-bold text-ink">SLA dashboard</h1>
        <p className="text-[13px] text-inkMuted mt-1">Response-time and completion guarantees across your bookings.</p>
      </div>

      <div className="grid grid-cols-3 gap-3.5 mb-6">
        <div className="bg-white border border-line rounded-card p-4.5">
          <div className="text-xs text-inkMuted font-medium">Active SLA terms</div>
          <div className="font-display text-[25px] font-bold mt-2">{contracts.length}</div>
        </div>
        <div className="bg-white border border-line rounded-card p-4.5">
          <div className="text-xs text-inkMuted font-medium">Breaches (all time)</div>
          <div className="font-display text-[25px] font-bold mt-2">{breaches.length}</div>
        </div>
        <div className="bg-white border border-line rounded-card p-4.5">
          <div className="text-xs text-inkMuted font-medium">Credits issued</div>
          <div className="font-display text-[25px] font-bold mt-2">${totalCredits.toFixed(0)}</div>
        </div>
      </div>

      <div className="bg-white border border-line rounded-card mb-5">
        <div className="px-5 py-4 border-b border-line"><h3 className="text-[14.5px] font-bold">SLA terms</h3></div>
        <div className="px-5 pb-2">
          {contracts.length === 0 ? (
            <p className="text-[13px] text-inkMuted py-6 text-center">No SLA terms configured yet — contact your account manager to set these up.</p>
          ) : (
            contracts.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3 border-t border-line first:border-t-0">
                <div>
                  <div className="font-semibold text-sm capitalize">{c.sla_type.replace(/_/g, ' ')}</div>
                  <div className="text-[12px] text-inkMuted">Response within {c.response_hours}h, {c.credit_percentage}% credit on breach</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white border border-line rounded-card">
        <div className="px-5 py-4 border-b border-line"><h3 className="text-[14.5px] font-bold">Recent breaches</h3></div>
        <div className="px-5 pb-2">
          {breaches.length === 0 ? (
            <p className="text-[13px] text-inkMuted py-6 text-center">No SLA breaches — everything's on track.</p>
          ) : (
            breaches.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-3 border-t border-line first:border-t-0 text-[13px]">
                <div>
                  <div className="font-semibold capitalize">{b.sla_type.replace(/_/g, ' ')}</div>
                  <div className="text-[12px] text-inkMuted">{b.breach_minutes} min late · {new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                </div>
                <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-md ${b.resolved ? 'bg-greenTint text-green' : 'bg-amberTint text-amber'}`}>
                  {b.resolved ? `$${parseFloat(b.credit_issued_usd || 0).toFixed(2)} credited` : 'Pending'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
