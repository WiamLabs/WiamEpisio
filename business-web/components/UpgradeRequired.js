// © 2026 WiamApp. Powered by WiamLabs
// components/UpgradeRequired.js — shown instead of real content when
// a business's plan doesn't meet a feature's tier requirement.
// Visual design ported directly from the approved mockup's locked
// pages — same icon-in-navy-box, same tier pill, same copy pattern.

import Link from 'next/link';

export default function UpgradeRequired({ tier, title, description, icon }) {
  return (
    <div className="flex items-center justify-center min-h-[380px]">
      <div className="text-center max-w-[380px]">
        <div className="w-[52px] h-[52px] rounded-2xl bg-navy text-gold flex items-center justify-center mx-auto mb-4.5">
          {icon}
        </div>
        <div className="inline-block text-[11px] font-bold tracking-wide text-gold bg-navy px-2.5 py-1 rounded-md mb-3">
          {tier} plan
        </div>
        <h2 className="font-display text-lg font-bold mb-2">{title}</h2>
        <p className="text-[13px] text-inkMuted mb-5">{description}</p>
        <Link href="/dashboard/plans" className="inline-block bg-gold text-navy font-semibold text-sm rounded-lg px-5 py-2.5">
          View plans
        </Link>
      </div>
    </div>
  );
}
