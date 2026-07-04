// © 2026 WiamApp. Powered by WiamLabs
// lib/api/trust.js — Trust and Follow API calls for mobile app

import { supabase } from '../supabase';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// ─── HELPER ──────────────────────────────────────────────────
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };
}

// ─── WORKER TRUST ─────────────────────────────────────────────

/**
 * Trust a worker (customer action)
 * Button: [+ Trust] → [❤️ Trusted]
 */
export async function trustWorker(workerProfileId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/trust/worker/${workerProfileId}`, {
    method: 'POST', headers,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

/**
 * Remove trust from a worker
 * Button: [❤️ Trusted] → [+ Trust]
 */
export async function untrustWorker(workerProfileId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/trust/worker/${workerProfileId}`, {
    method: 'DELETE', headers,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

/**
 * Check if current customer trusts a specific worker
 * Returns: { trusted: true/false }
 */
export async function checkIfTrusted(workerProfileId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/trust/worker/${workerProfileId}`, {
    method: 'GET', headers,
  });
  const data = await res.json();
  return data.data?.trusted || false;
}

/**
 * Get trust count for a worker
 * Returns: { count: 327 }
 */
export async function getWorkerTrustCount(workerProfileId) {
  const res = await fetch(`${BACKEND_URL}/api/trust/worker/${workerProfileId}/count`);
  const data = await res.json();
  return data.data?.count || 0;
}

/**
 * Get all workers the current customer has trusted (Saved Workers)
 */
export async function getMyTrustedWorkers() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/trust/my-trusted-workers`, {
    method: 'GET', headers,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

/**
 * Worker sees who trusts them (dashboard)
 */
export async function getMyTrustList() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/trust/my-trust-list`, {
    method: 'GET', headers,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

// ─── BUSINESS FOLLOW ─────────────────────────────────────────

/**
 * Follow a business (customer action)
 * Button: [+ Follow Business] → [✓ Following]
 */
export async function followBusiness(businessId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/trust/business/${businessId}`, {
    method: 'POST', headers,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

/**
 * Unfollow a business
 */
export async function unfollowBusiness(businessId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/trust/business/${businessId}`, {
    method: 'DELETE', headers,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

/**
 * Check if customer follows a business
 */
export async function checkIfFollowing(businessId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/trust/business/${businessId}`, {
    method: 'GET', headers,
  });
  const data = await res.json();
  return data.data?.following || false;
}

/**
 * Get all businesses the current customer follows
 */
export async function getMyFollowedBusinesses() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/trust/my-followed-businesses`, {
    method: 'GET', headers,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}
