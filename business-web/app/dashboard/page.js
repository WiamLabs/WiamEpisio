// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/page.js — real data, same logic as the mobile
// BusinessDashboardScreen for consistency between platforms.

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

function StatusPill({ status }) {
  const map = {
    pending: 'bg-amberTint text-amber',
    accepted: 'bg-blueTint text-blue',
    in_progress: 'bg-blueTint text-blue',
    completed: 'bg-greenTint text-green',
    cancelled: 'bg-red/10 text-red',
  };
  const label = {
    pending: 'Pending', accepted: 'Accepted', in_progress: 'In progress',
    completed: 'Completed', cancelled: 'Cancelled',
  };
  return (
    <span className={`inline-flex text-[11.5px] font-semibold px-2.5 py-1 rounded-md ${map[status] || 'bg-line text-inkMuted'}`}>
      {label[status] || status}
    </span>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { data: allBookings },
    { count: teamSize },
    { data: recentBookings },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, status, agreed_price, created_at')
      .eq('business_id', user.id)
      .gte('created_at', monthStart),
    supabase
      .from('business_team_members')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('bookings')
      .select(`
        id, status, description, agreed_price, scheduled_date, created_at,
        worker_profiles ( users ( full_name ) ),
        categories ( name )
      `)
      .eq('business_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const bookings = allBookings || [];
  const active = bookings.filter(b => ['accepted', 'in_progress'].includes(b.status)).length;
  const pending = bookings.filter(b => b.status === 'pending').length;
  const monthSpend = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + parseFloat(b.agreed_price || 0), 0);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const { data: business } = await supabase
    .from('business_profiles')
    .select('company_name')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">{greeting}, {business?.company_name || 'there'}</h1>
          <p className="text-[13px] text-inkMuted mt-1">Here's what's happening across your account today.</p>
        </div>
        <Link
          href="/dashboard/bookings"
          className="inline-flex items-center gap-1.5 bg-gold text-navy font-semibold text-[13px] px-4 py-2.5 rounded-lg"
        >
          View bookings
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-7">
        <div className="bg-white border border-line rounded-card p-4.5">
          <div className="text-xs text-inkMuted font-medium">Active jobs</div>
          <div className="font-display text-[25px] font-bold mt-2">{active}</div>
        </div>
        <div className="bg-white border border-line rounded-card p-4.5">
          <div className="text-xs text-inkMuted font-medium">Team members</div>
          <div className="font-display text-[25px] font-bold mt-2">{teamSize || 0}</div>
        </div>
        <div className="bg-white border border-line rounded-card p-4.5">
          <div className="text-xs text-inkMuted font-medium">This month spend</div>
          <div className="font-display text-[25px] font-bold mt-2">${monthSpend.toFixed(0)}</div>
        </div>
        <div className="bg-white border border-line rounded-card p-4.5">
          <div className="text-xs text-inkMuted font-medium">Pending approval</div>
          <div className="font-display text-[25px] font-bold mt-2">{pending}</div>
        </div>
      </div>

      <div className="bg-white border border-line rounded-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="text-[14.5px] font-bold">Recent bookings</h3>
          <Link href="/dashboard/bookings" className="text-[12.5px] text-gold font-semibold">View all</Link>
        </div>
        <div className="px-5 pb-2">
          {(recentBookings || []).length === 0 ? (
            <p className="text-[13px] text-inkMuted py-6 text-center">No bookings yet.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] text-inkMuted font-semibold uppercase tracking-wide">
                  <th className="py-2.5">Worker</th>
                  <th className="py-2.5">Category</th>
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="py-3 font-semibold">{b.worker_profiles?.users?.full_name || 'Worker'}</td>
                    <td className="py-3">{b.categories?.name || '—'}</td>
                    <td className="py-3">{new Date(b.scheduled_date || b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                    <td className="py-3"><StatusPill status={b.status} /></td>
                    <td className="py-3">${parseFloat(b.agreed_price || 0).toFixed(2)}</td>
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
