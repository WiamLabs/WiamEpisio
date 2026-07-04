// © 2026 WiamApp. Powered by WiamLabs
// app/sitemap.js — Next.js auto-serves this at /sitemap.xml
// Business portal pages are intentionally excluded — they're
// behind login and shouldn't be indexed by search engines.

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const SITE_URL = 'https://wiamapp.com';

async function getWorkerIds() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/workers?limit=200`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const workers = Array.isArray(data) ? data : data.workers || [];
    return workers.map((w) => w.id).filter(Boolean);
  } catch {
    return [];
  }
}

export default async function sitemap() {
  const staticRoutes = [
    '', '/browse', '/register', '/premium', '/business', '/careers', '/contact', '/terms', '/privacy',
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));

  const workerIds = await getWorkerIds();
  const workerRoutes = workerIds.map((id) => ({
    url: `${SITE_URL}/workers/${id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [...staticRoutes, ...workerRoutes];
}
