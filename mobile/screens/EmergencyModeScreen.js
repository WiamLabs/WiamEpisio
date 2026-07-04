// © 2026 WiamApp. Powered by WiamLabs
// screens/EmergencyModeScreen.js
// V2 Plan: Emergency booking — +20% rate, first worker to accept wins, 2hr expiry
// Backend: POST /api/bookings/emergency

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet,  StatusBar,
  ScrollView, ActivityIndicator, Animated,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const BG      = '#FFFFFF';
const NAVY    = '#0D0D2B';
const GOLD    = '#D4A017';
const RED     = '#EF4444';
const BORDER  = '#EBEBEB';
const MUTED   = '#888899';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const EMERGENCY_CATEGORIES = [
  { id: '2',  name: 'Plumbing',    emoji: '🚰', desc: 'Burst pipe, major leak, blocked drain' },
  { id: '3',  name: 'Electrical',  emoji: '⚡', desc: 'Power outage, sparking wire, trip switch' },
  { id: '1',  name: 'Building',    emoji: '🧱', desc: 'Structural damage, roof collapse, flooding' },
  { id: '4',  name: 'Automotive',  emoji: '🚗', desc: 'Breakdown, flat tyre, locked out' },
  { id: '6',  name: 'Cleaning',    emoji: '🧹', desc: 'Flood damage, urgent deep clean' },
];

export default function EmergencyModeScreen({ navigation }) {
  const [category,    setCategory]    = useState(null);
  const [description, setDescription] = useState('');
  const [address,     setAddress]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation on the emergency badge
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const canSubmit = category && description.length >= 10 && address;

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${BACKEND}/api/bookings/emergency`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          category_id: category,
          description,
          address,
          is_emergency: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create emergency booking.');
      navigation.replace('BookingSuccess', {
        bookingRef: data.booking_ref,
        workerName: 'nearby workers',
        isEmergency: true,
      });
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
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={NAVY} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Emergency Booking</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Emergency banner */}
          <Animated.View style={[s.emergencyBanner, { transform: [{ scale: pulseAnim }] }]}>
            <View style={s.emergencyIconWrap}>
              <Ionicons name="flash" size={24} color={BG} />
            </View>
            <View style={s.emergencyInfo}>
              <Text style={s.emergencyTitle}>Emergency Mode Active</Text>
              <Text style={s.emergencySub}>Workers are alerted immediately · First to accept gets the job</Text>
            </View>
          </Animated.View>

          {/* Rules */}
          <View style={s.rulesCard}>
            <Text style={s.rulesTitle}>EMERGENCY RULES</Text>
            {[
              { icon: 'flash-outline',           color: RED,     text: 'Available for urgent situations only' },
              { icon: 'trending-up-outline',     color: RED,     text: '+20% rate applies — workers charge more for urgency' },
              { icon: 'people-outline',          color: '#3B82F6', text: 'All available workers in your area are notified instantly' },
              { icon: 'trophy-outline',          color: GOLD,    text: 'First verified worker to accept gets the job' },
              { icon: 'time-outline',            color: MUTED,   text: 'Request expires in 2 hours if no worker accepts' },
            ].map((rule, i) => (
              <View key={i} style={s.ruleRow}>
                <View style={[s.ruleIcon, { backgroundColor: rule.color + '18' }]}>
                  <Ionicons name={rule.icon} size={14} color={rule.color} />
                </View>
                <Text style={s.ruleText}>{rule.text}</Text>
              </View>
            ))}
          </View>

          {/* Category */}
          <Text style={s.label}>WHAT DO YOU NEED? *</Text>
          {EMERGENCY_CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[s.catCard, category === cat.id && s.catCardActive]}
              onPress={() => setCategory(cat.id)}
              activeOpacity={0.8}
            >
              <Text style={s.catEmoji}>{cat.emoji}</Text>
              <View style={s.catInfo}>
                <Text style={[s.catName, category === cat.id && s.catNameActive]}>{cat.name}</Text>
                <Text style={s.catDesc}>{cat.desc}</Text>
              </View>
              <View style={[s.radio, category === cat.id && s.radioActive]}>
                {category === cat.id && <View style={s.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}

          {/* Description */}
          <Text style={s.label}>DESCRIBE THE EMERGENCY *</Text>
          <TextInput
            style={s.textarea}
            placeholder="Describe exactly what is happening so workers can come prepared..."
            placeholderTextColor={MUTED}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Address */}
          <Text style={s.label}>YOUR LOCATION *</Text>
          <View style={s.inputWrap}>
            <Ionicons name="location-outline" size={17} color={MUTED} style={{ marginRight: 8 }} />
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Exact address where help is needed"
              placeholderTextColor={MUTED}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          {/* Error */}
          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={RED} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, (!canSubmit || loading) && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={BG} />
              : <>
                  <Ionicons name="flash" size={18} color={BG} />
                  <Text style={s.submitBtnText}>Send Emergency Request</Text>
                </>
            }
          </TouchableOpacity>

          <Text style={s.disclaimer}>
            Emergency mode is for genuine urgent situations. Misuse may result in account suspension.
          </Text>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  headerTitle: { color: NAVY, fontSize: 17, fontWeight: '700' },
  container:   { flexGrow: 1, padding: 20 },

  emergencyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: RED, borderRadius: 14,
    padding: 14, marginBottom: 16,
  },
  emergencyIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  emergencyInfo:  { flex: 1 },
  emergencyTitle: { color: BG, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  emergencySub:   { color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 16 },

  rulesCard: {
    backgroundColor: '#FFF5F5', borderRadius: 14,
    borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.2)',
    padding: 14, marginBottom: 20, gap: 10,
  },
  rulesTitle: { color: RED, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  ruleRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleIcon:   { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ruleText:   { color: NAVY, fontSize: 13, flex: 1 },

  label: { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },

  catCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8F8FB', borderRadius: 13,
    borderWidth: 0.5, borderColor: BORDER,
    padding: 14, marginBottom: 8,
  },
  catCardActive:  { backgroundColor: '#FFF5F5', borderColor: 'rgba(239,68,68,0.3)' },
  catEmoji:       { fontSize: 24, flexShrink: 0 },
  catInfo:        { flex: 1 },
  catName:        { color: NAVY, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  catNameActive:  { color: RED },
  catDesc:        { color: MUTED, fontSize: 11 },
  radio:          { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioActive:    { borderColor: RED },
  radioInner:     { width: 10, height: 10, borderRadius: 5, backgroundColor: RED },

  textarea: {
    backgroundColor: '#F5F5F8', borderRadius: 13,
    borderWidth: 0.5, borderColor: BORDER,
    padding: 13, color: NAVY, fontSize: 14,
    lineHeight: 22, minHeight: 90,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F8', borderRadius: 12,
    borderWidth: 0.5, borderColor: BORDER,
    paddingHorizontal: 13, paddingVertical: 13,
  },
  input: { color: NAVY, fontSize: 14 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 10, padding: 12, marginTop: 14,
  },
  errorText: { color: RED, fontSize: 12, flex: 1 },

  submitBtn: {
    backgroundColor: RED, borderRadius: 13, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10, marginTop: 20, marginBottom: 12,
  },
  submitBtnDisabled: { backgroundColor: 'rgba(239,68,68,0.3)' },
  submitBtnText:     { color: BG, fontSize: 15, fontWeight: '700' },
  disclaimer:        { color: MUTED, fontSize: 11, textAlign: 'center', lineHeight: 17 },
});
