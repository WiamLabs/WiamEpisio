// © 2026 WiamApp. Powered by WiamLabs
// components/SiteHeader.js — shared top nav across every public page

import Link from 'next/link';

const NAV = [
  { href: '/browse', label: 'Find a worker' },
  { href: '/premium', label: 'For workers' },
  { href: '/business', label: 'For business' },
  { href: '/careers', label: 'Careers' },
];

export default function SiteHeader() {
  return (
    <header className="border-b border-line bg-white sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center font-display font-extrabold text-navy text-[15px]">W</div>
          <span className="font-display font-bold text-[15px] text-ink">WiamApp</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 flex-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-[13.5px] font-medium text-inkMuted hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 ml-auto">
          <a href="/business/login" className="hidden sm:inline text-[13.5px] font-semibold text-inkMuted hover:text-ink">
            Sign in
          </a>
          <Link href="/register" className="bg-gold text-navy font-semibold text-[13px] px-4 py-2 rounded-lg">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
