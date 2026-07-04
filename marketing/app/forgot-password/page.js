'use client';
// © 2026 WiamApp. Powered by WiamLabs
// app/forgot-password/page.js — shared across ALL roles. A business
// logging in at /business/login, or anyone else, lands here. Not
// nested under /business on purpose: the reset flow itself has
// nothing business-specific about it, and Supabase's reset email
// redirect target is one fixed URL regardless of who clicked it.

import { useState } from 'react';
import Link from 'next/link';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send reset email.');
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-14">
      {!sent ? (
        <>
          <h1 className="font-display text-2xl font-bold text-ink mb-1">Reset your password</h1>
          <p className="text-inkMuted text-sm mb-6">
            Enter the email on your account and we'll send you a link to set a new password.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <input required type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-line rounded-lg px-4 py-3 text-sm" />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-gold text-navy font-semibold text-sm px-6 py-3.5 rounded-lg disabled:opacity-60">
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </>
      ) : (
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-4 text-2xl">✉️</div>
          <h1 className="font-display text-2xl font-bold text-ink mb-2">Check your email</h1>
          <p className="text-inkMuted text-sm">
            If an account exists for <strong>{email}</strong>, a reset link is on its way.
          </p>
        </div>
      )}
      <p className="text-xs text-inkMuted mt-8 text-center">
        <Link href="/business/login" className="text-gold">Back to business sign in</Link>
      </p>
    </div>
  );
}
