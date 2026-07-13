'use client';
// © 2026 WiamApp. Powered by WiamLabs
// components/SettingsManager.js

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-[21px] rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-gold' : 'bg-line'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-[17px] h-[17px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[15px]' : ''}`} />
    </button>
  );
}

export default function SettingsManager({ initialPrefs, userEmail }) {
  const router = useRouter();
  const supabase = createClient();

  const [prefs, setPrefs] = useState(initialPrefs);
  const [resetSent, setResetSent] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const savePref = async (key, value) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('user_settings')
        .upsert(
          { user_id: user.id, key, value: String(value), updated_at: new Date().toISOString() },
          { onConflict: 'user_id,key' }
        );
    } catch {
      // Revert on failure so the toggle never silently lies
      setPrefs(prev => ({ ...prev, [key]: !value }));
    }
  };

  const handlePasswordReset = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not send reset email.');
      }
      setResetSent(true);
    } catch (err) {
      alert(err.message || 'Could not send reset email.');
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('This permanently deletes your business account and team access. This cannot be undone. Continue?')) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${BACKEND_URL}/api/auth/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      });
      await supabase.auth.signOut();
      router.push('/login');
    } catch {
      setDeleting(false);
      alert('Could not delete account. Please contact support.');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[21px] font-bold text-ink">Settings</h1>
        <p className="text-[13px] text-inkMuted mt-1">Notifications, defaults, and account controls.</p>
      </div>

      <div className="text-xs font-bold tracking-wide uppercase text-inkFaint mb-2">Notifications</div>
      <div className="bg-white border border-line rounded-card mb-7">
        {[
          { key: 'notif_booking_requests', label: 'New booking requests', sub: 'When a worker accepts or declines a job' },
          { key: 'notif_team_activity', label: 'Team activity', sub: 'When a team member is added or removed' },
          { key: 'notif_billing_alerts', label: 'Billing alerts', sub: 'Failed payments and renewal reminders' },
          { key: 'notif_product_updates', label: 'Product updates', sub: 'New features and occasional tips' },
        ].map((row, i) => (
          <div key={row.key} className={`flex items-center justify-between gap-4 px-5 py-3.5 ${i > 0 ? 'border-t border-line' : ''}`}>
            <div>
              <div className="text-[13.5px] font-semibold">{row.label}</div>
              <div className="text-xs text-inkMuted mt-0.5">{row.sub}</div>
            </div>
            <Toggle checked={!!prefs[row.key]} onChange={(v) => savePref(row.key, v)} />
          </div>
        ))}
      </div>

      <div className="text-xs font-bold tracking-wide uppercase text-inkFaint mb-2">Team defaults</div>
      <div className="bg-white border border-line rounded-card mb-7">
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <div>
            <div className="text-[13.5px] font-semibold">Hide new team members from search by default</div>
            <div className="text-xs text-inkMuted mt-0.5">Newly invited workers stay private to you until you switch this off for them</div>
          </div>
          <Toggle checked={!!prefs.hide_new_members_default} onChange={(v) => savePref('hide_new_members_default', v)} />
        </div>
      </div>

      <div className="text-xs font-bold tracking-wide uppercase text-inkFaint mb-2">Account &amp; security</div>
      <div className="bg-white border border-line rounded-card mb-7">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-[13.5px] font-semibold">Password</div>
            <div className="text-xs text-inkMuted mt-0.5">{resetSent ? `Reset link sent to ${userEmail}` : 'Send yourself a password reset link'}</div>
          </div>
          <button onClick={handlePasswordReset} disabled={resetSent} className="border border-line text-ink font-semibold text-[12.5px] px-3.5 py-2 rounded-lg hover:border-gold disabled:opacity-50">
            {resetSent ? 'Sent' : 'Send reset link'}
          </button>
        </div>
      </div>

      <div className="text-xs font-bold tracking-wide uppercase text-inkFaint mb-2">Danger zone</div>
      <div className="bg-redTint border border-red/30 rounded-card p-4">
        <div className="text-[13.5px] font-semibold text-red mb-1">Deactivate account</div>
        <div className="text-xs text-inkMuted mb-3">Your team loses access immediately. Active bookings are not cancelled.</div>
        <button onClick={handleDeactivate} disabled={deleting} className="bg-red text-white font-semibold text-[13px] px-4 py-2.5 rounded-lg disabled:opacity-60">
          {deleting ? 'Deleting...' : 'Deactivate account'}
        </button>
      </div>
    </div>
  );
}
