// © 2026 WiamApp. Powered by WiamLabs
// lib/api/disputes.js — Dispute filing + before/after booking photos

import { supabase } from '../supabase';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

async function authHeaders(withJson = true) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { Authorization: `Bearer ${session?.access_token}` };
  if (withJson) headers['Content-Type'] = 'application/json';
  return headers;
}

// ─── DISPUTES ────────────────────────────────────────────────

export async function fileDispute({ bookingId, reason, description }) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/disputes`, {
    method: 'POST', headers,
    body: JSON.stringify({ bookingId, reason, description }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not file dispute.');
  return data;
}

export async function uploadDisputeEvidence(disputeId, fileUri) {
  const headers = await authHeaders(false);
  const formData = new FormData();
  formData.append('file', { uri: fileUri, name: 'evidence.jpg', type: 'image/jpeg' });
  const res = await fetch(`${BACKEND_URL}/api/disputes/${disputeId}/evidence`, {
    method: 'POST', headers, body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not upload evidence.');
  return data;
}

export async function getDisputesForBooking(bookingId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/disputes/booking/${bookingId}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load disputes.');
  return data;
}

export async function getMyDisputes() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/disputes/my-disputes`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load your disputes.');
  return data;
}

// ─── BEFORE / AFTER PHOTOS ──────────────────────────────────

export async function uploadBookingPhoto(bookingId, phase, fileUri) {
  const headers = await authHeaders(false);
  const formData = new FormData();
  formData.append('phase', phase);
  formData.append('file', { uri: fileUri, name: `${phase}.jpg`, type: 'image/jpeg' });
  const res = await fetch(`${BACKEND_URL}/api/bookings/${bookingId}/photos`, {
    method: 'POST', headers, body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not upload photo.');
  return data;
}

export async function getBookingPhotos(bookingId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/bookings/${bookingId}/photos`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load photos.');
  return data;
}

// ─── SCHEDULE CONFIRMATION ───────────────────────────────────

export async function confirmScheduledSlot(bookingId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/bookings/${bookingId}/schedule-confirm`, {
    method: 'PATCH', headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not confirm appointment.');
  return data;
}

// ─── CUSTOMER TRUST SCORE (worker-facing) ────────────────────

export async function getCustomerTrustScore(customerId) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/trust/customer/${customerId}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load customer trust score.');
  return data;
}
