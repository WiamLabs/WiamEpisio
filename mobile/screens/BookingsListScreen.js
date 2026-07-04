// © 2026 WiamApp. Powered by WiamLabs
// screens/BookingsListScreen.js — PRODUCTION real Supabase data

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
import { getCustomerBookings } from '../lib/api/bookings';

const C    = Colors.light;
const GOLD = Colors.gold;
const NAVY = Colors.navy;

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: Colors.warning, bg: 'rgba(245,158,11,0.1)',  icon: 'time-outline' },
  accepted:    { label: 'Confirmed',   color: '#3B82F6',      bg: 'rgba(59,130,246,0.1)',  icon: 'checkmark-outline' },
  in_progress: { label: 'In Progress', color: GOLD,           bg: 'rgba(212,160,23,0.1)',  icon: 'construct-outline' },
  completed:   { label: 'Completed',   color: Colors.success, bg: 'rgba(34,197,94,0.1)',   icon: 'checkmark-circle-outline' },
  cancelled:   { label: 'Cancelled',   color: Colors.error,   bg: 'rgba(239,68,68,0.1)',   icon: 'close-circle-outline' },
  rejected:    { label: 'Declined',    color: Colors.error,   bg: 'rgba(239,68,68,0.1)',   icon: 'close-circle-outline' },
};

const TABS = ['All', 'Active', 'Completed', 'Cancelled'];

export default function BookingsListScreen({ navigation }) {
  const { user } = useAuth();
  const [bookings,   setBookings]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState('All');

  const load = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const data = await getCustomerBookings(user.id);
      setBookings(data || []);
    } catch (e) {
      console.warn('BookingsList error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [user?.id]));

  const filtered = bookings.filter(b => {
    if (activeTab === 'All')       return true;
    if (activeTab === 'Active')    return ['pending','accepted','in_progress'].includes(b.status);
    if (activeTab === 'Completed') return b.status === 'completed';
    if (activeTab === 'Cancelled') return ['cancelled','rejected'].includes(b.status);
    return true;
  });

  const renderItem = ({ item }) => {
    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const workerName = item.worker_profiles?.users?.full_name || 'Worker';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
      >
        <View style={styles.cardTop}>
          <View style={[styles.statusIcon, { backgroundColor: sc.bg }]}>
            <Ionicons name={sc.icon} size={20} color={sc.color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.service} numberOfLines={1}>{item.description}</Text>
            <View style={styles.workerNameRow}>
              <Ionicons name="person-outline" size={12} color={C.textSecondary} />
              <Text style={styles.workerName}>{workerName}</Text>
            </View>
            <Text style={styles.category}>{item.categories?.name || 'Service'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={styles.price}>GHS {item.agreed_price}</Text>
            <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={C.textSecondary} />
            <Text style={styles.metaText}>
              {new Date(item.scheduled_date).toLocaleDateString('en-GH', { day:'numeric', month:'short', year:'numeric' })}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={C.textSecondary} />
            <Text style={styles.metaText}>
              {new Date(item.scheduled_date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
            </Text>
          </View>
        </View>

        {item.location_address && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={C.textSecondary} />
            <Text style={styles.locationText} numberOfLines={1}>{item.location_address}</Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          {item.status === 'completed' && !item.review_id && (
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() => navigation.navigate('Review', { bookingId: item.id, workerName })}
            >
              <Ionicons name="star-outline" size={14} color={GOLD} />
              <Text style={styles.reviewBtnText}>Leave a Review</Text>
            </TouchableOpacity>
          )}
          {['accepted','in_progress'].includes(item.status) && (
            <TouchableOpacity
              style={styles.chatBtn}
              onPress={() => navigation.navigate('ChatRoom', { bookingId: item.id, workerName })}
            >
              <Ionicons name="chatbubble-outline" size={14} color={NAVY} />
              <Text style={styles.chatBtnText}>Message Worker</Text>
            </TouchableOpacity>
          )}
          <Ionicons name="chevron-forward" size={16} color={C.textSecondary} style={{ marginLeft: 'auto' }} />
        </View>
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
        <Text style={styles.title}>My Bookings</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GOLD} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={52} color={C.border} />
            <Text style={styles.emptyTitle}>No {activeTab.toLowerCase()} bookings</Text>
            <Text style={styles.emptyText}>Book a worker from the Home screen</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.emptyBtnText}>Find a Worker</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.background },
  header:         { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  title:          { fontSize: 22, fontWeight: '800', color: NAVY },
  tabs:           { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 14, gap: 8 },
  tab:            { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  tabActive:      { backgroundColor: NAVY, borderColor: NAVY },
  tabText:        { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
  tabTextActive:  { color: '#fff', fontWeight: '700' },
  list:           { padding: 20, gap: 12, paddingBottom: 40 },
  emptyContainer: { flex: 1 },
  empty:          { alignItems: 'center', justifyContent: 'center', paddingTop: 70, gap: 10 },
  emptyTitle:     { fontSize: 17, fontWeight: '700', color: C.textSecondary },
  emptyText:      { fontSize: 14, color: C.textSecondary },
  emptyBtn:       { backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 6 },
  emptyBtnText:   { color: NAVY, fontWeight: '700', fontSize: 14 },
  card:           { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  statusIcon:     { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo:       { flex: 1 },
  service:        { fontSize: 15, fontWeight: '700', color: NAVY },
  workerNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  workerName:     { fontSize: 13, color: C.textSecondary },
  category:       { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  price:          { fontSize: 15, fontWeight: '700', color: GOLD },
  statusPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:     { fontSize: 11, fontWeight: '700' },
  cardMeta:       { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaItem:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText:       { fontSize: 12, color: C.textSecondary },
  locationRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  locationText:   { fontSize: 12, color: C.textSecondary, flex: 1 },
  cardFooter:     { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginTop: 4 },
  reviewBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reviewBtnText:  { fontSize: 13, color: GOLD, fontWeight: '600' },
  chatBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(13,13,43,0.07)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chatBtnText:    { fontSize: 13, color: NAVY, fontWeight: '600' },
});
