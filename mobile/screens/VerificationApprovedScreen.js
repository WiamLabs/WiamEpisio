// © 2026 WiamApp. Powered by WiamLabs
// screens/VerificationApprovedScreen.js

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const LOGO  = require('../assets/logo.png');
const BG    = '#0D0D2B';
const GOLD  = '#D4A017';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.45)';

export default function VerificationApprovedScreen({ navigation }) {
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={s.container}>
        <Image source={LOGO} style={s.logo} resizeMode="contain" />

        <View style={s.iconWrap}>
          <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
        </View>

        <Text style={s.title}>You are verified! 🎉</Text>
        <Text style={s.subtitle}>
          Your identity has been approved by WiamLabs.
          You now appear in search results and can accept jobs.
        </Text>

        {[
          { icon: 'search-outline',          text: 'You appear in customer search results' },
          { icon: 'briefcase-outline',        text: 'Accept and complete jobs on WiamApp' },
          { icon: 'ribbon-outline',           text: 'Earn ratings and build your reputation' },
          { icon: 'wallet-outline',           text: 'Get paid safely after every job' },
          { icon: 'shield-checkmark-outline', text: 'Verified badge shown on your profile' },
        ].map((item, i) => (
          <View key={i} style={s.benefitRow}>
            <View style={s.benefitIcon}>
              <Ionicons name={item.icon} size={16} color={GOLD} />
            </View>
            <Text style={s.benefitText}>{item.text}</Text>
          </View>
        ))}

        <TouchableOpacity
          style={s.startBtn}
          onPress={() => navigation.replace('WorkerApp')}
          activeOpacity={0.85}
        >
          <Text style={s.startBtnText}>Start Working</Text>
          <Ionicons name="arrow-forward" size={16} color={BG} style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        <Text style={s.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  container: {
    flex: 1, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'center', paddingBottom: 30,
  },
  logo: { width: 48, height: 48, marginBottom: 20 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title:    { color: WHITE, fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  benefitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 9, borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)', width: '100%',
  },
  benefitIcon: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: 'rgba(212,160,23,0.10)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  benefitText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, flex: 1 },
  startBtn: {
    backgroundColor: GOLD, borderRadius: 13,
    paddingVertical: 15, width: '100%',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 28, marginBottom: 16,
  },
  startBtnText: { color: BG, fontSize: 15, fontWeight: '700' },
  copyright:    { color: 'rgba(212,160,23,0.3)', fontSize: 10, letterSpacing: 0.5 },
});
