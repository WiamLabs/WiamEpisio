// © 2026 WiamApp. Powered by WiamLabs
// screens/ChatListScreen.js — PRODUCTION real Supabase conversations

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
import { getConversations } from '../lib/api/messages';
import VerifiedBadge from '../components/VerifiedBadge';

const C    = Colors.light;
const GOLD = Colors.gold;
const NAVY = Colors.navy;

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d` : new Date(dateStr).toLocaleDateString('en-GH', { day:'numeric', month:'short' });
}

export default function ChatListScreen({ navigation }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    if (!booking) return { name: 'Chat', avatarUrl: null, verifiedBadge: false, subscriptionTier: null };
    const isCustomer = booking.customer_id === user?.id;
    if (isCustomer) {
      // Customers never have a Checkmark badge (Section 4B is
      // worker/business only), so only the worker side carries it.
      return {
        name: booking.worker_profiles?.users?.full_name || 'Worker',
        avatarUrl: booking.worker_profiles?.users?.avatar_url,
        verifiedBadge: booking.worker_profiles?.verified_badge || false,
        subscriptionTier: booking.worker_profiles?.subscription_tier || null,
      };
    }
    return {
      name: booking.users?.full_name || 'Customer',
      avatarUrl: booking.users?.avatar_url,
      verifiedBadge: false,
      subscriptionTier: null,
    };
  };

  const renderItem = ({ item }) => {
    const other     = getOtherPerson(item);
    const isUnread  = !item.is_read && item.sender_id !== user?.id;
    const lastMsg   = item.voice_url ? 'Voice message' : item.message;

    return (
      <TouchableOpacity
        style={[styles.row, isUnread && styles.rowUnread]}
        onPress={() => navigation.navigate('ChatRoom', {
          bookingId:  item.booking_id,
          workerName: other.name,
        })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(other.name || 'C')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.infoTop}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, isUnread && { fontWeight: '700' }]} numberOfLines={1}>{other.name}</Text>
              {other.verifiedBadge && <VerifiedBadge color="blue" size={12} />}
            </View>
            <Text style={styles.time}>{getTimeAgo(item.created_at)}</Text>
          </View>
          <Text style={[styles.lastMsg, isUnread && { color: NAVY, fontWeight: '600' }]} numberOfLines={1}>
            {item.sender_id === user?.id ? `You: ${lastMsg}` : lastMsg}
          </Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
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
        <Text style={styles.title}>Messages</Text>
        {conversations.filter(c => !c.is_read && c.sender_id !== user?.id).length > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {conversations.filter(c => !c.is_read && c.sender_id !== user?.id).length}
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={conversations}
        keyExtractor={i => i.booking_id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GOLD} />}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={52} color={C.border} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>Book a worker to start a conversation</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.background },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  title:          { fontSize: 22, fontWeight: '800', color: NAVY },
  unreadBadge:    { backgroundColor: Colors.error, borderRadius: 12, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadBadgeText:{ color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyContainer: { flex: 1 },
  empty:          { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle:     { fontSize: 17, fontWeight: '700', color: C.textSecondary },
  emptyText:      { fontSize: 14, color: C.textSecondary },
  separator:      { height: 1, backgroundColor: C.border, marginLeft: 82 },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  rowUnread:      { backgroundColor: 'rgba(212,160,23,0.04)' },
  avatar:         { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(212,160,23,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:     { fontSize: 20, fontWeight: '700', color: GOLD },
  info:           { flex: 1 },
  infoTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nameRow:        { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, marginRight: 8 },
  name:           { fontSize: 15, color: NAVY, fontWeight: '500', flexShrink: 1 },
  time:           { fontSize: 12, color: C.textSecondary },
  lastMsg:        { fontSize: 13, color: C.textSecondary },
  unreadDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD, flexShrink: 0 },
});
