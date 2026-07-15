// © 2026 WiamApp. Powered by WiamLabs
// screens/BookingScreen.js — combines BookingFormScreen + BookingConfirmScreen
// V2 Plan: customer fills booking details, reviews, confirms
// Backend: POST /api/bookings

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar,
  ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import GoldAvatar from '../components/ui/GoldAvatar';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const PAD = Colors.screenPad;

const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return {
    key: d.toISOString().split('T')[0],
    day: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    date: d.getDate(),
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
    isToday: i === 0,
  };
});

const TIMES = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];

function BackBtn({ onPress }) {
  return (
    <TouchableOpacity style={s.backBtn} onPress={onPress} accessibilityLabel="Go back">
      <Ionicons name="chevron-back" size={20} color={Colors.white} />
    </TouchableOpacity>
  );
}

function FieldLabel({ children }) {
  return <Text style={s.fieldLabel}>{children}</Text>;
}

export default function BookingScreen({ navigation, route }) {
  const { workerId, workerName, hourlyRate } = route?.params || {};

  const [step, setStep] = useState(1);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(DATES[0].key);
  const [time, setTime] = useState('');
  const [hours, setHours] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canContinue = description.length >= 10 && address && date && time;

  const handleConfirm = async () => {
    if (!canContinue || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_id: workerId,
          description,
          address,
          scheduled_date: date,
          scheduled_time: time,
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

  const selectedDateLabel = DATES.find((d) => d.key === date);
  const dateDisplay = selectedDateLabel?.isToday ? 'Today' : `${selectedDateLabel?.day} ${selectedDateLabel?.date} ${selectedDateLabel?.month}`;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        <View style={s.header}>
          <BackBtn onPress={() => (step === 1 ? navigation.goBack() : setStep(1))} />
          <Text style={s.headerTitle}>{step === 1 ? 'Book a Service' : 'Confirm Booking'}</Text>
        </View>

        {step === 2 ? (
          <View style={s.progressRow}>
            <View style={[s.progressDot, s.progressDone]} />
            <View style={[s.progressLine, s.progressDone]} />
            <View style={[s.progressDot, s.progressDone]} />
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 ? (
            <>
              <View style={s.workerMini}>
                <GoldAvatar name={workerName} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={s.workerName}>{workerName}</Text>
                  <Text style={s.workerRole}>
                    {hourlyRate ? `GHS ${hourlyRate}/hr starting rate` : 'Service provider'}
                  </Text>
                </View>
              </View>

              <FieldLabel>What do you need done? *</FieldLabel>
              <View style={[s.fieldBox, { alignItems: 'flex-start' }]}>
                <Ionicons name="document-text-outline" size={16} color={Colors.gold} style={{ marginTop: 2 }} />
                <TextInput
                  style={[s.fieldInput, s.textarea]}
                  placeholder="e.g. Fix a leaking pipe in my kitchen..."
                  placeholderTextColor={Colors.textFaint}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
              <Text style={[s.charCount, description.length < 10 && { color: Colors.error }]}>
                {description.length}/10 minimum
              </Text>

              <FieldLabel>Location *</FieldLabel>
              <View style={s.fieldBox}>
                <Ionicons name="location-outline" size={16} color={Colors.gold} />
                <TextInput
                  style={s.fieldInput}
                  placeholder="Street address where work is needed"
                  placeholderTextColor={Colors.textFaint}
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              <FieldLabel>Select date *</FieldLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                {DATES.map((d) => (
                  <TouchableOpacity
                    key={d.key}
                    style={[s.dateCard, date === d.key && s.dateCardActive]}
                    onPress={() => setDate(d.key)}
                  >
                    <Text style={[s.dateDay, date === d.key && s.dateActiveText]}>
                      {d.isToday ? 'Today' : d.day}
                    </Text>
                    <Text style={[s.dateNum, date === d.key && s.dateActiveText]}>{d.date}</Text>
                    <Text style={[s.dateMonth, date === d.key && s.dateActiveText]}>{d.month}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <FieldLabel>Preferred time *</FieldLabel>
              <View style={s.chipRow}>
                {TIMES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.timeChip, time === t && s.timeChipActive]}
                    onPress={() => setTime(t)}
                  >
                    <Text style={[s.timeChipText, time === t && s.timeChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FieldLabel>Estimated hours</FieldLabel>
              <View style={s.hoursRow}>
                <TouchableOpacity style={s.hoursBtn} onPress={() => setHours((h) => Math.max(1, h - 1))}>
                  <Ionicons name="remove" size={18} color={Colors.white} />
                </TouchableOpacity>
                <Text style={s.hoursValue}>{hours} hr{hours > 1 ? 's' : ''}</Text>
                <TouchableOpacity style={s.hoursBtn} onPress={() => setHours((h) => Math.min(12, h + 1))}>
                  <Ionicons name="add" size={18} color={Colors.white} />
                </TouchableOpacity>
                {hourlyRate ? (
                  <Text style={s.estimatedTotal}>≈ GHS {(hourlyRate * hours).toFixed(0)} estimated</Text>
                ) : null}
              </View>

              <View style={s.notice}>
                <Ionicons name="chatbubbles-outline" size={15} color={Colors.gold} />
                <Text style={s.noticeText}>
                  Chat opens after the worker accepts. Agree on the final price before paying.
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={s.confirmTitle}>Review your booking</Text>
              <Text style={s.confirmSub}>
                Once the worker accepts, chat opens and you agree on the final price before payment.
              </Text>

              <View style={s.detailCard}>
                {[
                  { label: 'Worker', value: workerName },
                  { label: 'Job', value: description },
                  { label: 'Address', value: address },
                  { label: 'Date', value: dateDisplay },
                  { label: 'Time', value: time },
                  { label: 'Est. hours', value: `${hours} hr${hours > 1 ? 's' : ''}` },
                  { label: 'Starting rate', value: hourlyRate ? `GHS ${hourlyRate}/hr` : 'To be agreed' },
                ].map((item, i, arr) => (
                  <View key={item.label} style={[s.detailRow, i < arr.length - 1 && s.detailRowBorder]}>
                    <Text style={s.detailLabel}>{item.label}</Text>
                    <Text style={s.detailValue} numberOfLines={2}>{item.value}</Text>
                  </View>
                ))}
              </View>

              <View style={s.notice}>
                <Ionicons name="lock-closed-outline" size={15} color={Colors.gold} />
                <Text style={s.noticeText}>
                  Payment is held in escrow by WiamApp and only released when you confirm the job is done right.
                </Text>
              </View>

              {error ? (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              ) : null}
            </>
          )}

          <Text style={s.footerCopy}>© 2026 WiamApp · Powered by WiamLabs</Text>
        </ScrollView>

        <View style={s.submitBar}>
          {step === 1 ? (
            <>
              <TouchableOpacity
                style={[s.primaryBtn, !canContinue && s.primaryBtnDisabled]}
                onPress={() => canContinue && setStep(2)}
                activeOpacity={0.85}
              >
                <Text style={[s.primaryBtnText, !canContinue && { opacity: 0.4 }]}>Review Booking</Text>
              </TouchableOpacity>
              <Text style={s.submitNote}>You won't be charged until you agree on price and pay</Text>
            </>
          ) : (
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.navy} />
              ) : (
                <Text style={s.primaryBtnText}>Send Booking Request</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: PAD, paddingBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },
  progressRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, marginBottom: 8 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.navyLine },
  progressLine: { flex: 1, height: 3, backgroundColor: Colors.navyLine, marginHorizontal: 4 },
  progressDone: { backgroundColor: Colors.gold },
  scroll: { paddingHorizontal: PAD, paddingBottom: 120 },
  workerMini: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 16, padding: 12, marginBottom: 20,
  },
  workerName: { fontSize: 13, fontWeight: '600', color: Colors.white },
  workerRole: { fontSize: 11, color: Colors.textDim, marginTop: 1 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: Colors.white, marginBottom: 8, marginTop: 4 },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  fieldInput: { flex: 1, color: Colors.white, fontSize: 13 },
  textarea: { minHeight: 80, textAlignVertical: 'top', lineHeight: 20 },
  charCount: { fontSize: 11, color: Colors.textFaint, textAlign: 'right', marginTop: 4, marginBottom: 8 },
  dateCard: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, marginRight: 8,
    borderWidth: 1, borderColor: Colors.navyLine, backgroundColor: Colors.navyCard,
  },
  dateCardActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  dateDay: { color: Colors.textDim, fontSize: 11, marginBottom: 2 },
  dateNum: { color: Colors.white, fontSize: 18, fontWeight: '700', marginBottom: 2 },
  dateMonth: { color: Colors.textFaint, fontSize: 10 },
  dateActiveText: { color: Colors.navy },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  timeChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
  },
  timeChipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  timeChipText: { color: '#B8B8CC', fontSize: 12 },
  timeChipTextActive: { color: Colors.navy, fontWeight: '600' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  hoursBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    alignItems: 'center', justifyContent: 'center',
  },
  hoursValue: { color: Colors.white, fontSize: 16, fontWeight: '700', minWidth: 50, textAlign: 'center' },
  estimatedTotal: { color: Colors.gold, fontSize: 13, fontWeight: '600' },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(212,160,23,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.2)',
    padding: 12, marginTop: 8,
  },
  noticeText: { color: Colors.textDim, fontSize: 12, lineHeight: 18, flex: 1 },
  confirmTitle: { color: Colors.white, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  confirmSub: { color: Colors.textDim, fontSize: 13, lineHeight: 20, marginBottom: 20 },
  detailCard: {
    backgroundColor: Colors.navyCard, borderRadius: Colors.cardRadius,
    borderWidth: 1, borderColor: Colors.navyLine, marginBottom: 16, overflow: 'hidden',
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.navyLine },
  detailLabel: { color: Colors.textFaint, fontSize: 12, flex: 1 },
  detailValue: { color: Colors.white, fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginTop: 12,
  },
  errorText: { color: Colors.error, fontSize: 12, flex: 1 },
  footerCopy: { textAlign: 'center', fontSize: 10, color: '#3A3A56', marginTop: 20 },
  submitBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.navySoft, borderTopWidth: 1, borderTopColor: '#1C1C38',
    paddingHorizontal: PAD, paddingTop: 14, paddingBottom: 24,
  },
  primaryBtn: {
    backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  primaryBtnText: { color: Colors.navy, fontSize: 14, fontWeight: '700' },
  submitNote: { textAlign: 'center', fontSize: 10.5, color: Colors.textFaint, marginTop: 8 },
});
