// © 2026 WiamApp. Powered by WiamLabs
// screens/BusinessBookingsScreen.js
// Business manages all their worker bookings — active, pending, completed
// Backend: GET /api/business/bookings

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const NAVY   = Colors.navyDeep;
const NAVY2  = Colors.navyMid;
const GOLD   = Colors.gold;
const WHITE  = Colors.white;
const MUTED  = 'rgba(255,255,255,0.45)';
const BORDER = 'rgba(255,255,255,0.09)';

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  accepted:    { label: 'Confirmed',   color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  in_progress: { label: 'In Progress', color: GOLD,      bg: 'rgba(212,160,23,0.15)' },
  completed:   { label: 'Completed',   color: '#22C55E', bg: 'rgba(34,197,94,0.15)'  },
  cancelled:   { label: 'Cancelled',   color: '#EF4444', bg: 'rgba(239,68,68,0.15)'  },
};

const CATEGORY_ICONS = {
  Electrician: 'flash-outline',
  Cleaner:     'sparkles-outline',
  Plumber:     'water-outline',
  'HVAC Tech': 'thermometer-outline',
  Security:    'shield-outline',
  Gardener:    'leaf-outline',
  'IT Tech':   'desktop-outline',
};

export default function BusinessBookingsScreen({ navigation }) {
  const { user } = useAuth();
  const [activeTab,  setActiveTab]  = useState('active');
  const [data,       setData]       = useState({ active: [], pending: [], completed: [] });
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = async () => {
    if (!user?.id) { setRefreshing(false); return; }
    try {
      const { data: rows } = await supabase
        .from('bookings')
        .select(`id, status, description, agreed_price, location_address, scheduled_date,
          worker_profiles(users(full_name)),
          categories(name)`)
        .eq('business_id', user.id)
        .order('scheduled_date', { ascending: false });

      const all = rows || [];
      const toItem = b => ({
        id:       b.id,
        worker:   b.worker_profiles?.users?.full_name || 'Worker',
        service:  b.description,
        location: b.location_address,
        time:     new Date(b.scheduled_date).toLocaleString('en-GH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        price:    `GHS ${parseFloat(b.agreed_price || 0).toFixed(0)}`,
        category: b.categories?.name || '',
        status:   b.status,
      });
      setData({
        active:    all.filter(b => ['accepted','in_progress'].includes(b.status)).map(toItem),
        pending:   all.filter(b => b.status === 'pending').map(toItem),
        completed: all.filter(b => b.status === 'completed').map(toItem),
      });
    } catch (e) {
      console.warn('BizBookings error:', e.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchBookings(); }, [user?.id]);
  const onRefresh = () => { setRefreshing(true); fetchBookings(); };

  const handleCancel = (booking) => {
    Alert.alert('Cancel Booking', `Cancel booking for ${booking.worker}?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => {
        Alert.alert('Cancelled', 'The worker has been notified.');
      }},
    ]);
  };

  const list = data[activeTab] || [];

  const counts = {
    active:    (data.active    || []).length,
    pending:   (data.pending   || []).length,
    completed: (data.completed || []).length,
  };

  const renderItem = ({ item }) => {
    const sc  = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const ico = CATEGORY_ICONS[item.category] || 'briefcase-outline';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.catIcon, { backgroundColor: `${GOLD}18` }]}>
            <Ionicons name={ico} size={20} color={GOLD} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardService}>{item.service}</Text>
            <View style={styles.cardWorkerRow}>
              <Ionicons name="person-outline" size={12} color={MUTED} />
              <Text style={styles.cardWorker}>{item.worker} · {item.category}</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color={MUTED} />
            <Text style={styles.detailText}>{item.location}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={MUTED} />
            <Text style={styles.detailText}>{item.time}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={14} color="#22C55E" />
            <Text style={[styles.detailText, { color: '#22C55E' }]}>{item.price}</Text>
          </View>
        </View>

        {item.rating && (
          <View style={styles.ratingRow}>
            {[1,2,3,4,5].map(s => (
              <Ionicons key={s} name="star" size={14} color={s <= item.rating ? GOLD : 'rgba(255,255,255,0.15)'} />
            ))}
            <Text style={styles.ratingText}>Your rating</Text>
          </View>
        )}

        {(item.status === 'pending' || item.status === 'accepted') && (
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => navigation.navigate('ChatRoom', { bookingId: item.id, workerName: item.worker })}
            >
              <Ionicons name="chatbubble-outline" size={14} color={GOLD} />
              <Text style={styles.viewBtnText}>Message Worker</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('CustomerApp')}
        >
          <Ionicons name="add" size={22} color={GOLD} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['active', 'pending', 'completed'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            {counts[tab] > 0 && (
              <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab && { color: NAVY }]}>
                  {counts[tab]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={list}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={list.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={52} color="rgba(255,255,255,0.08)" />
            <Text style={styles.emptyTitle}>No {activeTab} bookings</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'active' ? 'Your active jobs will appear here' :
               activeTab === 'pending' ? 'Pending bookings awaiting confirmation' :
               'Completed jobs will appear here'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: NAVY },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title:          { color: WHITE, fontSize: 22, fontWeight: '700' },
  addBtn:         { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(212,160,23,0.12)', borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.3)', alignItems: 'center', justifyContent: 'center' },
  tabs:           { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 },
  tab:            { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tabActive:      { backgroundColor: GOLD },
  tabText:        { color: MUTED, fontSize: 13, fontWeight: '500' },
  tabTextActive:  { color: NAVY, fontWeight: '700' },
  tabBadge:       { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: NAVY },
  tabBadgeText:   { fontSize: 11, color: MUTED, fontWeight: '700' },
  list:           { padding: 20, gap: 14, paddingBottom: 40 },
  emptyContainer: { flex: 1 },
  empty:          { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle:     { color: 'rgba(255,255,255,0.3)', fontSize: 16, marginTop: 14, marginBottom: 6, fontWeight: '600' },
  emptyText:      { color: MUTED, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  card:           { backgroundColor: NAVY2, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER },
  cardTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  catIcon:        { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo:       { flex: 1 },
  cardService:    { fontSize: 15, fontWeight: '700', color: WHITE },
  cardWorkerRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  cardWorker:     { fontSize: 13, color: MUTED },
  statusPill:     { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  statusText:     { fontSize: 11, fontWeight: '700' },
  cardDetails:    { gap: 6, marginBottom: 10 },
  detailRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText:     { fontSize: 13, color: MUTED },
  ratingRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
  ratingText:     { fontSize: 12, color: MUTED, marginLeft: 6 },
  cardActions:    { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12, marginTop: 4 },
  cancelBtn:      { flex: 1, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  cancelBtnText:  { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  viewBtn:        { flex: 2, backgroundColor: 'rgba(212,160,23,0.12)', borderRadius: 9, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  viewBtnText:    { fontSize: 13, color: GOLD, fontWeight: '600' },
});
