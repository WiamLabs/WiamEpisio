// © 2026 WiamApp. Powered by WiamLabs
// app/workers/[id]/page.js — SEO-indexed individual profile, the
// page most likely to drive an install per the master plan (a
// shared link, a Google search result for the worker's name).

import { notFound } from 'next/navigation';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

async function getWorker(id) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/workers/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const worker = await getWorker(id);
  if (!worker) return { title: 'Worker not found' };

  const name = worker.users?.full_name || 'Worker';
  const category = worker.worker_categories?.[0]?.categories?.name || 'service';
  const city = worker.users?.city || '';

  return {
    title: `${name} — ${category} in ${city}`,
    description: `Book ${name}, a ${worker.verified_badge ? 'verified' : ''} ${category.toLowerCase()} in ${city} on WiamApp. ${worker.average_rating ? `Rated ${worker.average_rating.toFixed(1)} stars.` : ''}`,
    openGraph: {
      title: `${name} — ${category} in ${city}`,
      images: worker.users?.avatar_url ? [worker.users.avatar_url] : [],
    },
  };
}

export default async function WorkerProfilePage({ params }) {
  const { id } = await params;
  const worker = await getWorker(id);
  if (!worker) notFound();

  const name = worker.users?.full_name || 'Worker';
  const categories = (worker.worker_categories || []).map(wc => wc.categories?.name).filter(Boolean);
  const portfolio = worker.portfolio_images || [];
  const reviews = worker.reviews || [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex flex-col sm:flex-row items-start gap-5 mb-8">
        <div className="w-20 h-20 rounded-full bg-navy text-gold flex items-center justify-center font-display font-bold text-2xl flex-shrink-0 overflow-hidden">
          {worker.users?.avatar_url
            ? <img src={worker.users.avatar_url} alt={name} className="w-full h-full object-cover" />
            : name[0]?.toUpperCase()
          }
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl font-bold text-ink">{name}</h1>
            {worker.verified_badge && (
              <span className="flex items-center gap-1 text-[11.5px] font-semibold text-blue bg-blueTint px-2.5 py-1 rounded-md">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 1.6 2.8-.5 1.4 2.5 2.5 1.4-.5 2.8L22 12l-1.6 2.4.5 2.8-2.5 1.4-1.4 2.5-2.8-.5L12 22l-2.4-1.6-2.8.5-1.4-2.5-2.5-1.4.5-2.8L2 12l1.6-2.4-.5-2.8 2.5-1.4 1.4-2.5 2.8.5z" /></svg>
                Verified
              </span>
            )}
          </div>
          <p className="text-[13.5px] text-inkMuted mt-1">{categories.join(', ') || 'Worker'} · {worker.users?.city}</p>
          <div className="flex items-center gap-4 mt-2.5 text-[13px]">
            <span>★ {worker.average_rating?.toFixed(1) || 'New'} {reviews.length > 0 && `(${reviews.length} reviews)`}</span>
            <span className="text-inkMuted">{worker.total_jobs_done || 0} jobs completed</span>
          </div>
        </div>
        <div className="bg-paper border border-line rounded-card p-4 text-center w-full sm:w-auto">
          <div className="font-display text-xl font-bold text-ink">{worker.currency} {worker.hourly_rate}</div>
          <div className="text-[11px] text-inkMuted mb-3">per hour</div>
          <a href="/register" className="block bg-gold text-navy font-semibold text-[13px] px-5 py-2.5 rounded-lg">
            Book on WiamApp
          </a>
        </div>
      </div>

      {worker.bio && (
        <div className="mb-8">
          <h2 className="font-semibold text-[15px] text-ink mb-2">About</h2>
          <p className="text-[13.5px] text-inkMuted leading-relaxed">{worker.bio}</p>
        </div>
      )}

      {portfolio.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-[15px] text-ink mb-3">Recent work</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {portfolio.slice(0, 6).map((img) => (
              <img key={img.id} src={img.image_url} alt={img.caption || ''} className="w-full h-32 object-cover rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div>
          <h2 className="font-semibold text-[15px] text-ink mb-3">Reviews</h2>
          <div className="space-y-4">
            {reviews.slice(0, 8).map((r) => (
              <div key={r.id} className="border-b border-line pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-[13px]">{r.users?.full_name || 'Customer'}</span>
                  <span className="text-[12px] text-gold">{'★'.repeat(r.rating)}</span>
                </div>
                {r.comment && <p className="text-[13px] text-inkMuted">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 bg-navy rounded-card p-6 text-center">
        <p className="text-white/70 text-[13.5px] mb-3">Book {name} securely — your payment is held until the job is done.</p>
        <a href="/register" className="inline-block bg-gold text-navy font-semibold text-sm px-5 py-2.5 rounded-lg">
          Open in WiamApp
        </a>
      </div>
    </div>
  );
}
