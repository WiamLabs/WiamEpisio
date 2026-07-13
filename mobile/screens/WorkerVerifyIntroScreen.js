// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerVerifyIntroScreen.js
// First screen of worker verification flow
// Worker sees what is required and why before starting

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BrandLogo from '../components/BrandLogo';

const BG    = '#0D0D2B';
const GOLD  = '#D4A017';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.45)';

const STEPS = [
  { icon: 'id-card-outline',          text: 'Choose your ID type' },
  { icon: 'cloud-upload-outline',     text: 'Upload clear photos of your ID' },
  { icon: 'camera-outline',           text: 'Take a live selfie for face match' },
  { icon: 'time-outline',             text: 'Admin reviews within 24 hours' },
  { icon: 'checkmark-circle-outline', text: 'Approved — you appear in search' },
];

const ID_TYPES = [
  'Ghana Card', 'Driver License', 'Passport', 'Voter ID', 'NIN Card', 'NHIS Card',
];

export default function WorkerVerifyIntroScreen({ navigation, route }) {
  const { email, token } = route?.params || {};

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View style={s.brand}>
          <BrandLogo size="md" />
        </View>

        {/* Shield icon */}
        <View style={s.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={36} color={GOLD} />
        </View>

        <Text style={s.title}>Verify your identity</Text>
        <Text style={s.subtitle}>
          WiamApp verifies every worker before they appear in search.
          This protects customers and builds your reputation.
        </Text>

        {/* Steps */}
        <View style={s.stepsWrap}>
          <Text style={s.stepsTitle}>HOW IT WORKS</Text>
          {STEPS.map((step, i) => (
            <View key={i} style={s.stepRow}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{i + 1}</Text>
              </View>
              <View style={s.stepIcon}>
                <Ionicons name={step.icon} size={17} color={GOLD} />
              </View>
              <Text style={s.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        {/* Accepted IDs */}
        <View style={s.idsWrap}>
          <Text style={s.idsTitle}>ACCEPTED ID TYPES</Text>
          <View style={s.idsGrid}>
            {ID_TYPES.map((id, i) => (
              <View key={i} style={s.idChip}>
                <Ionicons name="id-card-outline" size={12} color={GOLD} />
                <Text style={s.idChipText}>{id}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* While pending notice */}
        <View style={s.pendingNotice}>
          <Ionicons name="information-circle-outline" size={15} color={GOLD} style={{ flexShrink: 0, marginTop: 1 }} />
          <Text style={s.pendingNoticeText}>
            While your verification is pending, you can browse WiamApp freely.
            You will not be able to accept jobs until your identity is approved.
          </Text>
        </View>

        {/* Start button */}
        <TouchableOpacity
          style={s.startBtn}
          onPress={() => navigation.navigate('IDType', { email, token })}
          activeOpacity={0.85}
        >
          <Text style={s.startBtnText}>Start Verification</Text>
          <Ionicons name="arrow-forward" size={16} color={BG} style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        {/* Skip for now */}
        <TouchableOpacity
          onPress={() => navigation.replace('WorkerApp')}
        >
          <Text style={s.skipText}>Skip for now — browse first</Text>
        </TouchableOpacity>

        <Text style={s.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  brand:     { marginTop: 20, marginBottom: 16 },
  logo:      { width: 48, height: 48 },
  iconWrap: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: 'rgba(212,160,23,0.10)',
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title:    { color: WHITE, fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 21, marginBottom: 24 },

  stepsWrap: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16, width: '100%', marginBottom: 16,
  },
  stepsTitle: {
    color: GOLD, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 14,
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 12,
  },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: GOLD, alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
  },
  stepNumText: { color: BG, fontSize: 11, fontWeight: '800' },
  stepIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(212,160,23,0.10)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, flex: 1 },

  idsWrap: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16, width: '100%', marginBottom: 16,
  },
  idsTitle: {
    color: GOLD, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 12,
  },
  idsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  idChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.2)',
  },
  idChipText: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },

  pendingNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderRadius: 12, padding: 13,
    borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.2)',
    width: '100%', marginBottom: 24,
  },
  pendingNoticeText: { color: MUTED, fontSize: 12, lineHeight: 18, flex: 1 },

  startBtn: {
    backgroundColor: GOLD, borderRadius: 13,
    paddingVertical: 15, width: '100%',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginBottom: 12,
  },
  startBtnText: { color: BG, fontSize: 15, fontWeight: '700' },
  skipText:     { color: MUTED, fontSize: 13, marginBottom: 24 },
  copyright:    { color: 'rgba(212,160,23,0.3)', fontSize: 10, letterSpacing: 0.5 },
});
