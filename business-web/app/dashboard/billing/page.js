// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/billing/page.js — real data from migration 028's
// subscriptions/payment_methods/subscription_invoices tables.

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: subscription }, { data: paymentMethod }, { data: invoices }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan_key, amount_usd, status, next_billing_date, billing_source')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('payment_methods')
      .select('card_brand, card_last4, card_exp_month, card_exp_year')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('is_default', true)
      .maybeSingle(),
    supabase
      .from('subscription_invoices')
      .select('id, amount_usd, currency_billed, status, plan_name, created_at, pdf_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  const planLabel = subscription?.plan_key
    ? subscription.plan_key.replace('_biz', '').replace(/^\w/, c => c.toUpperCase())
    : 'Free';

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[21px] font-bold text-ink">Billing</h1>
        <p className="text-[13px] text-inkMuted mt-1">Your plan, payment method, and invoice history.</p>
      </div>

      <div className="bg-white border border-line rounded-card flex items-center justify-between p-5 mb-5">
        <div>
          <div className="text-xs text-inkMuted font-medium">Current plan</div>
          <div className="font-display text-[20px] font-bold mt-1.5">
            {planLabel}{subscription ? ` — $${subscription.amount_usd}/month` : ''}
          </div>
          <div className="text-[11.5px] text-inkMuted mt-1">
            {subscription
              ? `${subscription.billing_source === 'web' ? 'Billed via card' : 'Billed via app store'}, renews ${subscription.next_billing_date ? new Date(subscription.next_billing_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}`
              : 'No active paid plan'}
          </div>
        </div>
        <Link href="/dashboard/plans" className="border border-line bg-white text-ink font-semibold text-[13px] px-4 py-2.5 rounded-lg hover:border-gold">
          Change plan
        </Link>
      </div>

      <div className="bg-white border border-line rounded-card mb-5">
        <div className="px-5 py-4 border-b border-line">
          <h3 className="text-[14.5px] font-bold">Payment method</h3>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          {paymentMethod ? (
            <div className="flex items-center gap-3">
              <svg className="w-[22px] h-[22px] text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 9.5h19"/></svg>
              <div>
                <div className="font-semibold text-[14px] capitalize">{paymentMethod.card_brand} •••• {paymentMethod.card_last4}</div>
                <div className="text-[11.5px] text-inkMuted">Expires {paymentMethod.card_exp_month}/{paymentMethod.card_exp_year}</div>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-inkMuted">No card on file yet — subscribed via app store, or no active subscription.</p>
          )}
          <Link href="/dashboard/plans" className="border border-line bg-white text-ink font-semibold text-[13px] px-4 py-2.5 rounded-lg hover:border-gold">
            {paymentMethod ? 'Update card' : 'Add card'}
          </Link>
        </div>
      </div>

      <div className="bg-white border border-line rounded-card">
        <div className="px-5 py-4 border-b border-line">
          <h3 className="text-[14.5px] font-bold">Invoice history</h3>
        </div>
        <div className="px-5 pb-2">
          {(invoices || []).length === 0 ? (
            <p className="text-[13px] text-inkMuted py-8 text-center">No invoices yet.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] text-inkMuted font-semibold uppercase tracking-wide">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Plan</th>
                  <th className="py-2.5">Amount</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-line">
                    <td className="py-3">{new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="py-3">{inv.plan_name}</td>
                    <td className="py-3">${parseFloat(inv.amount_usd).toFixed(2)}</td>
                    <td className="py-3">
                      <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-md ${inv.status === 'paid' ? 'bg-greenTint text-green' : 'bg-redTint text-red'}`}>
                        {inv.status === 'paid' ? 'Paid' : 'Failed'}
                      </span>
                    </td>
                    <td className="py-3">
                      {inv.pdf_url ? (
                        <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-gold font-semibold text-[12.5px]">Download</a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
