// © 2026 WiamApp. Powered by WiamLabs
// lib/api/notifications.js — In-app notifications

import { supabase } from '../supabase';

/**
 * Get all notifications for a user
 */
export async function getNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

/**
 * Count unread notifications
 */
export async function getUnreadNotificationCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

/**
 * Subscribe to real-time notifications for a user
 *
 * Example usage:
 *   const sub = subscribeToNotifications(userId, (notification) => {
 *     // show a toast or update badge count
 *   });
 *   return () => sub.unsubscribe();
 */
export function subscribeToNotifications(userId, onNewNotification) {
  // Unique channel name per subscriber — reusing `notifications:${userId}`
  // returns an already-subscribed channel when home + notifications screens
  // both subscribe, and `.on()` after `.subscribe()` crashes the app.
  const channel = supabase
    .channel(`notifications:${userId}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNewNotification(payload.new);
      }
    )
    .subscribe();

  return {
    unsubscribe() {
      supabase.removeChannel(channel);
    },
  };
}
