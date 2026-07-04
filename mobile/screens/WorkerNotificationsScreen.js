// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerNotificationsScreen.js — PRODUCTION real Supabase data

import React, { useState, useEffect, useCallback } from 'react';
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

const NAVY  = Colors.navyDeep;
const NAVY2 = Colors.navyMid;
const GOLD  = Colors.gold;
const WHITE = Colors.white;
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER= 'rgba(255,255,255,0.09)';

const ICONS = {
  booking: { icon: 'briefcase-outline',          color: '#3B82F6' },
  payment: { icon: 'cash-outline',               color: Colors.success },
  review:  { icon: 'star-outline',               color: GOLD },
  message: { icon: 'chatbubble-outline',         color: GOLD },
  safety:  { icon: 'shield-outline',             color: Colors.error },
  system:  { icon: 'information-circle-outline', color: '#6B7280' },
};

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(dateStr).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
}

export default function WorkerNotificationsScreen({ navigation }) {
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
      console.warn('WorkerNotifs error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [user?.id]));

  useEffect(() => {
    if (!user?.id) return;
    const sub = subscribeToNotifications(user.id, (n) => setNotifs(prev => [n, ...prev]));
    return () => sub.unsubscribe();
  }, [user?.id]);

  const handlePress = async (notif) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id).catch(() => {});
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    const d = notif.data || {};
    if (notif.type === 'booking' && d.booking_id) {
      navigation.navigate('JobDetail', { job: { id: d.booking_id, status: 'pending' } });
    } else if (notif.type === 'message' && d.booking_id) {
      navigation.navigate('ChatRoom', { bookingId: d.booking_id });
    }
  };

  const unread = notifs.filter(n => !n.is_read).length;

  const renderItem = ({ item }) => {
    const cfg = ICONS[item.type] || ICONS.system;
    return (
      <TouchableOpacity
        style={[styles.card, !item.is_read && styles.cardUnread]}
        onPress={() => handlePress(item)}
      >
        <View style={[styles.iconBox, { backgroundColor: `${cfg.color}18` }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.nTitle, !item.is_read && { fontWeight: '700', color: WHITE }]}>{item.title}</Text>
          <Text style={styles.nBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.nTime}>{getTimeAgo(item.created_at)}</Text>
        </View>
        {!item.is_read && <View style={styles.dot} />}
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
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unread > 0 && (
          <TouchableOpacity
            onPress={async () => {
              await markAllNotificationsRead(user.id).catch(() => {});
              setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
            }}
          >
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {unread > 0 && (
        <View style={styles.unreadBanner}>
          <Ionicons name="notifications" size={15} color={NAVY} />
          <Text style={styles.unreadBannerText}>{unread} unread notification{unread !== 1 ? 's' : ''}</Text>
        </View>
      )}

      <FlatList
        data={notifs}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GOLD} />}
        contentContainerStyle={notifs.length === 0 ? styles.emptyContainer : { paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={52} color={MUTED} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>New job requests and updates will appear here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: NAVY },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  title:          { fontSize: 20, fontWeight: '700', color: WHITE },
  markAll:        { fontSize: 13, color: GOLD, fontWeight: '600' },
  unreadBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: GOLD, paddingHorizontal: 20, paddingVertical: 10 },
  unreadBannerText:{ fontSize: 13, color: NAVY, fontWeight: '700' },
  emptyContainer: { flex: 1 },
  empty:          { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle:     { fontSize: 16, color: MUTED, fontWeight: '600' },
  emptyText:      { fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingHorizontal: 40 },
  card:           { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  cardUnread:     { backgroundColor: 'rgba(212,160,23,0.05)' },
  iconBox:        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content:        { flex: 1 },
  nTitle:         { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 3 },
  nBody:          { fontSize: 13, color: MUTED, lineHeight: 19 },
  nTime:          { fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 5 },
  dot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD, marginTop: 4, flexShrink: 0 },
});
