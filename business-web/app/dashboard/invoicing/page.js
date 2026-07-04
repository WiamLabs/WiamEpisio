// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/invoicing/page.js

import { createClient } from '@/lib/supabase/server';
import UpgradeRequired from '@/components/UpgradeRequired';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const STATUS_STYLE = {
  unpaid: 'bg-amberTint text-amber',
  paid: 'bg-greenTint text-green',
  overdue: 'bg-redTint text-red',
  void: 'bg-line text-inkMuted',
};

export default async function InvoicingPage() {
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
        title="Consolidated invoicing"
        description="One monthly invoice for every job across your whole company, instead of paying per booking."
        icon={<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2h9l4 4v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M14 2v5h5"/></svg>}
      />
    );
  }

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BACKEND_URL}/api/enterprise/invoices`, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
    cache: 'no-store',
  }).then(r => r.json()).catch(() => ({ data: [] }));

  const invoices = res.data || [];
  const totalUnpaid = invoices.filter(i => i.status === 'unpaid' || i.status === 'overdue').reduce((s, i) => s + parseFloat(i.total_due_usd || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[21px] font-bold text-ink">Invoicing</h1>
        <p className="text-[13px] text-inkMuted mt-1">One consolidated invoice per billing period, across all jobs and locations.</p>
      </div>

      {totalUnpaid > 0 && (
        <div className="bg-amberTint border border-amber/30 rounded-card p-4 mb-5 flex items-center justify-between">
          <div className="text-[13.5px] font-semibold">Outstanding balance</div>
          <div className="font-display text-lg font-bold">${totalUnpaid.toFixed(2)}</div>
        </div>
      )}

      <div className="bg-white border border-line rounded-card px-5 pb-2 pt-3">
        {invoices.length === 0 ? (
          <p className="text-[13px] text-inkMuted py-10 text-center">No invoices generated yet — your first one is created at the end of this billing period.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] text-inkMuted font-semibold uppercase tracking-wide">
                <th className="py-2.5">Invoice</th>
                <th className="py-2.5">Period</th>
                <th className="py-2.5">Jobs</th>
                <th className="py-2.5">Total due</th>
                <th className="py-2.5">Status</th>
                <th className="py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-line">
                  <td className="py-3 font-mono text-[11.5px]">{inv.invoice_number}</td>
                  <td className="py-3">
                    {inv.billing_period_start ? new Date(inv.billing_period_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    {' – '}
                    {inv.billing_period_end ? new Date(inv.billing_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td className="py-3">{inv.total_jobs}</td>
                  <td className="py-3 font-semibold">${parseFloat(inv.total_due_usd).toFixed(2)}</td>
                  <td className="py-3">
                    <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-md capitalize ${STATUS_STYLE[inv.status]}`}>{inv.status}</span>
                  </td>
                  <td className="py-3">
                    {inv.pdf_url ? <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-gold font-semibold text-[12.5px]">Download</a> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
