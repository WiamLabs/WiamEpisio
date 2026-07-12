// © 2026 WiamApp. Powered by WiamLabs
// app/m/[handle]/page.js — Public Musician Pro artist page

import Link from 'next/link';
import { notFound } from 'next/navigation';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

async function getArtist(handle) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/artists/by-handle/${encodeURIComponent(handle)}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const data = await getArtist(handle);
  if (!data?.artist) return { title: 'Artist not found — WiamApp' };
  const a = data.artist;
  return {
    title: `${a.stage_name} — Book on WiamApp`,
    description: a.bio || `Book ${a.stage_name} for live performance. Packages with deposit escrow on WiamApp.`,
    openGraph: {
      title: `${a.stage_name} — WiamApp Musician Pro`,
      images: a.worker?.avatar_url ? [a.worker.avatar_url] : [],
    },
  };
}

export default async function ArtistPublicPage({ params }) {
  const { handle } = await params;
  const data = await getArtist(handle);
  if (!data?.success || !data.artist) notFound();

  const { artist, packages = [], blackouts = [] } = data;
  const genres = artist.genres || [];
  const rider = artist.rider_json || {};

  return (
    <div className="bg-navy min-h-screen text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/browse" className="text-gold text-sm font-semibold">← Browse WiamApp</Link>

        <div className="mt-8 flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-28 h-28 rounded-2xl bg-navyMid border border-white/10 overflow-hidden shrink-0">
            {artist.worker?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artist.worker.avatar_url} alt={artist.stage_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gold">
                {(artist.stage_name || 'A')[0]}
              </div>
            )}
          </div>
          <div>
            <p className="text-gold text-xs font-bold tracking-widest uppercase mb-1">Musician Pro</p>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold">{artist.stage_name}</h1>
            <p className="text-white/50 text-sm mt-1">@{artist.handle}
              {artist.city ? ` · ${artist.city}` : ''}
              {artist.band_size > 1 ? ` · Band of ${artist.band_size}` : ''}
            </p>
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {genres.map((g) => (
                  <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">{g}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {artist.bio && (
          <p className="mt-8 text-white/70 text-[15px] leading-relaxed whitespace-pre-line">{artist.bio}</p>
        )}

        <section className="mt-10">
          <h2 className="text-gold text-xs font-bold tracking-widest uppercase mb-4">Packages</h2>
          {packages.length === 0 ? (
            <p className="text-white/45 text-sm">No packages published yet.</p>
          ) : (
            <div className="space-y-3">
              {packages.map((pkg) => (
                <div key={pkg.id} className="rounded-xl border border-white/10 bg-navyMid/60 p-4">
                  <div className="flex justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-lg">{pkg.title}</h3>
                      {pkg.description && <p className="text-white/50 text-sm mt-1">{pkg.description}</p>}
                      <p className="text-white/40 text-xs mt-2">{pkg.duration_min} min · {pkg.deposit_pct}% deposit</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-gold font-bold text-lg">{pkg.currency} {Number(pkg.price).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {(rider.pa_system || rider.stage_size || rider.notes) && (
          <section className="mt-10">
            <h2 className="text-gold text-xs font-bold tracking-widest uppercase mb-4">Tech rider summary</h2>
            <ul className="text-sm text-white/65 space-y-1 list-disc list-inside">
              {rider.pa_system && <li>PA / sound: {rider.pa_system}</li>}
              {rider.stage_size && <li>Stage: {rider.stage_size}</li>}
              {rider.notes && <li>{rider.notes}</li>}
            </ul>
          </section>
        )}

        {blackouts.length > 0 && (
          <section className="mt-10">
            <h2 className="text-gold text-xs font-bold tracking-widest uppercase mb-4">Upcoming blackouts</h2>
            <ul className="text-sm text-white/50 space-y-1">
              {blackouts.slice(0, 5).map((b) => (
                <li key={b.id}>{b.start_date} → {b.end_date}{b.reason ? ` (${b.reason})` : ''}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <a
            href={`wiamapp://artist/${artist.handle}`}
            className="bg-gold text-navy font-semibold text-sm px-6 py-3.5 rounded-lg text-center"
          >
            Book in the WiamApp
          </a>
          <Link
            href={`/register?role=customer`}
            className="border border-white/25 text-white font-semibold text-sm px-6 py-3.5 rounded-lg text-center"
          >
            Create account to book
          </Link>
        </div>

        <p className="mt-8 text-white/30 text-xs">
          Deposits are held in escrow until the gig is confirmed. © 2026 WiamApp · Powered by WiamLabs
        </p>
      </div>
    </div>
  );
}
