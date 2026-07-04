// © 2026 WiamApp. Powered by WiamLabs
// app/robots.js — Next.js auto-serves this at /robots.txt

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/business/dashboard', '/business/login', '/reset-password'],
      },
    ],
    sitemap: 'https://wiamapp.com/sitemap.xml',
  };
}
