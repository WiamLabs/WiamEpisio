// © 2026 WiamApp. Powered by WiamLabs
// screens/BookingsListScreen.js — Part 13 Customer Bookings

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
import { getCustomerBookings } from '../lib/api/bookings';

const PAD = Colors.screenPad;

const STATUS_CONFIG = {
  pending:     { label: 'Pending',               pill: 'pending' },
  accepted:    { label: 'Accepted',              pill: 'active' },
  in_progress: { label: 'Awaiting Confirmation',   pill: 'active' },
  completed:   { label: 'Completed',             pill: 'done' },
  cancelled:   { label: 'Cancelled',             pill: 'pending' },
  rejected:    { label: 'Declined',              pill: 'pending' },
};

const TABS = ['Ongoing', 'Completed', 'Cancelled'];

function progressStep(status) {
  if (status === 'pending') return 1;
  if (status === 'accepted') return 2;
  if (status === 'in_progress') return 3;
  if (status === 'completed') return 4;
  return 0;
}

function ProgressTrack({ status }) {
  const step = progressStep(status);
  if (!step || status === 'cancelled' || status === 'rejected') return null;
  const labels = ['Booked', 'Accepted', 'Paid', 'Done'];
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressDot, step > 0 && styles.progressDotDone]} />
        <View style={[styles.progressStep, step > 1 && styles.progressStepDone]} />
        <View style={[styles.progressDot, step > 1 && styles.progressDotDone]} />
        <View style={[styles.progressStep, step > 2 && styles.progressStepDone]} />
        <View style={[styles.progressDot, step > 2 && styles.progressDotDone]} />
        <View style={[styles.progressStep, step > 3 && styles.progressStepDone]} />
        <View style={[styles.progressDot, step > 3 && styles.progressDotDone]} />
      </View>
      <View style={styles.progressLabels}>
        {labels.map((l) => (
          <Text key={l} style={styles.progressLabel}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

function formatSchedule(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const dayLabel = isTomorrow
    ? 'Tomorrow'
    : d.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${dayLabel}, ${time}`;
}

export default function BookingsListScreen({ navigation }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Ongoing');

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

  const filtered = bookings.filter((b) => {
    if (activeTab === 'Ongoing') return ['pending', 'accepted', 'in_progress'].includes(b.status);
    if (activeTab === 'Completed') return b.status === 'completed';
    if (activeTab === 'Cancelled') return ['cancelled', 'rejected'].includes(b.status);
    return true;
  });

  const pillStyle = (pill) => {
    if (pill === 'active') return styles.statusActive;
    if (pill === 'done') return styles.statusDone;
    return styles.statusPending;
  };

  const renderItem = ({ item }) => {
    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const workerName = item.worker_profiles?.users?.full_name || 'Worker';
    const avatarUrl = item.worker_profiles?.users?.avatar_url;
    const categoryName = item.categories?.name || 'Service';
    const priceNote =
      item.status === 'pending'
        ? 'agreed price'
        : item.status === 'completed'
          ? 'payment released'
          : 'held in escrow after payment';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
        activeOpacity={0.9}
      >
        <View style={styles.cardTop}>
          <View style={styles.customerRow}>
            <GoldAvatar name={workerName} uri={avatarUrl} size={38} />
            <View>
              <Text style={styles.jobName}>{workerName}</Text>
              <Text style={styles.jobCategory}>{categoryName}</Text>
            </View>
          </View>
          <Text style={[styles.statusPill, pillStyle(sc.pill)]}>{sc.label}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textFaint} />
          <Text style={styles.detailText}>{formatSchedule(item.scheduled_date)}</Text>
        </View>

        {item.location_address ? (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={13} color={Colors.textFaint} />
            <Text style={styles.detailText} numberOfLines={1}>{item.location_address}</Text>
          </View>
        ) : null}

        <ProgressTrack status={item.status} />

        <Text style={styles.jobPrice}>GHS {item.agreed_price} · {priceNote}</Text>

        {item.status === 'pending' ? (
          <View style={styles.infoNote}>
            <Ionicons name="time-outline" size={12} color={Colors.textFaint} />
            <Text style={styles.infoNoteText}>
              Waiting for {workerName.split(' ')[0]} to accept — phone number reveals once accepted
            </Text>
          </View>
        ) : null}

        {['accepted', 'in_progress', 'completed'].includes(item.status) ? (
          <View style={styles.jobActions}>
            {['accepted', 'in_progress'].includes(item.status) ? (
              <TouchableOpacity
                style={styles.btnChat}
                onPress={() => navigation.navigate('ChatRoom', { bookingId: item.id, workerName })}
              >
                <Ionicons name="chatbubble-outline" size={15} color={Colors.white} />
                <Text style={styles.btnChatText}>Chat</Text>
              </TouchableOpacity>
            ) : null}
            {item.status === 'accepted' ? (
              <TouchableOpacity
                style={styles.btnPay}
                onPress={() => navigation.navigate('Payment', {
                  bookingId: item.id,
                  amount: item.agreed_price,
                  workerName,
                })}
              >
                <Text style={styles.btnPayText}>Pay Now</Text>
              </TouchableOpacity>
            ) : null}
            {item.status === 'in_progress' ? (
              <TouchableOpacity
                style={styles.btnConfirm}
                onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
              >
                <Text style={styles.btnConfirmText}>Confirm Job Done</Text>
              </TouchableOpacity>
            ) : null}
            {item.status === 'completed' && !item.review_id ? (
              <TouchableOpacity
                style={styles.btnPay}
                onPress={() => navigation.navigate('Review', { bookingId: item.id, workerName })}
              >
                <Text style={styles.btnPayText}>Leave Review</Text>
              </TouchableOpacity>
            ) : null}
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
        <Text style={styles.pageTitle}>My Bookings</Text>
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
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={52} color={Colors.navyLine} />
            <Text style={styles.emptyTitle}>No {activeTab.toLowerCase()} bookings</Text>
            <Text style={styles.emptyText}>Book a worker from the Home screen</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.emptyBtnText}>Find a Worker</Text>
            </TouchableOpacity>
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
  tabs: { flexDirection: 'row', gap: 8 },
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
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 70, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textDim },
  emptyText: { fontSize: 14, color: Colors.textDim },
  emptyBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 6,
  },
  emptyBtnText: { color: Colors.navy, fontWeight: '700', fontSize: 14 },
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
  progressWrap: { marginTop: 14, marginBottom: 4 },
  progressTrack: { flexDirection: 'row', alignItems: 'center' },
  progressStep: { flex: 1, height: 3, backgroundColor: Colors.navyLine },
  progressStepDone: { backgroundColor: Colors.gold },
  progressDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: Colors.navyLine },
  progressDotDone: { backgroundColor: Colors.gold },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: 9, color: Colors.textFaint },
  jobPrice: { fontSize: 15, fontWeight: '700', color: Colors.gold, marginTop: 10 },
  infoNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  infoNoteText: { fontSize: 11, color: Colors.textFaint, flex: 1, lineHeight: 16 },
  jobActions: { flexDirection: 'row', gap: 9, marginTop: 13 },
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
  btnPay: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPayText: { fontSize: 12.5, fontWeight: '600', color: Colors.navy },
  btnConfirm: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirmText: { fontSize: 12.5, fontWeight: '600', color: '#08130B' },
  footer: { textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingVertical: 12 },
});
