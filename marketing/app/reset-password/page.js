'use client';
// © 2026 WiamApp. Powered by WiamLabs
// app/reset-password/page.js — this is the exact URL backend's
// /api/auth/forgot-password sets as redirectTo. Supabase appends a
// recovery token to the URL hash; @supabase/ssr's client picks that
// up automatically and turns it into a real (temporary) session, so
// auth.updateUser() below just works without any manual token parsing.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // A PASSWORD_RECOVERY event fires once Supabase has parsed the
    // recovery token from the URL — only then is it safe to show the form.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setTimeout(() => router.push('/business/login'), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-14">
      {done ? (
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
          <h1 className="font-display text-2xl font-bold text-ink mb-2">Password updated</h1>
          <p className="text-inkMuted text-sm">Redirecting you to sign in…</p>
        </div>
      ) : !ready ? (
        <p className="text-inkMuted text-sm text-center">Verifying your reset link…</p>
      ) : (
        <>
          <h1 className="font-display text-2xl font-bold text-ink mb-1">Set a new password</h1>
          <p className="text-inkMuted text-sm mb-6">Choose a new password for your account.</p>
          <form onSubmit={submit} className="space-y-3">
            <input required type="password" placeholder="New password (min 8 characters)" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line rounded-lg px-4 py-3 text-sm" />
            <input required type="password" placeholder="Confirm new password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-line rounded-lg px-4 py-3 text-sm" />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-gold text-navy font-semibold text-sm px-6 py-3.5 rounded-lg disabled:opacity-60">
              {loading ? 'Saving…' : 'Update password'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
