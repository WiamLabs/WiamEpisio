// © 2026 WiamApp. Powered by WiamLabs
// screens/BookingDetailScreen.js
// Single booking — track status, chat, pay, confirm complete, review
// Backend: GET /api/bookings/:id

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import GoldAvatar from '../components/ui/GoldAvatar';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const PAD = Colors.screenPad;

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: Colors.warning, bg: 'rgba(245,158,11,0.14)' },
  accepted: { label: 'Accepted', color: Colors.info, bg: 'rgba(59,130,246,0.14)' },
  paid: { label: 'Paid', color: Colors.success, bg: 'rgba(34,197,94,0.14)' },
  active: { label: 'In Progress', color: '#8B5CF6', bg: 'rgba(139,92,246,0.14)' },
  completed: { label: 'Completed', color: Colors.success, bg: 'rgba(34,197,94,0.14)' },
  cancelled: { label: 'Cancelled', color: Colors.error, bg: 'rgba(239,68,68,0.14)' },
  disputed: { label: 'Disputed', color: Colors.error, bg: 'rgba(239,68,68,0.14)' },
};

const PROGRESS_STEPS = ['pending', 'accepted', 'paid', 'completed'];

function progressIndex(status) {
  if (status === 'active') return 2;
  const idx = PROGRESS_STEPS.indexOf(status);
  return idx >= 0 ? idx : 0;
}

export default function BookingDetailScreen({ navigation, route }) {
  const { bookingId } = route?.params || {};
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const fetchBooking = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/bookings/${bookingId}`);
      const data = await res.json();
      setBooking(data.data);
    } catch { /* empty */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchBooking(); }, [bookingId]);

  const handleConfirmComplete = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`${BACKEND}/api/bookings/${bookingId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchBooking();
      navigation.navigate('Review', { bookingId, workerName: booking?.worker_name });
    } catch (err) {
      alert(err.message);
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={s.safe}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
        <View style={s.errorWrap}>
          <Text style={s.errorText}>Booking not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const progIdx = progressIndex(booking.status);
  const progressLabels = ['Booked', 'Accepted', 'Paid', 'Done'];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Booking Detail</Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[s.statusPillText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchBooking(); }}
            tintColor={Colors.gold}
          />
        }
      >
        <TouchableOpacity
          style={s.workerMini}
          onPress={() => navigation.navigate('WorkerProfile', { workerId: booking.worker_id })}
          activeOpacity={0.8}
        >
          <GoldAvatar name={booking.worker_name} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={s.workerName}>{booking.worker_name}</Text>
            <Text style={s.workerRole}>{booking.category_name}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} />
        </TouchableOpacity>

        <View style={s.progressTrack}>
          {progressLabels.map((_, i) => (
            <React.Fragment key={i}>
              <View style={[s.progressDot, i <= progIdx && s.progressDotDone]} />
              {i < progressLabels.length - 1 ? (
                <View style={[s.progressStep, i < progIdx && s.progressStepDone]} />
              ) : null}
            </React.Fragment>
          ))}
        </View>
        <View style={s.progressLabels}>
          {progressLabels.map((label) => (
            <Text key={label} style={s.progressLabel}>{label}</Text>
          ))}
        </View>

        <Text style={s.sectionLabel}>Booking Details</Text>
        <View style={s.detailCard}>
          {[
            { icon: 'document-text-outline', label: 'Service description', value: booking.description },
            { icon: 'location-outline', label: 'Location', value: booking.address },
            { icon: 'calendar-outline', label: 'Scheduled for', value: `${booking.scheduled_date}, ${booking.scheduled_time}` },
            { icon: 'wallet-outline', label: 'Agreed price', value: booking.agreed_price_ghs ? `GHS ${booking.agreed_price_ghs}` : 'To be agreed in chat' },
            { icon: 'time-outline', label: 'Est. hours', value: `${booking.estimated_hours || '–'} hrs` },
            { icon: 'lock-closed-outline', label: 'Escrow status', value: booking.escrow_status || 'Not funded' },
            { icon: 'receipt-outline', label: 'Reference', value: booking.booking_ref },
          ].map((item, i, arr) => (
            <View key={item.label} style={[s.detailRow, i < arr.length - 1 && s.detailRowBorder]}>
              <Ionicons name={item.icon} size={15} color={Colors.gold} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.detailRowLabel}>{item.label}</Text>
                <Text style={s.detailRowValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {['paid', 'active', 'completed'].includes(booking.status) && (
          <TouchableOpacity
            style={s.linkRow}
            onPress={() => navigation.navigate('BookingPhotos', { bookingId })}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={16} color={Colors.gold} />
            <Text style={s.linkText}>Before / After Photos</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} />
          </TouchableOpacity>
        )}

        <View style={s.safetyCard}>
          <Ionicons name="shield-checkmark-outline" size={15} color={Colors.gold} />
          <Text style={s.safetyText}>
            Payment is held safely in escrow. Only released when you confirm the job is done right.
          </Text>
        </View>

        {['paid', 'active', 'completed'].includes(booking.status) && (
          <TouchableOpacity
            style={s.disputeLink}
            onPress={() => navigation.navigate('Dispute', { bookingId })}
            activeOpacity={0.7}
          >
            <Text style={s.disputeText}>Something wrong? Report an issue</Text>
          </TouchableOpacity>
        )}

        <Text style={s.footerCopy}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>

      <View style={s.actionBar}>
        {booking.status === 'accepted' && (
          <>
            <TouchableOpacity
              style={s.btnOutline}
              onPress={() => navigation.navigate('ChatRoom', { bookingId, workerName: booking.worker_name })}
            >
              <Text style={s.btnOutlineText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btnPrimary}
              onPress={() => navigation.navigate('Payment', {
                bookingId,
                amount: booking.agreed_price_ghs,
                workerName: booking.worker_name,
              })}
            >
              <Text style={s.btnPrimaryText}>Pay Now</Text>
            </TouchableOpacity>
          </>
        )}

        {(booking.status === 'paid' || booking.status === 'active') && (
          <>
            <TouchableOpacity
              style={s.btnOutline}
              onPress={() => navigation.navigate('ChatRoom', { bookingId, workerName: booking.worker_name })}
            >
              <Text style={s.btnOutlineText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSuccess} onPress={handleConfirmComplete} disabled={confirming}>
              {confirming ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={s.btnSuccessText}>Job Done — Release</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {booking.status === 'completed' && !booking.has_review && (
          <TouchableOpacity
            style={s.btnPrimary}
            onPress={() => navigation.navigate('Review', { bookingId, workerName: booking.worker_name })}
          >
            <Text style={s.btnPrimaryText}>Leave a Review</Text>
          </TouchableOpacity>
        )}

        {booking.status === 'pending' && (
          <Text style={s.waitingText}>Waiting for worker to accept your request</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },
  statusPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  statusPillText: { fontSize: 10.5, fontWeight: '700' },
  scroll: { paddingHorizontal: PAD, paddingBottom: 110 },
  workerMini: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 16, padding: 13, marginBottom: 18,
  },
  workerName: { fontSize: 14, fontWeight: '600', color: Colors.white },
  workerRole: { fontSize: 11.5, color: Colors.textDim, marginTop: 1 },
  progressTrack: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  progressDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.navyLine },
  progressDotDone: { backgroundColor: Colors.gold },
  progressStep: { flex: 1, height: 3, backgroundColor: Colors.navyLine },
  progressStepDone: { backgroundColor: Colors.gold },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 20 },
  progressLabel: { fontSize: 9, color: Colors.textFaint },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: Colors.textFaint,
    textTransform: 'uppercase', marginBottom: 10, marginLeft: 4,
  },
  detailCard: {
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 18, padding: 16, marginBottom: 16,
  },
  detailRow: { flexDirection: 'row', gap: 11, paddingVertical: 9 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.navyLine },
  detailRowLabel: { fontSize: 10.5, color: Colors.textFaint, marginBottom: 2 },
  detailRowValue: { fontSize: 13, color: Colors.white, fontWeight: '500', lineHeight: 18 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(212,160,23,0.08)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12,
  },
  linkText: { flex: 1, color: Colors.white, fontSize: 13, fontWeight: '600' },
  safetyCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    backgroundColor: 'rgba(212,160,23,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.2)', padding: 13,
  },
  safetyText: { color: Colors.textDim, fontSize: 12, lineHeight: 18, flex: 1 },
  disputeLink: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  disputeText: { color: Colors.textFaint, fontSize: 12 },
  footerCopy: { textAlign: 'center', fontSize: 10, color: '#3A3A56', marginTop: 16 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: Colors.textDim, fontSize: 15 },
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, alignItems: 'center',
    backgroundColor: Colors.navySoft, borderTopWidth: 1, borderTopColor: '#1C1C38',
    paddingHorizontal: PAD, paddingVertical: 16, minHeight: 88,
  },
  btnPrimary: {
    flex: 1, backgroundColor: Colors.gold, borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
  },
  btnPrimaryText: { color: Colors.navy, fontSize: 13, fontWeight: '600' },
  btnOutline: {
    flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.navyLine,
  },
  btnOutlineText: { color: '#C9C9DE', fontSize: 13, fontWeight: '600' },
  btnSuccess: {
    flex: 2, backgroundColor: Colors.success, borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
  },
  btnSuccessText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  waitingText: { flex: 1, textAlign: 'center', color: Colors.textDim, fontSize: 13 },
});
