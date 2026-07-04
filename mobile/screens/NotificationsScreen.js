// © 2026 WiamApp. Powered by WiamLabs
// screens/NotificationsScreen.js — PRODUCTION real Supabase data

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead, subscribeToNotifications } from '../lib/api/notifications';

const C    = Colors.light;
const GOLD = Colors.gold;
const NAVY = Colors.navy;

const NOTIF_ICONS = {
  booking:  { icon: 'briefcase-outline',        color: '#3B82F6' },
  payment:  { icon: 'cash-outline',             color: Colors.success },
  review:   { icon: 'star-outline',             color: GOLD },
  message:  { icon: 'chatbubble-outline',       color: Colors.navy },
  safety:   { icon: 'shield-outline',           color: Colors.error },
  system:   { icon: 'information-circle-outline', color: '#6B7280' },
};

export default function NotificationsScreen({ navigation }) {
  const { user } = useAuth();
  const [notifs,     setNotifs]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const data = await getNotifications(user.id);
      setNotifs(data || []);
    } catch (e) {
      console.warn('Notifications load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [user?.id]));

  // Real-time new notifications
  React.useEffect(() => {
    if (!user?.id) return;
    const sub = subscribeToNotifications(user.id, (newNotif) => {
      setNotifs(prev => [newNotif, ...prev]);
    });
    return () => sub.unsubscribe();
  }, [user?.id]);

  const handlePress = async (notif) => {
    // Mark as read
    if (!notif.is_read) {
      await markNotificationRead(notif.id).catch(() => {});
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    // Navigate based on type
    const data = notif.data || {};
    if (notif.type === 'booking' && data.booking_id) {
      navigation.navigate('BookingDetail', { bookingId: data.booking_id });
    } else if (notif.type === 'message' && data.booking_id) {
      navigation.navigate('ChatRoom', { bookingId: data.booking_id });
    } else if (notif.type === 'payment' && data.booking_id) {
      navigation.navigate('BookingDetail', { bookingId: data.booking_id });
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(user.id).catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  const renderItem = ({ item }) => {
    const config = NOTIF_ICONS[item.type] || NOTIF_ICONS.system;
    const timeAgo = getTimeAgo(item.created_at);

    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
        onPress={() => handlePress(item)}
      >
        <View style={[styles.notifIcon, { backgroundColor: `${config.color}15` }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, !item.is_read && { fontWeight: '700' }]}>{item.title}</Text>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.notifTime}>{timeAgo}</Text>
        </View>
        {!item.is_read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={GOLD} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifs}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GOLD} />}
        contentContainerStyle={notifs.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={52} color={C.border} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>You'll see booking updates and messages here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: C.background },
  header:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 12 },
  backBtn:           { padding: 4 },
  title:             { flex: 1, fontSize: 20, fontWeight: '700', color: NAVY },
  markAllText:       { fontSize: 13, color: GOLD, fontWeight: '600' },
  list:              { paddingBottom: 40 },
  emptyContainer:    { flex: 1 },
  empty:             { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle:        { fontSize: 16, fontWeight: '600', color: C.textSecondary },
  emptyText:         { fontSize: 13, color: C.textSecondary, textAlign: 'center', paddingHorizontal: 30 },
  notifCard:         { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  notifCardUnread:   { backgroundColor: 'rgba(212,160,23,0.04)' },
  notifIcon:         { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifContent:      { flex: 1 },
  notifTitle:        { fontSize: 14, fontWeight: '500', color: NAVY, marginBottom: 3 },
  notifBody:         { fontSize: 13, color: C.textSecondary, lineHeight: 19 },
  notifTime:         { fontSize: 11, color: C.textSecondary, marginTop: 5 },
  unreadDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD, marginTop: 4, flexShrink: 0 },
});
