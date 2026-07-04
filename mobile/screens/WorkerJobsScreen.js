// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerJobsScreen.js — PRODUCTION real Supabase data

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
import { getWorkerBookings } from '../lib/api/bookings';

const NAVY  = Colors.navyDeep;
const NAVY2 = Colors.navyMid;
const GOLD  = Colors.gold;
const WHITE = Colors.white;
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER= 'rgba(255,255,255,0.09)';

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: Colors.warning, bg: 'rgba(245,158,11,0.15)' },
  accepted:    { label: 'Confirmed',   color: '#3B82F6',      bg: 'rgba(59,130,246,0.15)' },
  in_progress: { label: 'In Progress', color: GOLD,           bg: 'rgba(212,160,23,0.15)' },
  completed:   { label: 'Completed',   color: Colors.success, bg: 'rgba(34,197,94,0.15)'  },
  cancelled:   { label: 'Cancelled',   color: Colors.error,   bg: 'rgba(239,68,68,0.15)'  },
  rejected:    { label: 'Declined',    color: Colors.error,   bg: 'rgba(239,68,68,0.15)'  },
};

const TABS = ['All', 'Active', 'Completed', 'Cancelled'];

export default function WorkerJobsScreen({ navigation }) {
  const { profile } = useAuth();
  const [jobs,       setJobs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState('All');

  const load = async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const data = await getWorkerBookings(profile.id);
      setJobs(data || []);
    } catch (e) {
      console.warn('WorkerJobs load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [profile?.id]));

  const filtered = jobs.filter(j => {
    if (activeTab === 'All')       return true;
    if (activeTab === 'Active')    return j.status === 'pending' || j.status === 'accepted' || j.status === 'in_progress';
    if (activeTab === 'Completed') return j.status === 'completed';
    if (activeTab === 'Cancelled') return j.status === 'cancelled' || j.status === 'rejected';
    return true;
  });

  const totalEarned = jobs
    .filter(j => j.status === 'completed')
    .reduce((sum, j) => sum + (parseFloat(j.agreed_price) || 0), 0);

  const toJobDetail = (job) => navigation.navigate('JobDetail', { job: {
    id:          job.id,
    customer:    job.users?.full_name || 'Customer',
    phone:       job.users?.phone || '',
    service:     job.description,
    category:    job.categories?.name || '',
    location:    job.location_address,
    date:        new Date(job.scheduled_date).toDateString(),
    time:        new Date(job.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price:       `GHS ${job.agreed_price}`,
    status:      job.status,
    isEmergency: job.is_emergency || false,
    postedAt:    new Date(job.created_at).toLocaleString(),
    customerId:  job.customer_id,
  }});

  const renderItem = ({ item }) => {
    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    return (
      <TouchableOpacity style={styles.card} onPress={() => toJobDetail(item)}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.users?.full_name || 'C')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.customerName}>{item.users?.full_name || 'Customer'}</Text>
            <Text style={styles.service} numberOfLines={1}>{item.description}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={12} color={MUTED} />
              <Text style={styles.metaText}>
                {new Date(item.scheduled_date).toLocaleDateString()} · {new Date(item.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={styles.price}>GHS {item.agreed_price}</Text>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
            </View>
          </View>
        </View>
        {item.location_address && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={MUTED} />
            <Text style={styles.locationText} numberOfLines={1}>{item.location_address}</Text>
          </View>
        )}
        {item.status === 'completed' && (
          <View style={styles.completedFooter}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
            <Text style={styles.completedText}>Job completed · Payment released</Text>
          </View>
        )}
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
        <Text style={styles.headerTitle}>My Jobs</Text>
        <View style={styles.earningsBadge}>
          <Ionicons name="wallet-outline" size={14} color={NAVY} />
          <Text style={styles.earningsText}>GHS {Math.round(totalEarned)} earned</Text>
        </View>
      </View>

      <View style={styles.tabsRow}>
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
        ListHeaderComponent={<Text style={styles.count}>{filtered.length} job{filtered.length !== 1 ? 's' : ''}</Text>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={48} color="rgba(255,255,255,0.08)" />
            <Text style={styles.emptyTitle}>No {activeTab.toLowerCase()} jobs</Text>
            <Text style={styles.emptyText}>They will appear here once you receive requests</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: NAVY },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  headerTitle:    { fontSize: 20, fontWeight: '700', color: WHITE },
  earningsBadge:  { backgroundColor: GOLD, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  earningsText:   { color: NAVY, fontSize: 12, fontWeight: '600' },
  tabsRow:        { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 14, gap: 8 },
  tab:            { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' },
  tabActive:      { backgroundColor: GOLD, borderColor: GOLD },
  tabText:        { color: MUTED, fontSize: 13 },
  tabTextActive:  { color: NAVY, fontWeight: '700' },
  list:           { paddingHorizontal: 20, paddingBottom: 40 },
  emptyContainer: { flex: 1, paddingHorizontal: 20 },
  count:          { color: MUTED, fontSize: 13, marginBottom: 12, paddingHorizontal: 20 },
  empty:          { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyTitle:     { fontSize: 16, color: MUTED, fontWeight: '600' },
  emptyText:      { fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingHorizontal: 30 },
  card:           { backgroundColor: NAVY2, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  cardTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar:         { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(212,160,23,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 16, fontWeight: '700', color: GOLD },
  cardInfo:       { flex: 1 },
  customerName:   { fontSize: 14, fontWeight: '700', color: WHITE },
  service:        { fontSize: 12, color: MUTED, marginTop: 2 },
  metaRow:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText:       { fontSize: 11, color: MUTED },
  price:          { fontSize: 14, fontWeight: '700', color: GOLD },
  statusBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:     { fontSize: 11, fontWeight: '600' },
  locationRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8 },
  locationText:   { fontSize: 12, color: MUTED, flex: 1 },
  completedFooter:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8 },
  completedText:  { fontSize: 12, color: Colors.success },
});
