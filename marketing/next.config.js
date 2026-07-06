/** © 2026 WiamApp. Powered by WiamLabs */
/** @type {import('next').NextConfig} */

// The Business portal (login/apply/dashboard) is a SEPARATE Next.js
// deploy (../business-web) — kept separate on purpose so a change to
// one never risks breaking the other. This rewrite makes it invisible
// to the browser: wiamapp.com/business/dashboard looks and feels like
// a normal page on this site, but the actual response is streamed
// from the business-web service behind the scenes. business-web sets
// basePath: '/business' in its own next.config.js so every route and
// static asset it generates already matches these rewrite targets.
//
// wiamapp.com/business itself (no further path) is NOT rewritten —
// it redirects to wiamlabs.com/wiamapp/business/pricing (see
// app/business/page.js). Only /business/apply, /login, /dashboard/*
// are proxied to business-web.
const BUSINESS_ORIGIN = process.env.BUSINESS_ORIGIN || 'http://localhost:3001';

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  async rewrites() {
    return [
      { source: '/business/login',            destination: `${BUSINESS_ORIGIN}/business/login` },
      { source: '/business/apply',             destination: `${BUSINESS_ORIGIN}/business/apply` },
      { source: '/business/dashboard',         destination: `${BUSINESS_ORIGIN}/business/dashboard` },
      { source: '/business/dashboard/:path*',  destination: `${BUSINESS_ORIGIN}/business/dashboard/:path*` },
      { source: '/business/_next/:path*',      destination: `${BUSINESS_ORIGIN}/business/_next/:path*` },
    ];
  },
};

module.exports = nextConfig;
