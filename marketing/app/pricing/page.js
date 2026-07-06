// © 2026 WiamApp. Powered by WiamLabs
// app/pricing/page.js — alias for /premium. The mobile app and older
// docs still reference wiamapp.com/pricing; both routes land on the
// same central worker pricing page on wiamlabs.com.

import { redirect } from 'next/navigation';

export default function PricingPage() {
  redirect('https://wiamlabs.com/wiamapp/pricing');
}
