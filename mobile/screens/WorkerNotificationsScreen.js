// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerNotificationsScreen.js — Part 13 Worker Notifications

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

const PAD = Colors.screenPad;

const ICONS = {
  booking: { icon: 'briefcase-outline',          color: Colors.info,    style: 'info' },
  payment: { icon: 'cash-outline',               color: Colors.success, style: 'success' },
  review:  { icon: 'star-outline',               color: Colors.gold,    style: 'gold' },
  message: { icon: 'chatbubble-outline',         color: Colors.gold,    style: 'gold' },
  safety:  { icon: 'shield-outline',             color: Colors.error,   style: 'warning' },
  system:  { icon: 'information-circle-outline', color: Colors.info,    style: 'info' },
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

function getDayLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'short' });
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

  const sections = useMemo(() => {
    const groups = [];
    let lastLabel = null;
    notifs.forEach((item) => {
      const label = getDayLabel(item.created_at);
      if (label !== lastLabel) {
        groups.push({ type: 'header', id: `h-${label}`, label });
        lastLabel = label;
      }
      groups.push({ type: 'item', ...item });
    });
    return groups;
  }, [notifs]);

  const iconBg = (style) => ({
    success: 'rgba(34,197,94,0.14)',
    warning: 'rgba(245,158,11,0.14)',
    info:    'rgba(59,130,246,0.14)',
    gold:    'rgba(212,160,23,0.14)',
  }[style] || 'rgba(59,130,246,0.14)');

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return <Text style={styles.dayLabel}>{item.label}</Text>;
    }

    const cfg = ICONS[item.type] || ICONS.system;
    return (
      <TouchableOpacity
        style={[styles.notifRow, !item.is_read && styles.notifRowUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.iconBox, { backgroundColor: iconBg(cfg.style) }]}>
          <Ionicons name={cfg.icon} size={18} color={cfg.color} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.nTitle, !item.is_read && styles.nTitleUnread]}>{item.title}</Text>
          <Text style={styles.nBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.nTime}>{getTimeAgo(item.created_at)}</Text>
        </View>
        {!item.is_read && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

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
          <Ionicons name="notifications" size={15} color={Colors.navy} />
          <Text style={styles.unreadBannerText}>{unread} unread notification{unread !== 1 ? 's' : ''}</Text>
        </View>
      )}

      <FlatList
        data={sections}
        keyExtractor={(i) => i.id || i.type + i.label}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.gold} />}
        contentContainerStyle={notifs.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={52} color={Colors.navyLine} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>New job requests and updates will appear here</Text>
          </View>
        }
        ListFooterComponent={
          notifs.length > 0 ? (
            <Text style={styles.footer}>© 2026 WiamApp · Powered by WiamLabs</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.navy },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 8 },
  title:          { fontSize: 20, fontWeight: '700', color: Colors.white },
  markAll:        { fontSize: 12, color: Colors.gold, fontWeight: '500' },
  unreadBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.gold, paddingHorizontal: PAD, paddingVertical: 10 },
  unreadBannerText:{ fontSize: 13, color: Colors.navy, fontWeight: '700' },
  list:           { paddingHorizontal: PAD, paddingBottom: 40 },
  emptyContainer: { flex: 1 },
  empty:          { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle:     { fontSize: 16, color: Colors.textDim, fontWeight: '600' },
  emptyText:      { fontSize: 13, color: Colors.textDim, textAlign: 'center', paddingHorizontal: 40 },
  dayLabel:       { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: Colors.textFaint, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, marginLeft: 4 },
  notifRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 13, borderRadius: 18, marginBottom: 8, position: 'relative' },
  notifRowUnread: { backgroundColor: Colors.navyCard },
  iconBox:        { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content:        { flex: 1, minWidth: 0 },
  nTitle:         { fontSize: 13, fontWeight: '600', color: Colors.white, lineHeight: 18 },
  nTitleUnread:   { fontWeight: '700' },
  nBody:          { fontSize: 12, color: Colors.textDim, lineHeight: 17, marginTop: 3 },
  nTime:          { fontSize: 10.5, color: Colors.textFaint, marginTop: 5 },
  dot:            { position: 'absolute', top: 14, right: 12, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.gold },
  footer:         { textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingVertical: 18 },
});
