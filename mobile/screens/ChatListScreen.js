// © 2026 WiamApp. Powered by WiamLabs
// screens/ChatListScreen.js — Part 13 Chat list

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList,
  ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import GoldAvatar from '../components/ui/GoldAvatar';
import VerifiedBadge from '../components/VerifiedBadge';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { getConversations } from '../lib/api/messages';

const PAD = Colors.screenPad;

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d` : new Date(dateStr).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
}

export default function ChatListScreen({ navigation }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const data = await getConversations(user.id);
      setConversations(data || []);
    } catch (e) {
      console.warn('ChatList error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [user?.id]));

  const getOtherPerson = (conv) => {
    const booking = conv.bookings;
    if (!booking) return { name: 'Chat', avatarUrl: null, verifiedBadge: false };
    const isCustomer = booking.customer_id === user?.id;
    if (isCustomer) {
      return {
        name: booking.worker_profiles?.users?.full_name || 'Worker',
        avatarUrl: booking.worker_profiles?.users?.avatar_url,
        verifiedBadge: booking.worker_profiles?.verified_badge || false,
      };
    }
    return {
      name: booking.users?.full_name || 'Customer',
      avatarUrl: booking.users?.avatar_url,
      verifiedBadge: false,
    };
  };

  const unreadTotal = conversations.filter((c) => !c.is_read && c.sender_id !== user?.id).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((item) => {
      const other = getOtherPerson(item);
      return other.name.toLowerCase().includes(q);
    });
  }, [conversations, search, user?.id]);

  const renderItem = ({ item }) => {
    const other = getOtherPerson(item);
    const isUnread = !item.is_read && item.sender_id !== user?.id;
    const lastMsg = item.voice_url ? 'Voice message' : (item.message || '');
    const preview = item.sender_id === user?.id ? `You: ${lastMsg}` : lastMsg;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('ChatRoom', {
          bookingId: item.booking_id,
          workerName: other.name,
        })}
        activeOpacity={0.85}
      >
        <GoldAvatar name={other.name} uri={other.avatarUrl} size={50} />
        <View style={styles.info}>
          <View style={styles.infoTop}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, isUnread && styles.nameUnread]} numberOfLines={1}>
                {other.name}
              </Text>
              {other.verifiedBadge ? <VerifiedBadge color="blue" size={12} /> : null}
            </View>
            <Text style={styles.time}>{getTimeAgo(item.created_at)}</Text>
          </View>
          <Text style={[styles.lastMsg, isUnread && styles.lastMsgUnread]} numberOfLines={1}>
            {preview}
          </Text>
        </View>
        {isUnread ? <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>1</Text></View> : null}
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

      <View style={styles.topFixed}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Chat</Text>
          {unreadTotal > 0 ? (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadTotal}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={15} color={Colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations"
            placeholderTextColor={Colors.textFaint}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.booking_id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.gold}
          />
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={52} color={Colors.navyLine} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>Book a worker to start a conversation</Text>
          </View>
        }
        ListFooterComponent={
          filtered.length > 0 ? (
            <Text style={styles.footer}>© 2026 WiamApp · Powered by WiamLabs</Text>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  topFixed: { paddingHorizontal: PAD, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 12 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  headerBadge: {
    backgroundColor: Colors.gold,
    borderRadius: 999,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: { color: Colors.navy, fontSize: 12, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.navyCard,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.white },
  list: { paddingHorizontal: PAD, paddingBottom: 28 },
  emptyContainer: { flex: 1, paddingHorizontal: PAD },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textDim },
  emptyText: { fontSize: 14, color: Colors.textDim },
  separator: { height: 1, backgroundColor: Colors.navyLine, marginLeft: 66 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  info: { flex: 1, minWidth: 0 },
  infoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, marginRight: 8 },
  name: { fontSize: 14, fontWeight: '600', color: Colors.white, flexShrink: 1 },
  nameUnread: { fontWeight: '700' },
  time: { fontSize: 10.5, color: Colors.textFaint, flexShrink: 0 },
  lastMsg: { fontSize: 12.5, color: Colors.textDim },
  lastMsgUnread: { color: '#D3D3E2', fontWeight: '500' },
  unreadBadge: {
    backgroundColor: Colors.gold,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: { color: Colors.navy, fontSize: 10, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingVertical: 14 },
});
