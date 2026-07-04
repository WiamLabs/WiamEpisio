// © 2026 WiamApp. Powered by WiamLabs
// screens/BookingScreen.js — combines BookingFormScreen + BookingConfirmScreen
// V2 Plan: customer fills booking details, reviews, confirms
// Backend: POST /api/bookings

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet,  StatusBar,
  ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
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

const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return {
    key:   d.toISOString().split('T')[0],
    day:   d.toLocaleDateString('en-GB', { weekday: 'short' }),
    date:  d.getDate(),
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
    isToday: i === 0,
  };
});

const TIMES = ['8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'];

export default function BookingScreen({ navigation, route }) {
  const { workerId, workerName, hourlyRate } = route?.params || {};

  const [step,        setStep]        = useState(1); // 1=form, 2=confirm
  const [description, setDescription] = useState('');
  const [address,     setAddress]     = useState('');
  const [date,        setDate]        = useState(DATES[0].key);
  const [time,        setTime]        = useState('');
  const [hours,       setHours]       = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const estimatedTotal = hourlyRate ? (hourlyRate * hours) : null;
  const canContinue = description.length >= 10 && address && date && time;

  const handleConfirm = async () => {
    if (!canContinue || loading) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${BACKEND}/api/bookings`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          worker_id:       workerId,
          description,
          address,
          scheduled_date:  date,
          scheduled_time:  time,
          estimated_hours: hours,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed.');
      navigation.replace('BookingSuccess', { bookingRef: data.booking_ref, workerName });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => step === 1 ? navigation.goBack() : setStep(1)}>
            <Ionicons name="arrow-back" size={22} color={NAVY} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {step === 1 ? 'Book a Worker' : 'Confirm Booking'}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Progress */}
        <View style={s.progress}>
          <View style={[s.progressStep, s.progressDone]} />
          <View style={[s.progressStep, step >= 2 ? s.progressDone : s.progressActive]} />
        </View>

        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {step === 1 ? (
            <>
              {/* Worker info */}
              <View style={s.workerCard}>
                <View style={s.workerAvatar}>
                  <Ionicons name="person-outline" size={22} color={GOLD} />
                </View>
                <View>
                  <Text style={s.workerName}>{workerName}</Text>
                  {hourlyRate && <Text style={s.workerRate}>GHS {hourlyRate}/hr · Starting rate</Text>}
                </View>
              </View>

              {/* Job description */}
              <Text style={s.label}>Describe the job *</Text>
              <TextInput
                style={s.textarea}
                placeholder="e.g. Fix a leaking pipe in my kitchen, replace the tap and check for other issues..."
                placeholderTextColor={MUTED}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={[s.charCount, description.length < 10 && { color: '#EF4444' }]}>
                {description.length}/10 minimum
              </Text>

              {/* Address */}
              <Text style={s.label}>Job address *</Text>
              <View style={s.inputWrap}>
                <Ionicons name="location-outline" size={17} color={MUTED} style={{ marginRight: 8 }} />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="Street address where work is needed"
                  placeholderTextColor={MUTED}
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              {/* Date picker */}
              <Text style={s.label}>Select date *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.datesRow}>
                {DATES.map(d => (
                  <TouchableOpacity
                    key={d.key}
                    style={[s.dateCard, date === d.key && s.dateCardActive]}
                    onPress={() => setDate(d.key)}
                  >
                    <Text style={[s.dateDayText, date === d.key && s.dateActiveText]}>
                      {d.isToday ? 'Today' : d.day}
                    </Text>
                    <Text style={[s.dateDateText, date === d.key && s.dateActiveText]}>
                      {d.date}
                    </Text>
                    <Text style={[s.dateMonthText, date === d.key && s.dateActiveText]}>
                      {d.month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Time picker */}
              <Text style={s.label}>Select time *</Text>
              <View style={s.timesGrid}>
                {TIMES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.timeChip, time === t && s.timeChipActive]}
                    onPress={() => setTime(t)}
                  >
                    <Text style={[s.timeChipText, time === t && s.timeChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Estimated hours */}
              <Text style={s.label}>Estimated hours</Text>
              <View style={s.hoursRow}>
                <TouchableOpacity
                  style={s.hoursBtn}
                  onPress={() => setHours(h => Math.max(1, h - 1))}
                >
                  <Ionicons name="remove" size={18} color={NAVY} />
                </TouchableOpacity>
                <Text style={s.hoursValue}>{hours} hr{hours > 1 ? 's' : ''}</Text>
                <TouchableOpacity
                  style={s.hoursBtn}
                  onPress={() => setHours(h => Math.min(12, h + 1))}
                >
                  <Ionicons name="add" size={18} color={NAVY} />
                </TouchableOpacity>
                {estimatedTotal && (
                  <Text style={s.estimatedTotal}>
                    ≈ GHS {(hourlyRate * hours).toFixed(0)} estimated
                  </Text>
                )}
              </View>

              <View style={s.chatNotice}>
                <Ionicons name="chatbubbles-outline" size={15} color={GOLD} />
                <Text style={s.chatNoticeText}>
                  Chat opens after the worker accepts. Agree on the final price before paying.
                </Text>
              </View>

              <TouchableOpacity
                style={[s.continueBtn, !canContinue && s.continueBtnDisabled]}
                onPress={() => canContinue && setStep(2)}
                activeOpacity={0.85}
              >
                <Text style={[s.continueBtnText, !canContinue && { color: 'rgba(255,255,255,0.4)' }]}>
                  Review Booking
                </Text>
                {canContinue && <Ionicons name="arrow-forward" size={16} color={NAVY} style={{ marginLeft: 6 }} />}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Confirmation step */}
              <Text style={s.confirmTitle}>Review your booking</Text>
              <Text style={s.confirmSub}>
                Once the worker accepts, chat opens and you agree on the final price before payment.
              </Text>

              <View style={s.confirmCard}>
                {[
                  { label: 'Worker',      value: workerName },
                  { label: 'Job',         value: description },
                  { label: 'Address',     value: address },
                  { label: 'Date',        value: DATES.find(d => d.key === date)?.isToday ? 'Today' : date },
                  { label: 'Time',        value: time },
                  { label: 'Est. hours',  value: `${hours} hr${hours > 1 ? 's' : ''}` },
                  { label: 'Starting rate', value: hourlyRate ? `GHS ${hourlyRate}/hr` : 'To be agreed' },
                ].map((item, i) => (
                  <View key={i} style={s.confirmRow}>
                    <Text style={s.confirmLabel}>{item.label}</Text>
                    <Text style={s.confirmValue} numberOfLines={2}>{item.value}</Text>
                  </View>
                ))}
              </View>

              <View style={s.escrowNotice}>
                <Ionicons name="lock-closed-outline" size={15} color={GOLD} />
                <Text style={s.escrowNoticeText}>
                  Payment is held in escrow by WiamApp and only released when you confirm the job is done right.
                </Text>
              </View>

              {error ? (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={s.confirmBtn}
                onPress={handleConfirm}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color={NAVY} />
                  : <>
                      <Text style={s.confirmBtnText}>Send Booking Request</Text>
                      <Ionicons name="arrow-forward" size={16} color={NAVY} style={{ marginLeft: 6 }} />
                    </>
                }
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  headerTitle: { color: NAVY, fontSize: 16, fontWeight: '600' },
  progress:    { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 8 },
  progressStep:{ flex: 1, height: 3, borderRadius: 2, backgroundColor: '#EEE' },
  progressDone:{ backgroundColor: GOLD },
  progressActive:{ backgroundColor: 'rgba(212,160,23,0.3)' },
  container:   { flexGrow: 1, padding: 20 },

  workerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8F8FB', borderRadius: 13,
    padding: 14, marginBottom: 20,
    borderWidth: 0.5, borderColor: BORDER,
  },
  workerAvatar: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: GOLD_BG, alignItems: 'center', justifyContent: 'center',
  },
  workerName: { color: NAVY, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  workerRate: { color: MUTED, fontSize: 12 },

  label: { color: MUTED, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 8, marginTop: 16 },
  textarea: {
    backgroundColor: '#F5F5F8', borderRadius: 12,
    borderWidth: 0.5, borderColor: BORDER,
    padding: 13, color: NAVY, fontSize: 14, lineHeight: 22,
    minHeight: 100,
  },
  charCount: { color: MUTED, fontSize: 11, textAlign: 'right', marginTop: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F8', borderRadius: 12,
    borderWidth: 0.5, borderColor: BORDER,
    paddingHorizontal: 13, paddingVertical: 13,
  },
  input: { color: NAVY, fontSize: 14 },

  datesRow: { marginBottom: 4 },
  dateCard: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, marginRight: 8,
    borderWidth: 0.5, borderColor: BORDER, backgroundColor: '#F5F5F8',
  },
  dateCardActive: { backgroundColor: NAVY, borderColor: NAVY },
  dateDayText:    { color: MUTED, fontSize: 11, marginBottom: 2 },
  dateDateText:   { color: NAVY, fontSize: 18, fontWeight: '700', marginBottom: 2 },
  dateMonthText:  { color: MUTED, fontSize: 10 },
  dateActiveText: { color: '#FFF' },

  timesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  timeChip:          { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 0.5, borderColor: BORDER, backgroundColor: '#F5F5F8' },
  timeChipActive:    { backgroundColor: NAVY, borderColor: NAVY },
  timeChipText:      { color: MUTED, fontSize: 13 },
  timeChipTextActive:{ color: '#FFF', fontWeight: '600' },

  hoursRow:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hoursBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F5F8', borderWidth: 0.5, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  hoursValue:    { color: NAVY, fontSize: 16, fontWeight: '700', minWidth: 50, textAlign: 'center' },
  estimatedTotal:{ color: GOLD, fontSize: 13, fontWeight: '600' },

  chatNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: GOLD_BG, borderRadius: 11, padding: 12, marginTop: 20, marginBottom: 4,
  },
  chatNoticeText: { color: NAVY, fontSize: 12, lineHeight: 18, flex: 1 },

  continueBtn: { backgroundColor: GOLD, borderRadius: 13, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  continueBtnDisabled:{ backgroundColor: 'rgba(212,160,23,0.25)' },
  continueBtnText:    { color: NAVY, fontSize: 15, fontWeight: '700' },

  confirmTitle: { color: NAVY, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  confirmSub:   { color: MUTED, fontSize: 13, lineHeight: 20, marginBottom: 20 },
  confirmCard: {
    backgroundColor: '#F8F8FB', borderRadius: 14,
    borderWidth: 0.5, borderColor: BORDER,
    padding: 4, marginBottom: 16,
  },
  confirmRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  confirmLabel: { color: MUTED, fontSize: 13, flex: 1 },
  confirmValue: { color: NAVY, fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },

  escrowNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: GOLD_BG, borderRadius: 11, padding: 12, marginBottom: 16,
  },
  escrowNoticeText: { color: NAVY, fontSize: 12, lineHeight: 18, flex: 1 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText: { color: '#EF4444', fontSize: 12, flex: 1 },

  confirmBtn: { backgroundColor: GOLD, borderRadius: 13, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { color: NAVY, fontSize: 15, fontWeight: '700' },
});
