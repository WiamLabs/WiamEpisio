// © 2026 WiamApp. Powered by WiamLabs
// app/page.js — the real public homepage at wiamapp.com

import Link from 'next/link';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const CATEGORY_ICONS = {
  default: <path d="M12 2l3 6 6 1-4.5 4.5L17.5 20 12 17l-5.5 3 1-6.5L3 9l6-1 3-6z" />,
};

async function getCategories() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/workers/meta/categories`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 15) : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const categories = await getCategories();

  return (
    <div>
      {/* Hero */}
      <section className="bg-navy">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold text-white leading-[1.1] mb-5">
              Find trusted workers, <span className="text-gold">verified</span> for the job.
            </h1>
            <p className="text-white/65 text-[15px] leading-relaxed mb-8 max-w-md">
              Electricians, musicians, phone repairers, cleaners, and more — every worker identity-checked before they can accept a job, every payment held securely until the work is done.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/browse" className="bg-gold text-navy font-semibold text-sm px-6 py-3.5 rounded-lg">
                Find a worker
              </Link>
              <a href="/register?role=worker" className="border border-white/25 text-white font-semibold text-sm px-6 py-3.5 rounded-lg">
                Work on WiamApp
              </a>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="bg-navyMid border border-white/10 rounded-card p-6 space-y-3">
              {['Verified electrician', 'Bookable musician', 'Trusted phone repairer'].map((label, i) => (
                <div key={label} className="flex items-center gap-3 bg-navy/50 rounded-lg p-3">
                  <div className="w-10 h-10 rounded-full bg-navy text-gold flex items-center justify-center font-display font-bold text-sm flex-shrink-0">
                    {label[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-white text-[13px] font-semibold">{label}</div>
                    <div className="text-white/40 text-[11px]">Accra · 4.{8 - i} ★</div>
                  </div>
                  <svg className="w-4 h-4 text-gold" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="font-display text-2xl font-bold text-ink mb-1">What do you need done?</h2>
          <p className="text-inkMuted text-[14px] mb-8">Browse workers by category, all verified before they ever accept a job.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/browse?category=${cat.id}`}
                className="border border-line rounded-card p-4 hover:border-gold transition-colors"
              >
                <svg className="w-6 h-6 text-gold mb-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  {CATEGORY_ICONS.default}
                </svg>
                <div className="font-semibold text-[13.5px] text-ink">{cat.name}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="bg-paper py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-display text-2xl font-bold text-ink mb-8 text-center">How WiamApp works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '1', title: 'Find a verified worker', desc: 'Browse by category and location. Every worker passes an identity check before they can accept jobs.' },
              { n: '2', title: 'Book and pay securely', desc: 'Your payment is held safely until the job is confirmed done — never handed over upfront.' },
              { n: '3', title: 'Rate and rebook', desc: 'Leave a review, and book the same trusted worker again whenever you need them.' },
            ].map((step) => (
              <div key={step.n} className="bg-white rounded-card p-6 border border-line">
                <div className="w-9 h-9 rounded-lg bg-navy text-gold flex items-center justify-center font-display font-bold text-sm mb-4">{step.n}</div>
                <div className="font-semibold text-[15px] text-ink mb-2">{step.title}</div>
                <p className="text-[13px] text-inkMuted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dual CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-5">
        <div className="bg-navy rounded-card p-8">
          <h3 className="font-display text-xl font-bold text-white mb-2">Looking for work?</h3>
          <p className="text-white/60 text-[13.5px] mb-5 leading-relaxed">Join thousands of workers earning on their own schedule. Get verified, get found, get paid securely.</p>
          <Link href="/premium" className="inline-block bg-gold text-navy font-semibold text-sm px-5 py-3 rounded-lg">
            Learn more for workers
          </Link>
        </div>
        <div className="border-2 border-gold/40 rounded-card p-8">
          <h3 className="font-display text-xl font-bold text-ink mb-2">Run a business?</h3>
          <p className="text-inkMuted text-[13.5px] mb-5 leading-relaxed">Manage your team, bookings, and billing from one dashboard built for companies, not just individuals.</p>
          <Link href="/business" className="inline-block bg-navy text-white font-semibold text-sm px-5 py-3 rounded-lg">
            Explore WiamApp Business
          </Link>
        </div>
      </section>
    </div>
  );
}
