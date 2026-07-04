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

const BG      = '#FFFFFF';
const NAVY    = '#0D0D2B';
const GOLD    = '#D4A017';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const BORDER  = '#EBEBEB';
const MUTED   = '#888899';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const STATUS_CONFIG = {
  pending:   { label: 'Pending',    color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  icon: 'time-outline' },
  accepted:  { label: 'Accepted',   color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  icon: 'checkmark-circle-outline' },
  paid:      { label: 'Paid',       color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   icon: 'card-outline' },
  active:    { label: 'In Progress',color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', icon: 'play-circle-outline' },
  completed: { label: 'Completed',  color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   icon: 'checkmark-done-circle-outline' },
  cancelled: { label: 'Cancelled',  color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   icon: 'close-circle-outline' },
  disputed:  { label: 'Disputed',   color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   icon: 'alert-circle-outline' },
};

export default function BookingDetailScreen({ navigation, route }) {
  const { bookingId } = route?.params || {};
  const [booking,    setBooking]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const fetchBooking = async () => {
    try {
      const res  = await fetch(`${BACKEND}/api/bookings/${bookingId}`);
      const data = await res.json();
      setBooking(data.data);
    } catch { } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchBooking(); }, [bookingId]);

  const handleConfirmComplete = async () => {
    setConfirming(true);
    try {
      const res  = await fetch(`${BACKEND}/api/bookings/${bookingId}/complete`, {
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

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <ActivityIndicator color={GOLD} style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  if (!booking) return (
    <SafeAreaView style={s.safe}>
      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color={NAVY} />
      </TouchableOpacity>
      <View style={s.errorWrap}>
        <Text style={s.errorText}>Booking not found</Text>
      </View>
    </SafeAreaView>
  );

  const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Booking Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBooking(); }} tintColor={GOLD} />
        }
      >
        {/* Status banner */}
        <View style={[s.statusBanner, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon} size={20} color={status.color} />
          <View style={s.statusInfo}>
            <Text style={[s.statusLabel, { color: status.color }]}>{status.label}</Text>
            <Text style={s.statusDesc}>
              {booking.status === 'pending'   && 'Waiting for worker to accept your request'}
              {booking.status === 'accepted'  && 'Worker accepted — open chat to agree on price'}
              {booking.status === 'paid'      && 'Payment received — worker is on their way'}
              {booking.status === 'active'    && 'Job is in progress'}
              {booking.status === 'completed' && 'Job completed successfully'}
              {booking.status === 'cancelled' && 'This booking was cancelled'}
            </Text>
          </View>
        </View>

        <View style={s.content}>
          {/* Booking reference */}
          <View style={s.refRow}>
            <Text style={s.refLabel}>Booking Ref</Text>
            <Text style={s.refValue}>{booking.booking_ref}</Text>
          </View>

          {/* Worker */}
          <Text style={s.sectionTitle}>Worker</Text>
          <TouchableOpacity
            style={s.workerCard}
            onPress={() => navigation.navigate('WorkerProfile', { workerId: booking.worker_id })}
          >
            <View style={s.workerAvatar}>
              <Text style={s.workerAvatarText}>{booking.worker_name?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={s.workerInfo}>
              <Text style={s.workerName}>{booking.worker_name}</Text>
              <Text style={s.workerCategory}>{booking.category_name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CCC" />
          </TouchableOpacity>

          {/* Job details */}
          <Text style={s.sectionTitle}>Job Details</Text>
          <View style={s.detailCard}>
            {[
              { label: 'Description',    value: booking.description },
              { label: 'Address',        value: booking.address },
              { label: 'Date',           value: booking.scheduled_date },
              { label: 'Time',           value: booking.scheduled_time },
              { label: 'Est. hours',     value: `${booking.estimated_hours || '–'} hrs` },
              { label: 'Agreed price',   value: booking.agreed_price_ghs ? `GHS ${booking.agreed_price_ghs}` : 'To be agreed in chat' },
              { label: 'Escrow status',  value: booking.escrow_status || 'Not funded' },
            ].map((item, i) => (
              <View key={i} style={[s.detailRow, i > 0 && s.detailRowBorder]}>
                <Text style={s.detailLabel}>{item.label}</Text>
                <Text style={s.detailValue} numberOfLines={2}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Action buttons based on status */}
          {booking.status === 'accepted' && (
            <View style={s.actionsWrap}>
              <TouchableOpacity
                style={s.chatBtn}
                onPress={() => navigation.navigate('ChatRoom', { bookingId, workerName: booking.worker_name })}
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubbles-outline" size={17} color={NAVY} />
                <Text style={s.chatBtnText}>Open Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.payBtn}
                onPress={() => navigation.navigate('Payment', { bookingId, amount: booking.agreed_price_ghs, workerName: booking.worker_name })}
                activeOpacity={0.85}
              >
                <Text style={s.payBtnText}>Pay Now</Text>
                <Ionicons name="arrow-forward" size={16} color={NAVY} />
              </TouchableOpacity>
            </View>
          )}

          {booking.status === 'paid' || booking.status === 'active' ? (
            <View style={s.actionsWrap}>
              <TouchableOpacity
                style={s.chatBtn}
                onPress={() => navigation.navigate('ChatRoom', { bookingId, workerName: booking.worker_name })}
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubbles-outline" size={17} color={NAVY} />
                <Text style={s.chatBtnText}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.completeBtn}
                onPress={handleConfirmComplete}
                disabled={confirming}
                activeOpacity={0.85}
              >
                {confirming
                  ? <ActivityIndicator color={BG} size="small" />
                  : <>
                      <Text style={s.completeBtnText}>Job Done — Release Payment</Text>
                      <Ionicons name="checkmark-circle" size={16} color={BG} />
                    </>
                }
              </TouchableOpacity>
            </View>
          ) : null}

          {booking.status === 'completed' && !booking.has_review && (
            <TouchableOpacity
              style={s.reviewBtn}
              onPress={() => navigation.navigate('Review', { bookingId, workerName: booking.worker_name })}
              activeOpacity={0.85}
            >
              <Ionicons name="star-outline" size={17} color={NAVY} />
              <Text style={s.reviewBtnText}>Leave a Review</Text>
            </TouchableOpacity>
          )}

          {/* Safety info */}
          <View style={s.safetyCard}>
            <Ionicons name="shield-checkmark-outline" size={15} color={GOLD} />
            <Text style={s.safetyText}>
              Payment is held safely in escrow. Only released when you confirm the job is done right.
            </Text>
          </View>

          {['paid', 'active', 'completed'].includes(booking.status) && (
            <TouchableOpacity
              style={s.photosLink}
              onPress={() => navigation.navigate('BookingPhotos', { bookingId })}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={16} color={GOLD} />
              <Text style={s.photosLinkText}>Before / After Photos</Text>
              <Ionicons name="chevron-forward" size={16} color={MUTED} />
            </TouchableOpacity>
          )}

          {['paid', 'active', 'completed'].includes(booking.status) && (
            <TouchableOpacity
              style={s.disputeLink}
              onPress={() => navigation.navigate('Dispute', { bookingId })}
              activeOpacity={0.7}
            >
              <Ionicons name="alert-circle-outline" size={15} color="rgba(255,255,255,0.5)" />
              <Text style={s.disputeLinkText}>Something wrong with this booking? Report an issue</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  headerTitle: { color: NAVY, fontSize: 17, fontWeight: '700' },
  backBtn:     { padding: 16 },
  errorWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText:   { color: MUTED, fontSize: 15 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 16, borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  statusInfo:  { flex: 1 },
  statusLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  statusDesc:  { color: MUTED, fontSize: 12, lineHeight: 18 },

  content:      { padding: 20 },
  refRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  refLabel:     { color: MUTED, fontSize: 12 },
  refValue:     { color: NAVY, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  sectionTitle: { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },

  workerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8F8FB', borderRadius: 13,
    padding: 14, marginBottom: 20,
    borderWidth: 0.5, borderColor: BORDER,
  },
  workerAvatar:    { width: 44, height: 44, borderRadius: 12, backgroundColor: GOLD_BG, alignItems: 'center', justifyContent: 'center' },
  workerAvatarText:{ color: GOLD, fontSize: 18, fontWeight: '700' },
  workerInfo:      { flex: 1 },
  workerName:      { color: NAVY, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  workerCategory:  { color: MUTED, fontSize: 12 },

  detailCard: {
    backgroundColor: '#F8F8FB', borderRadius: 14,
    borderWidth: 0.5, borderColor: BORDER,
    marginBottom: 20, overflow: 'hidden',
  },
  detailRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 11 },
  detailRowBorder: { borderTopWidth: 0.5, borderTopColor: BORDER },
  detailLabel:     { color: MUTED, fontSize: 13, flex: 1 },
  detailValue:     { color: NAVY, fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },

  actionsWrap: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  chatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 13, borderRadius: 13,
    borderWidth: 1.5, borderColor: NAVY,
  },
  chatBtnText:  { color: NAVY, fontSize: 14, fontWeight: '600' },
  payBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 13, borderRadius: 13, backgroundColor: GOLD,
  },
  payBtnText:  { color: NAVY, fontSize: 14, fontWeight: '700' },
  completeBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 13, borderRadius: 13, backgroundColor: '#22C55E',
  },
  completeBtnText: { color: BG, fontSize: 13, fontWeight: '700' },
  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 13,
    backgroundColor: GOLD_BG, borderWidth: 0.5,
    borderColor: 'rgba(212,160,23,0.25)', marginBottom: 14,
  },
  reviewBtnText: { color: NAVY, fontSize: 14, fontWeight: '600' },
  safetyCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    backgroundColor: GOLD_BG, borderRadius: 12, padding: 13,
    borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.2)',
  },
  safetyText: { color: NAVY, fontSize: 12, lineHeight: 18, flex: 1 },
  photosLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: GOLD_BG, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginTop: 14,
  },
  photosLinkText: { color: NAVY, fontSize: 13, fontWeight: '600', flex: 1 },
  disputeLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 16, paddingVertical: 8,
  },
  disputeLinkText: { color: MUTED, fontSize: 12 },
});
