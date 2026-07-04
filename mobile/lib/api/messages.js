// © 2026 WiamApp. Powered by WiamLabs
// lib/api/messages.js — Real-time chat database calls

import { supabase } from '../supabase';

/**
 * Get all messages for a booking
 */
export async function getMessages(bookingId) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      users!messages_sender_id_fkey (
        full_name,
        avatar_url
      )
    `)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Send a text message
 */
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };
}

/**
 * Outgoing TEXT messages route through the backend (Section 5B) so
 * the AI moderation check runs BEFORE the message is ever visible
 * to the other party — this is the one deliberate exception to
 * "mobile calls Supabase directly," and is NOT a direct insert.
 * Incoming messages are still picked up via Realtime exactly as
 * before, since the backend's insert triggers the same
 * postgres_changes event regardless of who performed the write.
 */
export async function sendMessage({ bookingId, senderId, receiverId, text }) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/chat/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ bookingId, receiverId, text }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Could not send message.');
  return json.data;
}

/**
 * Send a voice message (URL from Cloudflare R2). Also routes
 * through the backend now — no AI text classification for voice,
 * but the same block-check and moderation-log consistency apply.
 */
export async function sendVoiceMessage({ bookingId, senderId, receiverId, voiceUrl }) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/chat/send-voice`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ bookingId, receiverId, voiceUrl }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Could not send voice message.');
  return json.data;
}

/**
 * Mark all messages as read
 */
export async function markMessagesAsRead(bookingId, userId) {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('booking_id', bookingId)
    .neq('sender_id', userId);

  if (error) throw error;
}

/**
 * Get all conversations for a user (inbox)
 * Returns one row per booking with the latest message
 */
export async function getConversations(userId) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      booking_id,
      message,
      voice_url,
      created_at,
      is_read,
      sender_id,
      bookings!inner (
        id,
        customer_id,
        worker_id,
        business_id,
        users!bookings_customer_id_fkey (full_name, avatar_url),
        worker_profiles (
          verified_badge, subscription_tier,
          users (full_name, avatar_url)
        )
      )
    `)
    .or(`bookings.customer_id.eq.${userId},bookings.worker_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Group by booking_id — keep only the latest message per conversation
  const seen = new Set();
  const conversations = [];
  for (const msg of data || []) {
    if (!seen.has(msg.booking_id)) {
      seen.add(msg.booking_id);
      conversations.push(msg);
    }
  }
  return conversations;
}

/**
 * Count unread messages for a user
 */
export async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

/**
 * Subscribe to real-time new messages in a booking
 * Call this in useEffect — unsubscribe on cleanup
 *
 * Example usage in a screen:
 *   useEffect(() => {
 *     const sub = subscribeToMessages(bookingId, (newMsg) => {
 *       setMessages(prev => [...prev, newMsg]);
 *     });
 *     return () => sub.unsubscribe();
 *   }, [bookingId]);
 */
export function subscribeToMessages(bookingId, onNewMessage) {
  return supabase
    .channel(`messages:${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `booking_id=eq.${bookingId}`,
      },
      (payload) => {
        onNewMessage(payload.new);
      }
    )
    .subscribe();
}
