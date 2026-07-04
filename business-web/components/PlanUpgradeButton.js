'use client';
// © 2026 WiamApp. Powered by WiamLabs
// components/PlanUpgradeButton.js — calls the real subscription
// checkout initiator built in backend/routes/payments.js and
// redirects to Paystack's hosted page.

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function PlanUpgradeButton({ planKey, userEmail, className, children }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${BACKEND_URL}/api/payments/paystack/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ planKey, email: userEmail }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Could not start checkout.');

      window.location.href = json.authorizationUrl;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className={className}>
        {loading ? 'Redirecting...' : children}
      </button>
      {error && <p className="text-[11.5px] text-red mt-2">{error}</p>}
    </div>
  );
}
