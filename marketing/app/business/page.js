// © 2026 WiamApp. Powered by WiamLabs
// app/business/page.js — this used to show its own hardcoded business
// pricing (a second source of truth from wiamlabs.com/wiamapp/business/pricing).
// All pricing for every WiamLabs product now lives in one place —
// this route just sends people there instead of duplicating it.
// /business/apply, /business/login, and /business/dashboard/* are
// unchanged — next.config.js rewrites those paths to business-web.

import { redirect } from 'next/navigation';

export default function BusinessPage() {
  redirect('https://wiamlabs.com/wiamapp/business/pricing');
}
