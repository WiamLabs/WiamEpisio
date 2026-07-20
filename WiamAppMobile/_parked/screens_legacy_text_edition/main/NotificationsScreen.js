/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import apiClient from '../../api/client';
import {
  ChevronLeft, Bell, BookOpen, Heart, Users, Star,
  Coins, Megaphone, MessageSquare, Gift, CheckCheck, Trash2, Clock,
} from 'lucide-react-native';
import SkeletonLoader from '../../components/common/SkeletonLoader';

const ICON_MAP = {
  new_book: BookOpen, new_chapter: BookOpen, follow: Users,
  comment: MessageSquare, like: Heart, mention: Star,
  coins: Coins, gift: Gift, order_update: Coins, elite: Star,
  announcement: Megaphone, system: Bell, scheduled_publish: Clock,
};
const COLOR_MAP = {
  new_book: '#60a5fa', new_chapter: '#60a5fa', follow: '#a855f7',
  comment: '#4ade80', like: '#f87171', mention: '#fbbf24',
  coins: '#d4a843', gift: '#f472b6', order_update: '#4ade80', elite: '#d4a843',
  announcement: '#60a5fa', system: '#9ca3af', scheduled_publish: '#d4a843',
};

/**
 * Parse `/book/<id>` and `/book/<id>/read?ch=<n>` style links the server emits.
 * Earlier this used `link.split('/').pop()` which broke on the read variant
 * (it returned `read?ch=5` and Number(...) became NaN).
 */
const parseBookLink = (link) => {
  const m = link.match(/^\/book\/(\d+)(?:\/read)?(?:\?(.*))?$/);
  if (!m) return null;
  const bookId = Number(m[1]);
  if (!bookId) return null;
  const params = m[2] || '';
  const chMatch = params.match(/(?:^|&)ch=(\d+)/);
  return {
    bookId,
    chapterNumber: chMatch ? Number(chMatch[1]) : null,
  };
};

const parseCreatorLink = (link) => {
  const m = link.match(/^\/creator\/([^/?#]+)/);
  if (!m) return null;
  return { creatorId: m[1] };
};

const NotificationsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications');
      setNotifs(res.data.notifications || []);
    } catch {
      setNotifs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  const markRead = async (id) => {
    try { await apiClient.post(`/notifications/${id}/read`); } catch {}
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiClient.post('/notifications/mark-all-read');
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {} finally { setBusy(false); }
  };

  const clearAll = () => {
    Alert.alert(
      'Clear all notifications?',
      'This permanently removes every notification from your inbox.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            if (busy) return;
            setBusy(true);
            try {
              await apiClient.delete('/notifications/clear');
              setNotifs([]);
            } catch {} finally { setBusy(false); }
          },
        },
      ],
    );
  };

  const deleteOne = async (id) => {
    try { await apiClient.delete(`/notifications/${id}`); } catch {}
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  };

  const openNotificationLink = (item) => {
    const link = String(item?.link_url || '').trim();
    if (!link) return;

    const book = parseBookLink(link);
    if (book) {
      navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Home' } });
      return;
    }
    const creator = parseCreatorLink(link);
    if (creator) {
      navigation.navigate('CreatorProfile', { creatorId: creator.creatorId });
      return;
    }
    if (link.startsWith('/bulletin')) {
      navigation.navigate('Bulletin');
      return;
    }
    if (link.startsWith('/wallet') || link.startsWith('/payment/coins')) {
      navigation.navigate('Wallet');
      return;
    }
    if (link.startsWith('/dashboard')) {
      navigation.navigate('Main');
    }
  };

  const renderItem = ({ item }) => {
    const Icon = ICON_MAP[item.type] || Bell;
    const color = COLOR_MAP[item.type] || COLORS.textMuted;
    return (
      <TouchableOpacity
        style={[s.item, !item.is_read && s.unread]}
        onPress={() => { markRead(item.id); openNotificationLink(item); }}
        onLongPress={() => {
          Alert.alert(item.title || 'Notification', item.message || '', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteOne(item.id) },
          ]);
        }}
      >
        <View style={[s.iconWrap, { backgroundColor: color + '20' }]}>
          <Icon size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={2}>{item.title || item.message}</Text>
          {item.message && item.title ? (
            <Text style={s.body} numberOfLines={2}>{item.message}</Text>
          ) : null}
          <Text style={s.time}>{item.time_ago || ''}</Text>
        </View>
        {!item.is_read && <View style={s.dot} />}
      </TouchableOpacity>
    );
  };

  const hasUnread = notifs.some((n) => !n.is_read);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
        <View style={s.headerActions}>
          {hasUnread ? (
            <TouchableOpacity
              onPress={markAllRead}
              hitSlop={10}
              style={s.headerBtn}
              disabled={busy}
            >
              <CheckCheck size={18} color={COLORS.secondary} />
            </TouchableOpacity>
          ) : null}
          {notifs.length > 0 ? (
            <TouchableOpacity
              onPress={clearAll}
              hitSlop={10}
              style={s.headerBtn}
              disabled={busy}
            >
              <Trash2 size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {loading ? (
        <View style={{ marginTop: 16 }}><SkeletonLoader.ListItem count={6} /></View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.secondary}
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Bell size={48} color={COLORS.textMuted} />
              <Text style={s.emptyText}>No notifications yet</Text>
              <Text style={s.emptySub}>When something happens, you'll see it here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, flex: 1, marginLeft: 10 },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headerBtn: { padding: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  unread: { backgroundColor: 'rgba(212,168,67,0.04)' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 13, color: COLORS.text, lineHeight: 18, fontWeight: '600' },
  body: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17, marginTop: 2 },
  time: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.secondary },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textMuted, paddingHorizontal: 24, textAlign: 'center' },
});

export default NotificationsScreen;
