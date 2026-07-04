// © 2026 WiamApp. Powered by WiamLabs
// app/not-found.js

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="font-display text-6xl font-extrabold text-navy mb-3">404</div>
        <h1 className="font-display text-xl font-bold text-ink mb-2">Page not found</h1>
        <p className="text-[13.5px] text-inkMuted mb-7">The page you're looking for doesn't exist or has moved.</p>
        <Link href="/" className="inline-block bg-gold text-navy font-semibold text-sm px-5 py-3 rounded-lg">
          Back to home
        </Link>
      </div>
    </div>
  );
}
