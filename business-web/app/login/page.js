'use client';
// © 2026 WiamApp. Powered by WiamLabs
// app/login/page.js — Business portal login. Verifies the account
// is actually a Business role before granting access, since this
// portal must never be reachable by a regular customer or worker
// account even if they somehow guess the URL.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      // Verify this is actually a Business account — never let a
      // customer or worker account into the business portal, even
      // if their login credentials are otherwise valid.
      const { data: userRow, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (roleError || userRow?.role !== 'business') {
        await supabase.auth.signOut();
        throw new Error('This account is not registered as a Business. Apply for a Business account from the WiamApp mobile app first.');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err.message || 'Could not sign in. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center font-display font-extrabold text-navy text-base">W</div>
          <div>
            <div className="font-display font-bold text-white text-[15px]">WiamApp Business</div>
            <div className="text-[11px] text-white/45">wiamapp.com/business</div>
          </div>
        </div>

        <div className="bg-white rounded-card p-8">
          <h1 className="font-display text-xl font-bold text-ink mb-1">Sign in</h1>
          <p className="text-sm text-inkMuted mb-6">Manage your team, bookings, and billing.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm text-ink outline-none focus:border-gold"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm text-ink outline-none focus:border-gold"
                placeholder="••••••••"
              />
              <a href="/forgot-password" className="text-[12px] text-gold font-semibold mt-1.5 inline-block">
                Forgot password?
              </a>
            </div>

            {error && (
              <div className="text-[13px] text-red bg-redTint rounded-lg px-3 py-2.5">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold text-navy font-semibold text-sm rounded-lg py-3 mt-2 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-inkMuted mt-6">
            Don't have a Business account?{' '}
            <Link href="/apply" className="text-gold font-semibold">Apply here</Link>
            <br />
            <span className="text-[11px]">Prefer your phone? You can also apply from the WiamApp mobile app.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
