// © 2026 WiamApp. Powered by WiamLabs
// app/browse/page.js — public, SEO-indexed worker directory.
// Server-rendered so search engines see real worker listings, not
// an empty shell waiting on client-side JS.

import Link from 'next/link';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export const metadata = {
  title: 'Browse verified workers',
  description: 'Find identity-verified electricians, cleaners, plumbers, drivers, and more near you on WiamApp.',
};

async function getCategories() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/workers/meta/categories`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function getWorkers(category, city) {
  try {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (city) params.set('city', city);
    params.set('limit', '24');

    const res = await fetch(`${BACKEND_URL}/api/workers?${params}`, { next: { revalidate: 120 } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function BrowsePage({ searchParams }) {
  const params = await searchParams;
  const category = params?.category || '';
  const city = params?.city || 'Accra';

  const [categories, workers] = await Promise.all([getCategories(), getWorkers(category, city)]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl font-bold text-ink mb-1">Browse workers</h1>
      <p className="text-inkMuted text-[14px] mb-6">{workers.length} verified worker{workers.length !== 1 ? 's' : ''} in {city}</p>

      <div className="flex flex-wrap gap-2 mb-7">
        <Link
          href={`/browse?city=${city}`}
          className={`text-[12.5px] font-semibold px-3.5 py-2 rounded-lg border ${!category ? 'bg-navy text-white border-navy' : 'border-line text-inkMuted'}`}
        >
          All categories
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/browse?category=${cat.id}&city=${city}`}
            className={`text-[12.5px] font-semibold px-3.5 py-2 rounded-lg border ${category === cat.id ? 'bg-navy text-white border-navy' : 'border-line text-inkMuted'}`}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      {workers.length === 0 ? (
        <div className="border border-line rounded-card py-16 text-center">
          <p className="text-[13.5px] text-inkMuted">No workers found in this category yet. Check back soon, or try another city.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((w) => (
            <Link
              key={w.id}
              href={`/workers/${w.id}`}
              className="border border-line rounded-card p-4 hover:border-gold transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-navy text-gold flex items-center justify-center font-display font-bold text-sm flex-shrink-0 overflow-hidden">
                  {w.users?.avatar_url
                    ? <img src={w.users.avatar_url} alt="" className="w-full h-full object-cover" />
                    : (w.users?.full_name || 'W')[0]?.toUpperCase()
                  }
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[13.5px] truncate">{w.users?.full_name || 'Worker'}</span>
                    {w.verified_badge && (
                      <svg className="w-3.5 h-3.5 text-blue flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 1.6 2.8-.5 1.4 2.5 2.5 1.4-.5 2.8L22 12l-1.6 2.4.5 2.8-2.5 1.4-1.4 2.5-2.8-.5L12 22l-2.4-1.6-2.8.5-1.4-2.5-2.5-1.4.5-2.8L2 12l1.6-2.4-.5-2.8 2.5-1.4 1.4-2.5 2.8.5z" /></svg>
                    )}
                  </div>
                  <div className="text-[11.5px] text-inkMuted truncate">{w.worker_categories?.[0]?.categories?.name || 'Worker'} · {w.users?.city}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-inkMuted">★ {w.average_rating?.toFixed(1) || 'New'} · {w.total_jobs_done || 0} jobs</span>
                <span className="font-semibold text-ink">{w.currency} {w.hourly_rate}/hr</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 bg-paper border border-line rounded-card p-6 text-center">
        <p className="text-[13.5px] text-inkMuted mb-3">Want to book, message, or check full availability? Get the app — it's free.</p>
        <Link href="/register" className="inline-block bg-gold text-navy font-semibold text-sm px-5 py-2.5 rounded-lg">Get started</Link>
      </div>
    </div>
  );
}
