// © 2026 WiamApp. Powered by WiamLabs
// screens/JobDetailScreen.js
// Full job detail — accept/reject, GPS check-in, complete job
// Backend: PATCH /api/bookings/:id/status

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { getCustomerTrustScore } from '../lib/api/disputes';

const NAVY    = Colors.navy;
const NAVY2   = Colors.navyMid;
const GOLD    = Colors.gold;
const WHITE   = Colors.white;
const MUTED   = 'rgba(255,255,255,0.50)';
const BORDER  = 'rgba(255,255,255,0.09)';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function JobDetailScreen({ navigation, route }) {
  const job = route?.params?.job ?? {
    id: 'booking_001',
    customer: 'Abena Mensah',
    phone: '+233241234567',
    service: 'Fix kitchen ceiling lights',
    category: 'Electrician',
    location: 'East Legon, Accra, Ghana',
    date: 'Mon 16 Jun 2026',
    time: '3:00 PM',
    notes: 'Three bulbs have gone out. Please bring GU10 replacements if possible.',
    price: 'GHS 120',
    status: 'pending',
    isEmergency: false,
    postedAt: '2 hours ago',
  };

  const [status, setStatus] = useState(job.status);
  const [loading, setLoading] = useState(false);
  const [customerTrust, setCustomerTrust] = useState(null);

  useEffect(() => {
    if (!job.customerId) return;
    getCustomerTrustScore(job.customerId).then(setCustomerTrust).catch(() => {});
  }, [job.customerId]);

  const updateStatus = async (newStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/bookings/${job.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        if (newStatus === 'rejected') {
          Alert.alert('Declined', 'Job has been declined. The customer will be notified.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }
      } else {
        Alert.alert('Error', 'Could not update job status. Please try again.');
      }
    } catch {
      // Offline fallback
      setStatus(newStatus);
      if (newStatus === 'rejected') navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    Alert.alert('Accept Job', 'Accept this job request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: () => updateStatus('accepted') },
    ]);
  };

  const handleReject = () => {
    Alert.alert('Decline Job', 'Decline this job request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => updateStatus('rejected') },
    ]);
  };

  const handleCheckIn = () => {
    Alert.alert('GPS Check-In', 'Confirm you have arrived at the job site?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Check In', onPress: () => {
        updateStatus('in_progress');
        Alert.alert('✅ Checked In', 'Your arrival has been confirmed. The customer has been notified.');
      }},
    ]);
  };

  const handleComplete = () => {
    Alert.alert('Complete Job', 'Mark this job as completed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: () => {
        updateStatus('completed');
        Alert.alert('🎉 Job Completed', 'Payment will be released within 24 hours.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }},
    ]);
  };

  const callCustomer = () => {
    Linking.openURL(`tel:${job.phone}`).catch(() =>
      Alert.alert('Error', 'Could not open phone app.')
    );
  };

  const openMaps = () => {
    const encoded = encodeURIComponent(job.location);
    Linking.openURL(`https://maps.google.com/?q=${encoded}`).catch(() =>
      Alert.alert('Error', 'Could not open maps.')
    );
  };

  const getStatusConfig = (s) => ({
    pending:     { label: 'Pending Acceptance', color: Colors.warning, bg: 'rgba(245,158,11,0.15)' },
    accepted:    { label: 'Accepted',            color: '#3B82F6',      bg: 'rgba(59,130,246,0.15)' },
    in_progress: { label: 'In Progress',         color: Colors.gold,    bg: 'rgba(212,160,23,0.15)' },
    completed:   { label: 'Completed',           color: Colors.success, bg: 'rgba(34,197,94,0.15)' },
    rejected:    { label: 'Declined',            color: Colors.error,   bg: 'rgba(239,68,68,0.15)' },
  }[s] || { label: s, color: '#aaa', bg: 'rgba(170,170,170,0.1)' });

  const sc = getStatusConfig(status);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Detail</Text>
        <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Emergency badge */}
        {job.isEmergency && (
          <View style={styles.emergencyBanner}>
            <Ionicons name="flash" size={16} color="#fff" />
            <Text style={styles.emergencyText}>EMERGENCY REQUEST — +20% bonus pay</Text>
          </View>
        )}

        {/* Customer card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Customer</Text>
          <View style={styles.customerRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color={GOLD} />
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{job.customer}</Text>
              <Text style={styles.customerPhone}>{job.phone}</Text>
            </View>
            <TouchableOpacity onPress={callCustomer} style={styles.callBtn}>
              <Ionicons name="call" size={18} color={NAVY} />
              <Text style={styles.callText}>Call</Text>
            </TouchableOpacity>
          </View>
          {customerTrust && (
            <View style={styles.trustRow}>
              <View style={[styles.trustBadge, customerTrust.trustScore >= 70 ? styles.trustGood : customerTrust.trustScore >= 40 ? styles.trustOk : styles.trustLow]}>
                <Ionicons name="shield-checkmark-outline" size={13} color={customerTrust.trustScore >= 70 ? '#22C55E' : customerTrust.trustScore >= 40 ? GOLD : '#EF4444'} />
                <Text style={[styles.trustBadgeText, { color: customerTrust.trustScore >= 70 ? '#22C55E' : customerTrust.trustScore >= 40 ? GOLD : '#EF4444' }]}>
                  Trust Score: {customerTrust.trustScore}/100
                </Text>
              </View>
              <Text style={styles.trustDetail}>
                {customerTrust.completedBookings} completed · {customerTrust.cancelledBookings} cancelled
                {customerTrust.disputesAgainst > 0 ? ` · ${customerTrust.disputesAgainst} disputed` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Job details */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Job Details</Text>
          <View style={styles.detailRow}>
            <Ionicons name="construct-outline" size={18} color={GOLD} />
            <View style={styles.detailText}>
              <Text style={styles.detailKey}>Service</Text>
              <Text style={styles.detailVal}>{job.service}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Ionicons name="pricetag-outline" size={18} color={GOLD} />
            <View style={styles.detailText}>
              <Text style={styles.detailKey}>Category</Text>
              <Text style={styles.detailVal}>{job.category}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={18} color={GOLD} />
            <View style={styles.detailText}>
              <Text style={styles.detailKey}>Date & Time</Text>
              <Text style={styles.detailVal}>{job.date} at {job.time}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={18} color={Colors.success} />
            <View style={styles.detailText}>
              <Text style={styles.detailKey}>Pay</Text>
              <Text style={[styles.detailVal, { color: Colors.success }]}>{job.price}</Text>
            </View>
          </View>
        </View>

        {/* Location */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Location</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={18} color={GOLD} />
            <Text style={styles.locationText}>{job.location}</Text>
          </View>
          <TouchableOpacity onPress={openMaps} style={styles.mapsBtn}>
            <Ionicons name="map-outline" size={16} color={GOLD} />
            <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
          </TouchableOpacity>
        </View>

        {/* Customer notes */}
        {job.notes ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Customer Notes</Text>
            <Text style={styles.notesText}>{job.notes}</Text>
          </View>
        ) : null}

        {/* Posted */}
        <Text style={styles.postedText}>Posted {job.postedAt}</Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actionBar}>
        {status === 'pending' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={handleReject}
              disabled={loading}
            >
              <Ionicons name="close" size={18} color={Colors.error} />
              <Text style={[styles.actionBtnText, { color: Colors.error }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={handleAccept}
              disabled={loading}
            >
              <Ionicons name="checkmark" size={18} color={NAVY} />
              <Text style={[styles.actionBtnText, { color: NAVY }]}>Accept Job</Text>
            </TouchableOpacity>
          </>
        )}
        {status === 'accepted' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn, { flex: 1 }]}
            onPress={handleCheckIn}
            disabled={loading}
          >
            <Ionicons name="location" size={18} color={NAVY} />
            <Text style={[styles.actionBtnText, { color: NAVY }]}>GPS Check-In (I've Arrived)</Text>
          </TouchableOpacity>
        )}
        {status === 'in_progress' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.completeBtn, { flex: 1 }]}
            onPress={handleComplete}
            disabled={loading}
          >
            <Ionicons name="checkmark-done" size={18} color={WHITE} />
            <Text style={[styles.actionBtnText, { color: WHITE }]}>Mark as Completed</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: NAVY },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 12 },
  backBtn:         { padding: 4 },
  headerTitle:     { flex: 1, fontSize: 18, fontWeight: '700', color: WHITE },
  statusPill:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:      { fontSize: 12, fontWeight: '600' },
  scroll:          { flex: 1 },
  emergencyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EF4444', marginHorizontal: 20, borderRadius: 10, padding: 12, marginBottom: 4 },
  emergencyText:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  card:            { backgroundColor: NAVY2, marginHorizontal: 20, marginTop: 14, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: BORDER },
  cardLabel:       { fontSize: 11, fontWeight: '700', color: GOLD, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  customerRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:          { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(212,160,23,0.15)', alignItems: 'center', justifyContent: 'center' },
  customerInfo:    { flex: 1 },
  customerName:    { fontSize: 16, fontWeight: '700', color: WHITE },
  customerPhone:   { fontSize: 13, color: MUTED, marginTop: 2 },
  callBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: GOLD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  callText:        { fontSize: 13, fontWeight: '700', color: NAVY },
  trustRow:  { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, marginBottom: 6 },
  trustGood: { backgroundColor: 'rgba(34,197,94,0.12)' },
  trustOk:   { backgroundColor: 'rgba(212,160,23,0.12)' },
  trustLow:  { backgroundColor: 'rgba(239,68,68,0.12)' },
  trustBadgeText: { fontSize: 12, fontWeight: '700' },
  trustDetail: { fontSize: 11.5, color: MUTED },
  detailRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 2 },
  detailText:      { flex: 1 },
  detailKey:       { fontSize: 12, color: MUTED },
  detailVal:       { fontSize: 15, fontWeight: '600', color: WHITE, marginTop: 2 },
  divider:         { height: 1, backgroundColor: BORDER, marginVertical: 12 },
  locationRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  locationText:    { flex: 1, fontSize: 14, color: WHITE, lineHeight: 20 },
  mapsBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 14 },
  mapsBtnText:     { fontSize: 14, color: GOLD, fontWeight: '600' },
  notesText:       { fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 21 },
  postedText:      { textAlign: 'center', color: MUTED, fontSize: 12, marginTop: 18 },
  actionBar:       { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 28, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: NAVY },
  actionBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 12 },
  actionBtnText:   { fontSize: 15, fontWeight: '700' },
  rejectBtn:       { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1.5, borderColor: Colors.error },
  acceptBtn:       { backgroundColor: GOLD },
  completeBtn:     { backgroundColor: Colors.success },
});
