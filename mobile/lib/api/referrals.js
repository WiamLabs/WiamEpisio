// © 2026 WiamApp. Powered by WiamLabs
// lib/api/referrals.js — Referral system API calls for mobile app

import { supabase } from '../supabase';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };
}

/**
 * Get my referral code, share link, and referral history
 */
export async function getMyReferrals() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/referrals/me`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load referrals.');
  return data;
}

/**
 * Apply a referral code — call right after signup, before the
 * first screen the new user lands on
 */
export async function applyReferralCode(referralCode) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/referrals/apply`, {
    method: 'POST', headers,
    body: JSON.stringify({ referralCode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not apply referral code.');
  return data;
}
