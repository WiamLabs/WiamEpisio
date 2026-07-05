// © 2026 WiamApp. Powered by WiamLabs
// app/premium/page.js — this used to show its own hardcoded pricing
// (a second, conflicting source of truth from wiamlabs.com/wiamapp/pricing).
// All pricing for every WiamLabs product now lives in one place —
// this route just sends people there instead of duplicating it.

import { redirect } from 'next/navigation';

export default function PremiumPage() {
  redirect('https://wiamlabs.com/wiamapp/pricing');
}
