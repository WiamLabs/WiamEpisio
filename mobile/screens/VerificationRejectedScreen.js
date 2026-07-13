// © 2026 WiamApp. Powered by WiamLabs
// screens/VerificationRejectedScreen.js

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

export default function VerificationRejectedScreen({ navigation, route }) {
  const { reason, email } = route?.params || {};

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <BrandLogo size="md" />

        <View style={s.iconWrap}>
          <Ionicons name="close-circle" size={48} color="#EF4444" />
        </View>

        <Text style={s.title}>Verification unsuccessful</Text>
        <Text style={s.subtitle}>
          We could not verify your identity with the documents provided.
          Please try again with clearer photos.
        </Text>

        {reason ? (
          <View style={s.reasonCard}>
            <Text style={s.reasonTitle}>REASON FROM ADMIN</Text>
            <Text style={s.reasonText}>{reason}</Text>
          </View>
        ) : null}

        <View style={s.tipsCard}>
          <Text style={s.tipsTitle}>TIPS FOR SUCCESS</Text>
          {[
            'Use good lighting — no shadows',
            'Make sure all 4 corners of the ID are visible',
            'No glare or reflections on the ID',
            'Photo must be clear — not blurry',
            'Selfie must show your full face clearly',
          ].map((tip, i) => (
            <View key={i} style={s.tipRow}>
              <Ionicons name="bulb-outline" size={13} color={GOLD} />
              <Text style={s.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={s.retryBtn}
          onPress={() => navigation.replace('WorkerVerifyIntro', { email })}
          activeOpacity={0.85}
        >
          <Text style={s.retryBtnText}>Try Again</Text>
          <Ionicons name="refresh-outline" size={16} color={BG} style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.replace('WorkerApp')}>
          <Text style={s.browseText}>Browse app while I fix this</Text>
        </TouchableOpacity>

        <Text style={s.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  logo:      { width: 48, height: 48, marginTop: 20, marginBottom: 20 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title:    { color: WHITE, fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  reasonCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 13, borderWidth: 0.5,
    borderColor: 'rgba(239,68,68,0.25)',
    padding: 14, width: '100%', marginBottom: 16,
  },
  reasonTitle: { color: '#EF4444', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  reasonText:  { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 19 },
  tipsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 13, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14, width: '100%', marginBottom: 24, gap: 10,
  },
  tipsTitle: { color: GOLD, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  tipRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipText:   { color: 'rgba(255,255,255,0.6)', fontSize: 13, flex: 1, lineHeight: 19 },
  retryBtn: {
    backgroundColor: GOLD, borderRadius: 13,
    paddingVertical: 15, width: '100%',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginBottom: 14,
  },
  retryBtnText: { color: BG, fontSize: 15, fontWeight: '700' },
  browseText:   { color: MUTED, fontSize: 13, marginBottom: 24 },
  copyright:    { color: 'rgba(212,160,23,0.3)', fontSize: 10, letterSpacing: 0.5 },
});
