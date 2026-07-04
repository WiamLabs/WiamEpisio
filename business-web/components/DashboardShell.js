'use client';
// © 2026 WiamApp. Powered by WiamLabs
// components/DashboardShell.js — sidebar + topbar shell, ported
// faithfully from the approved HTML mockup design into real Next.js
// routing. Visual language is unchanged from the mockup on purpose.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const NAV_ALL = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/dashboard/bookings', label: 'Bookings', icon: 'bookings' },
  { href: '/dashboard/team', label: 'Team', icon: 'team' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: 'analytics' },
  { href: '/dashboard/spotlight', label: 'Spotlight', icon: 'spotlight' },
  { href: '/dashboard/billing', label: 'Billing', icon: 'billing' },
];

const NAV_GROWTH = [
  { href: '/dashboard/contracts', label: 'Recurring contracts', icon: 'contracts', tag: 'Growth' },
];

const NAV_ENTERPRISE = [
  { href: '/dashboard/locations', label: 'Multi-location', icon: 'locations', tag: 'Ent.' },
  { href: '/dashboard/vendors', label: 'Vendor database', icon: 'vendors', tag: 'Ent.' },
  { href: '/dashboard/sla', label: 'SLA dashboard', icon: 'sla', tag: 'Ent.' },
  { href: '/dashboard/invoicing', label: 'Invoicing', icon: 'invoicing', tag: 'Ent.' },
];

function NavIcon({ name, className }) {
  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    bookings: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    team: <><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="8" r="2.6"/><path d="M16 14.2c2.3.5 4 2.5 4 5.8"/></>,
    analytics: <><path d="M4 19V10M11 19V5M18 19v-7"/><path d="M2 19h20"/></>,
    spotlight: <><path d="M3 11l16-7-4 16-5-7-7-2z"/></>,
    billing: <><rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 9.5h19"/></>,
    contracts: <><path d="M7 3h8l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M9 9h6M9 13h6M9 17h3"/></>,
    locations: <><path d="M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/></>,
    vendors: <><path d="M20 21v-2a4 4 0 00-3-3.87"/><path d="M4 21v-2a4 4 0 013-3.87"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
    sla: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    invoicing: <><path d="M6 2h9l4 4v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M14 2v5h5"/></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {icons[name]}
    </svg>
  );
}

export default function DashboardShell({ business, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const initials = (business?.company_name || 'WB').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen">

      {/* Sidebar */}
      <nav className="w-[248px] flex-shrink-0 bg-navy text-white flex flex-col p-3.5 sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center font-display font-extrabold text-[15px] text-navy">W</div>
          <div>
            <div className="font-display font-bold text-[15px]">WiamApp Business</div>
            <div className="text-[11px] text-white/45 mt-px">wiamapp.com/business</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-[11px] font-semibold tracking-wide uppercase text-white/35 px-2.5 pb-2">All plans</div>
          {NAV_ALL.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] font-medium mb-px relative ${
                  active ? 'bg-gold/[0.16] text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {active && <span className="absolute -left-3.5 top-2 bottom-2 w-[3px] bg-gold rounded-r" />}
                <NavIcon name={item.icon} className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-gold' : 'text-white/55'}`} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-3">
          <div className="text-[11px] font-semibold tracking-wide uppercase text-white/35 px-2.5 pb-2">Growth &amp; up</div>
          {NAV_GROWTH.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] font-medium mb-px relative ${
                  active ? 'bg-gold/[0.16] text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {active && <span className="absolute -left-3.5 top-2 bottom-2 w-[3px] bg-gold rounded-r" />}
                <NavIcon name={item.icon} className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-gold' : 'text-white/55'}`} />
                {item.label}
                <span className="ml-auto text-[9.5px] font-bold tracking-wide text-navy bg-gold px-1.5 py-0.5 rounded-md">{item.tag}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-3">
          <div className="text-[11px] font-semibold tracking-wide uppercase text-white/35 px-2.5 pb-2">Enterprise</div>
          {NAV_ENTERPRISE.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] font-medium mb-px relative ${
                  active ? 'bg-gold/[0.16] text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {active && <span className="absolute -left-3.5 top-2 bottom-2 w-[3px] bg-gold rounded-r" />}
                <NavIcon name={item.icon} className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-gold' : 'text-white/55'}`} />
                {item.label}
                <span className="ml-auto text-[9.5px] font-bold tracking-wide text-navy bg-gold px-1.5 py-0.5 rounded-md">{item.tag}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto pt-1.5">
          <Link
            href="/dashboard/profile"
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] font-medium mb-px ${
              pathname === '/dashboard/profile' ? 'bg-gold/[0.16] text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            Company profile
          </Link>
          <Link
            href="/dashboard/settings"
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] font-medium mb-3 ${
              pathname === '/dashboard/settings' ? 'bg-gold/[0.16] text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 000-3l2-1.6-2-3.4-2.4.8a7.7 7.7 0 00-2.6-1.5L14 2h-4l-.4 2.4a7.7 7.7 0 00-2.6 1.5l-2.4-.8-2 3.4 2 1.6a7.6 7.6 0 000 3l-2 1.6 2 3.4 2.4-.8a7.7 7.7 0 002.6 1.5L10 22h4l.4-2.4a7.7 7.7 0 002.6-1.5l2.4.8 2-3.4z"/></svg>
            Settings
          </Link>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] font-medium text-white/70 hover:bg-white/[0.06] hover:text-white mb-3"
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
            Sign out
          </button>

          <Link
            href="/dashboard/plans"
            className="bg-navyMid border border-white/[0.08] rounded-[10px] p-2.5 flex items-center justify-between gap-2 hover:border-gold/40"
          >
            <div>
              <div className="text-[12.5px] font-semibold text-white capitalize">{business?.plan || 'Starter'} plan</div>
              <div className="text-[11px] text-white/45 mt-px">{business?.company_name}</div>
            </div>
            <span className="text-[11.5px] font-bold text-navy bg-gold px-2.5 py-1 rounded-md">View plans</span>
          </Link>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-16 bg-white border-b border-line flex items-center gap-4 px-7 sticky top-0 z-10">
          <div className="flex-1 max-w-[380px] flex items-center gap-2 bg-paper border border-line rounded-lg px-3 py-2 text-inkFaint">
            <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <span className="text-[13px]">Search bookings, workers...</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-navy text-gold flex items-center justify-center font-display font-bold text-[12.5px]">{initials}</div>
            <div>
              <div className="text-[13px] font-semibold">{business?.company_name}</div>
              <div className="text-[11px] text-inkMuted">Account owner</div>
            </div>
          </div>
        </div>

        <div className="px-8 py-7 pb-16 max-w-[1140px]">
          {children}
        </div>
      </div>
    </div>
  );
}
