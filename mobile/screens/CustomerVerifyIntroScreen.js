// © 2026 WiamApp. Powered by WiamLabs
// screens/CustomerVerifyIntroScreen.js
// Shown when customer tries to book for the first time
// Plan: Customer verifies before first booking — not at registration

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const LOGO  = require('../assets/logo.png');
const BG    = '#0D0D2B';
const GOLD  = '#D4A017';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.45)';

const WHY_VERIFY = [
  { icon: 'shield-checkmark-outline', text: 'Protects workers from fraudulent bookings' },
  { icon: 'person-outline',           text: 'Confirms you are a real person before payment' },
  { icon: 'lock-closed-outline',      text: 'Keeps WiamApp safe and trusted for everyone' },
  { icon: 'checkmark-circle-outline', text: 'One-time process — verified for all future bookings' },
];

export default function CustomerVerifyIntroScreen({ navigation, route }) {
  const { bookingData, token } = route?.params || {};

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>

        {/* Logo */}
        <View style={s.brand}>
          <Image source={LOGO} style={s.logo} resizeMode="contain" />
        </View>

        {/* Icon */}
        <View style={s.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={36} color={GOLD} />
        </View>

        <Text style={s.title}>One-time verification</Text>
        <Text style={s.subtitle}>
          Before your first booking, we need to confirm your identity.
          This protects the workers you hire on WiamApp.
        </Text>

        {/* Why verify */}
        <View style={s.whyCard}>
          <Text style={s.whyTitle}>WHY WE VERIFY CUSTOMERS</Text>
          {WHY_VERIFY.map((item, i) => (
            <View key={i} style={s.whyRow}>
              <View style={s.whyIcon}>
                <Ionicons name={item.icon} size={15} color={GOLD} />
              </View>
              <Text style={s.whyText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* What you need */}
        <View style={s.needCard}>
          <Text style={s.needTitle}>WHAT YOU NEED</Text>
          <View style={s.needRow}>
            <Ionicons name="id-card-outline" size={16} color={GOLD} />
            <Text style={s.needText}>
              A valid government-issued ID{'\n'}
              <Text style={s.needSub}>Ghana Card, Passport, Driver License, Voter ID</Text>
            </Text>
          </View>
          <View style={s.needRow}>
            <Ionicons name="camera-outline" size={16} color={GOLD} />
            <Text style={s.needText}>
              A live selfie{'\n'}
              <Text style={s.needSub}>Front camera — no filters, good lighting</Text>
            </Text>
          </View>
        </View>

        {/* Time notice */}
        <View style={s.timeNotice}>
          <Ionicons name="time-outline" size={15} color={GOLD} style={{ flexShrink: 0 }} />
          <Text style={s.timeNoticeText}>
            Admin reviews within 24 hours. Your booking will be held until approved.
            You will be notified by email and in-app when done.
          </Text>
        </View>

        {/* Start button */}
        <TouchableOpacity
          style={s.startBtn}
          onPress={() => navigation.navigate('CustomerIDUpload', { bookingData, token })}
          activeOpacity={0.85}
        >
          <Text style={s.startBtnText}>Start Verification</Text>
          <Ionicons name="arrow-forward" size={16} color={BG} style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.cancelText}>Not now — go back</Text>
        </TouchableOpacity>

        <Text style={s.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  backBtn:   { alignSelf: 'flex-start', marginTop: 16, marginBottom: 8, width: 40 },
  brand:     { marginBottom: 16 },
  logo:      { width: 48, height: 48 },
  iconWrap: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: 'rgba(212,160,23,0.10)',
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  title:    { color: WHITE, fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 21, marginBottom: 22 },

  whyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16, width: '100%', marginBottom: 14,
  },
  whyTitle: {
    color: GOLD, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 14,
  },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  whyIcon: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: 'rgba(212,160,23,0.10)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  whyText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, flex: 1 },

  needCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16, width: '100%', marginBottom: 14, gap: 14,
  },
  needTitle: {
    color: GOLD, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 4,
  },
  needRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  needText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, flex: 1, lineHeight: 20 },
  needSub:  { color: MUTED, fontSize: 11 },

  timeNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderRadius: 12, padding: 13,
    borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.2)',
    width: '100%', marginBottom: 24,
  },
  timeNoticeText: { color: MUTED, fontSize: 12, lineHeight: 18, flex: 1 },

  startBtn: {
    backgroundColor: GOLD, borderRadius: 13,
    paddingVertical: 15, width: '100%',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginBottom: 12,
  },
  startBtnText: { color: BG, fontSize: 15, fontWeight: '700' },
  cancelText:   { color: MUTED, fontSize: 13, marginBottom: 24 },
  copyright:    { color: 'rgba(212,160,23,0.3)', fontSize: 10, letterSpacing: 0.5 },
});
