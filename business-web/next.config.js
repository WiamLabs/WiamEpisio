/** © 2026 WiamApp. Powered by WiamLabs */
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Served at wiamapp.com/business/* via a rewrite proxy from the
  // marketing app (see marketing/next.config.js) — this makes every
  // route, redirect, and static asset in THIS app automatically
  // resolve under /business/... with zero per-page changes needed.
  basePath: '/business',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

module.exports = nextConfig;
