// © 2026 WiamApp. Powered by WiamLabs
// components/SiteFooter.js

import Link from 'next/link';

const COLUMNS = [
  {
    title: 'WiamApp',
    links: [
      { href: '/browse', label: 'Find a worker' },
      { href: '/premium', label: 'For workers' },
      { href: '/business', label: 'For business' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/careers', label: 'Careers' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of Service' },
      { href: '/privacy', label: 'Privacy Policy' },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="bg-navy text-white/70 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gold flex items-center justify-center font-display font-extrabold text-navy text-[13px]">W</div>
              <span className="font-display font-bold text-[14px] text-white">WiamApp</span>
            </div>
            <p className="text-[12.5px] leading-relaxed">Find trusted, verified workers for any job — built for Ghana and beyond.</p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="text-[11.5px] font-bold uppercase tracking-wide text-white/40 mb-3">{col.title}</div>
              <div className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <Link key={link.href} href={link.href} className="text-[13px] hover:text-white">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-white/40">© 2026 WiamApp. Powered by WiamLabs. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
