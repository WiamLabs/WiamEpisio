// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerJobsScreen.js — Part 13 Worker Jobs

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import GoldAvatar from '../components/ui/GoldAvatar';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { getWorkerBookings } from '../lib/api/bookings';

const PAD = Colors.screenPad;

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     pill: 'pending' },
  accepted:    { label: 'Confirmed',   pill: 'active' },
  in_progress: { label: 'In Progress', pill: 'active' },
  completed:   { label: 'Completed',   pill: 'done' },
  cancelled:   { label: 'Cancelled',   pill: 'pending' },
  rejected:    { label: 'Declined',    pill: 'pending' },
};

const TABS = ['Pending', 'Active', 'Completed', 'Cancelled'];

function formatSchedule(dateStr) {
  const d = new Date(dateStr);
  const day = d.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
}

export default function WorkerJobsScreen({ navigation }) {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Pending');

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

  const pendingCount = jobs.filter((j) => j.status === 'pending').length;

  const filtered = jobs.filter((j) => {
    if (activeTab === 'Pending') return j.status === 'pending';
    if (activeTab === 'Active') return ['accepted', 'in_progress'].includes(j.status);
    if (activeTab === 'Completed') return j.status === 'completed';
    if (activeTab === 'Cancelled') return ['cancelled', 'rejected'].includes(j.status);
    return true;
  });

  const toJobDetail = (job) => navigation.navigate('JobDetail', { job: {
    id: job.id,
    customer: job.users?.full_name || 'Customer',
    phone: job.users?.phone || '',
    service: job.description,
    category: job.categories?.name || '',
    location: job.location_address,
    date: new Date(job.scheduled_date).toDateString(),
    time: new Date(job.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: `GHS ${job.agreed_price}`,
    status: job.status,
    isEmergency: job.is_emergency || false,
    postedAt: new Date(job.created_at).toLocaleString(),
    customerId: job.customer_id,
  }});

  const pillStyle = (pill) => {
    if (pill === 'active') return styles.statusActive;
    if (pill === 'done') return styles.statusDone;
    return styles.statusPending;
  };

  const renderItem = ({ item }) => {
    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const customerName = item.users?.full_name || 'Customer';
    const categoryName = item.categories?.name || 'Service';

    return (
      <TouchableOpacity style={styles.card} onPress={() => toJobDetail(item)} activeOpacity={0.9}>
        <View style={styles.cardTop}>
          <View style={styles.customerRow}>
            <GoldAvatar name={customerName} uri={item.users?.avatar_url} size={38} />
            <View>
              <Text style={styles.jobName}>{customerName}</Text>
              <Text style={styles.jobCategory}>{categoryName}</Text>
            </View>
          </View>
          <Text style={[styles.statusPill, pillStyle(sc.pill)]}>{sc.label}</Text>
        </View>

        {item.location_address ? (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={13} color={Colors.textFaint} />
            <Text style={styles.detailText} numberOfLines={1}>{item.location_address}</Text>
          </View>
        ) : null}

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textFaint} />
          <Text style={styles.detailText}>{formatSchedule(item.scheduled_date)}</Text>
        </View>

        <Text style={styles.jobPrice}>GHS {item.agreed_price}</Text>

        {item.status === 'pending' ? (
          <View style={styles.jobActions}>
            <TouchableOpacity style={styles.btnDecline} onPress={() => toJobDetail(item)}>
              <Text style={styles.btnDeclineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnAccept} onPress={() => toJobDetail(item)}>
              <Text style={styles.btnAcceptText}>Accept</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {['accepted', 'in_progress'].includes(item.status) ? (
          <View style={styles.jobActions}>
            <TouchableOpacity
              style={styles.btnChat}
              onPress={() => navigation.navigate('ChatRoom', {
                bookingId: item.id,
                workerName: customerName,
              })}
            >
              <Ionicons name="chatbubble-outline" size={15} color={Colors.white} />
              <Text style={styles.btnChatText}>Chat</Text>
            </TouchableOpacity>
            {item.status === 'in_progress' ? (
              <TouchableOpacity style={styles.btnComplete} onPress={() => toJobDetail(item)}>
                <Text style={styles.btnCompleteText}>Mark Complete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {item.status === 'completed' ? (
          <View style={styles.completedFooter}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
            <Text style={styles.completedText}>Job completed · Payment released</Text>
          </View>
        ) : null}
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
        <Text style={styles.pageTitle}>My Jobs</Text>
        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.gold}
          />
        }
        ListHeaderComponent={
          pendingCount > 0 && activeTab === 'Pending' ? (
            <View style={styles.urgentBanner}>
              <Ionicons name="time-outline" size={16} color={Colors.info} />
              <Text style={styles.urgentText}>
                <Text style={styles.urgentBold}>{pendingCount} request{pendingCount !== 1 ? 's' : ''}</Text>
                {' '}waiting — respond within 2 hours or they auto-decline.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={48} color={Colors.navyLine} />
            <Text style={styles.emptyTitle}>No {activeTab.toLowerCase()} jobs</Text>
            <Text style={styles.emptyText}>They will appear here once you receive requests</Text>
          </View>
        }
        ListFooterComponent={
          filtered.length > 0 ? (
            <Text style={styles.footer}>© 2026 WiamApp · Powered by WiamLabs</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  topFixed: { paddingHorizontal: PAD, paddingBottom: 12 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: Colors.white, marginTop: 4, marginBottom: 14 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Colors.navyCard,
  },
  tabActive: { backgroundColor: Colors.gold },
  tabText: { fontSize: 12.5, fontWeight: '500', color: '#B8B8CC' },
  tabTextActive: { color: Colors.navy, fontWeight: '700' },
  list: { paddingHorizontal: PAD, paddingBottom: 28 },
  emptyContainer: { flex: 1, paddingHorizontal: PAD },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
    marginBottom: 16,
    marginTop: 6,
  },
  urgentText: { flex: 1, fontSize: 12, color: '#8FB4F0', lineHeight: 18 },
  urgentBold: { color: Colors.info, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, color: Colors.textDim, fontWeight: '600' },
  emptyText: { fontSize: 13, color: Colors.textFaint, textAlign: 'center', paddingHorizontal: 30 },
  card: {
    borderRadius: 22,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyLine,
    padding: 16,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 },
  jobName: { fontSize: 13.5, fontWeight: '600', color: Colors.white },
  jobCategory: { fontSize: 11, color: Colors.textDim, marginTop: 1 },
  statusPill: { fontSize: 10, fontWeight: '700', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  statusPending: { backgroundColor: 'rgba(245,158,11,0.14)', color: Colors.warning },
  statusActive: { backgroundColor: 'rgba(59,130,246,0.14)', color: Colors.info },
  statusDone: { backgroundColor: 'rgba(34,197,94,0.14)', color: Colors.success },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  detailText: { fontSize: 12, color: '#B8B8CC', flex: 1 },
  jobPrice: { fontSize: 15, fontWeight: '700', color: Colors.gold, marginTop: 10 },
  jobActions: { flexDirection: 'row', gap: 9, marginTop: 13 },
  btnAccept: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    alignItems: 'center',
  },
  btnAcceptText: { fontSize: 12.5, fontWeight: '600', color: Colors.navy },
  btnDecline: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyLine,
    alignItems: 'center',
  },
  btnDeclineText: { fontSize: 12.5, fontWeight: '600', color: '#B8B8CC' },
  btnChat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.navySoft,
  },
  btnChatText: { fontSize: 12.5, fontWeight: '600', color: Colors.white },
  btnComplete: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: 'center',
  },
  btnCompleteText: { fontSize: 12.5, fontWeight: '600', color: '#08130B' },
  completedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.navyLine,
  },
  completedText: { fontSize: 12, color: Colors.success },
  footer: { textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingVertical: 12 },
});
