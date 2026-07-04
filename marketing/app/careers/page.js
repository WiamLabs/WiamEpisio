// © 2026 WiamApp. Powered by WiamLabs
// app/careers/page.js — server renders position list (SEO), client
// component handles the application form.

import CareersClient from '@/components/CareersClient';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export const metadata = {
  title: 'Careers — Join WiamApp',
  description: 'Help build the platform connecting verified workers with customers across Ghana and beyond. See open roles.',
};

async function getPositions() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/careers`, { next: { revalidate: 3600 } });
    if (!res.ok) return { data: [], grouped: {} };
    return await res.json();
  } catch {
    return { data: [], grouped: {} };
  }
}

export default async function CareersPage() {
  const { data: positions, grouped } = await getPositions();

  return (
    <div>
      <section className="bg-navy py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-4">
            Build WiamApp with us
          </h1>
          <p className="text-white/65 text-[15px] leading-relaxed">
            We're a small, fast-moving team building the trust layer for the informal services economy in Ghana and beyond. Every role matters — there's no filler work here.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-14">
        {positions.length === 0 ? (
          <div className="border border-line rounded-card py-16 text-center">
            <p className="text-[14px] text-inkMuted mb-2">No open roles right now.</p>
            <p className="text-[13px] text-inkFaint">We're always interested in great people — email us at <a href="mailto:careers@wiamapp.com" className="text-gold">careers@wiamapp.com</a></p>
          </div>
        ) : (
          Object.entries(grouped).map(([department, deptPositions]) => (
            <div key={department} className="mb-10">
              <h2 className="font-display text-lg font-bold text-ink mb-4">{department}</h2>
              <div className="space-y-3">
                {deptPositions.map((pos) => (
                  <CareersClient key={pos.id} position={pos} backendUrl={BACKEND_URL} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
