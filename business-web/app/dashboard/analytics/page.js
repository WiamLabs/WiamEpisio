// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/analytics/page.js — real aggregation from bookings,
// no fabricated numbers.

import { createClient } from '@/lib/supabase/server';

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('status, agreed_price, created_at, categories ( name )')
    .eq('business_id', user.id)
    .gte('created_at', sixMonthsAgo.toISOString());

  const all = bookings || [];
  const completed = all.filter(b => b.status === 'completed');
  const totalSpend = completed.reduce((s, b) => s + parseFloat(b.agreed_price || 0), 0);
  const avgJobCost = completed.length ? totalSpend / completed.length : 0;
  const cancelled = all.filter(b => b.status === 'cancelled').length;
  const repeatRate = all.length ? Math.round(((all.length - cancelled) / all.length) * 100) : 0;

  // Spend by month, last 6 months, oldest first
  const monthBuckets = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleDateString('en-US', { month: 'short' });
    monthBuckets[key] = 0;
  }
  completed.forEach(b => {
    const key = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short' });
    if (monthBuckets[key] !== undefined) monthBuckets[key] += parseFloat(b.agreed_price || 0);
  });
  const maxMonthSpend = Math.max(...Object.values(monthBuckets), 1);

  // Jobs by category
  const categoryCounts = {};
  all.forEach(b => {
    const name = b.categories?.name || 'Other';
    categoryCounts[name] = (categoryCounts[name] || 0) + 1;
  });
  const maxCategoryCount = Math.max(...Object.values(categoryCounts), 1);
  const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[21px] font-bold text-ink">Analytics</h1>
        <p className="text-[13px] text-inkMuted mt-1">How your team is performing and spending, last 6 months.</p>
      </div>

      <div className="grid grid-cols-3 gap-3.5 mb-6">
        <div className="bg-white border border-line rounded-card p-4.5">
          <div className="text-xs text-inkMuted font-medium">Total spend (6 mo)</div>
          <div className="font-display text-[25px] font-bold mt-2">${totalSpend.toFixed(0)}</div>
        </div>
        <div className="bg-white border border-line rounded-card p-4.5">
          <div className="text-xs text-inkMuted font-medium">Avg job cost</div>
          <div className="font-display text-[25px] font-bold mt-2">${avgJobCost.toFixed(0)}</div>
        </div>
        <div className="bg-white border border-line rounded-card p-4.5">
          <div className="text-xs text-inkMuted font-medium">Completion rate</div>
          <div className="font-display text-[25px] font-bold mt-2">{repeatRate}%</div>
        </div>
      </div>

      <div className="bg-white border border-line rounded-card mb-5">
        <div className="px-5 py-4 border-b border-line">
          <h3 className="text-[14.5px] font-bold">Spend by month</h3>
        </div>
        <div className="p-5">
          {totalSpend === 0 ? (
            <p className="text-[13px] text-inkMuted text-center py-6">No completed bookings yet to chart.</p>
          ) : (
            <div className="flex items-end gap-3.5 h-[140px] pt-2.5">
              {Object.entries(monthBuckets).map(([month, spend]) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div
                    className="w-full max-w-[34px] rounded-t bg-gold"
                    style={{ height: `${Math.max((spend / maxMonthSpend) * 100, 2)}%` }}
                  />
                  <div className="text-[11px] text-inkMuted">{month}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-line rounded-card">
        <div className="px-5 py-4 border-b border-line">
          <h3 className="text-[14.5px] font-bold">Jobs by category</h3>
        </div>
        <div className="p-5 pt-3.5">
          {topCategories.length === 0 ? (
            <p className="text-[13px] text-inkMuted text-center py-6">No bookings yet.</p>
          ) : (
            topCategories.map(([name, count]) => (
              <div key={name} className="flex items-center gap-2.5 mb-3">
                <div className="w-[108px] text-[12.5px] font-medium flex-shrink-0">{name}</div>
                <div className="flex-1 h-[9px] bg-line rounded-full overflow-hidden">
                  <div className="h-full bg-navy rounded-full" style={{ width: `${(count / maxCategoryCount) * 100}%` }} />
                </div>
                <div className="w-9 text-right text-[12px] text-inkMuted flex-shrink-0">{count}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
