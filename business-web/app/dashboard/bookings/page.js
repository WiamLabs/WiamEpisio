// © 2026 WiamApp. Powered by WiamLabs
// app/dashboard/bookings/page.js — real bookings list, real data.
// Growth+ businesses also get inline Job Assignment per row.

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import BookingsTable from '@/components/BookingsTable';

const PLAN_RANK = { free: 0, starter: 1, growth: 2, enterprise: 3 };

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

export default async function BookingsPage({ searchParams }) {
  const params = await searchParams;
  const filter = params?.status || 'all';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('bookings')
    .select(`
      id, status, agreed_price, currency, scheduled_date, created_at,
      worker_profiles ( users ( full_name, avatar_url ) ),
      categories ( name )
    `)
    .eq('business_id', user.id)
    .order('created_at', { ascending: false });

  if (filter === 'pending') query = query.eq('status', 'pending');
  if (filter === 'active') query = query.in('status', ['accepted', 'in_progress']);
  if (filter === 'completed') query = query.eq('status', 'completed');

  const [{ data: bookings }, { data: business }, { data: teamRows }] = await Promise.all([
    query,
    supabase.from('business_profiles').select('plan').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('business_team_members')
      .select('worker_profiles ( id, users ( full_name ) )')
      .eq('business_id', user.id)
      .eq('status', 'active'),
  ]);

  const canAssign = (PLAN_RANK[business?.plan] ?? 0) >= PLAN_RANK.growth;
  const teamMembers = (teamRows || [])
    .map(m => ({ workerId: m.worker_profiles?.id, name: m.worker_profiles?.users?.full_name }))
    .filter(m => m.workerId && m.name);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Bookings</h1>
          <p className="text-[13px] text-inkMuted mt-1">
            Every job your team has booked through WiamApp.
            {canAssign && ' Reassign a pending or accepted job to a different team member anytime.'}
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-4.5 border-b border-line">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === 'all' ? '/dashboard/bookings' : `/dashboard/bookings?status=${tab.key}`}
            className={`px-3.5 py-2.5 text-[13px] font-semibold -mb-px border-b-2 ${
              filter === tab.key ? 'text-ink border-gold' : 'text-inkMuted border-transparent'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="bg-white border border-line rounded-card px-5 pb-2 pt-3">
        <BookingsTable initialBookings={bookings || []} canAssign={canAssign} teamMembers={teamMembers} />
      </div>
    </div>
  );
}

