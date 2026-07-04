// © 2026 WiamApp. Powered by WiamLabs
// lib/api/quotes.js — Instant Quote System API calls for mobile app

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
 * Customer posts a job for quotes
 */
export async function postQuoteRequest({
  categoryId, title, description, photoUrls,
  locationAddress, preferredDate, budgetMinUsd, budgetMaxUsd,
}) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/quotes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      categoryId, title, description, photoUrls,
      locationAddress, preferredDate, budgetMinUsd, budgetMaxUsd,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Could not post your request.');
  return data.data;
}

/**
 * Get a single quote request's own details (job header info)
 */
export async function getQuoteRequest(requestId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/quotes/${requestId}`, { headers });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Quote request not found.');
  return data.data;
}

/**
 * Get every quote submitted on a request (customer view)
 */
export async function getQuotesForRequest(requestId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/quotes/${requestId}/quotes`, { headers });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Could not load quotes.');
  return data.data;
}

/**
 * Worker submits a quote on an open request
 */
export async function submitQuote(requestId, { priceUsd, timeline, message, availability }) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/quotes/${requestId}/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ priceUsd, timeline, message, availability }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Could not submit your quote.');
  return data.data;
}

/**
 * Customer accepts one quote — creates the booking
 */
export async function acceptQuote(requestId, quoteId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/quotes/${requestId}/select/${quoteId}`, {
    method: 'POST',
    headers,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Could not accept this quote.');
  return data.data;
}
