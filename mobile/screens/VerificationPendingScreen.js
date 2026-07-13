// © 2026 WiamApp. Powered by WiamLabs
// screens/VerificationPendingScreen.js
// Shown ONLY after worker actually submits ID + selfie to the admin queue

import React, { useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BrandLogo from '../components/BrandLogo';

const BG    = '#0D0D2B';
const GOLD  = '#D4A017';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.45)';

export default function VerificationPendingScreen({ navigation, route }) {
  const { user, refreshUser } = useAuth();
  const email = route?.params?.email || user?.email || '';

  useEffect(() => {
    if (!user?.id) return;
    const check = async () => {
      try {
        const { data } = await supabase
          .from('worker_profiles')
          .select('is_verified')
          .eq('user_id', user.id)
          .single();
        if (data?.is_verified) {
          await refreshUser();
          navigation.replace('WorkerApp');
        }
      } catch {}
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={s.container}>

        <BrandLogo size="md" />

        <View style={s.iconWrap}>
          <Ionicons name="time-outline" size={40} color={GOLD} />
        </View>

        <Text style={s.title}>Verification submitted</Text>
        <Text style={s.subtitle}>
          Our team will review your documents within{' '}
          <Text style={s.highlight}>24 hours</Text>.
          We will notify you by email and in-app when done.
        </Text>

        <View style={s.statusCard}>
          <View style={s.statusRow}>
            <View style={[s.statusDot, s.statusDotDone]} />
            <Text style={s.statusText}>Documents uploaded</Text>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
          </View>
          <View style={s.statusDivider} />
          <View style={s.statusRow}>
            <View style={[s.statusDot, s.statusDotActive]} />
            <Text style={s.statusText}>Admin review in progress</Text>
            <View style={s.statusPendingBadge}>
              <Text style={s.statusPendingBadgeText}>PENDING</Text>
            </View>
          </View>
          <View style={s.statusDivider} />
          <View style={s.statusRow}>
            <View style={s.statusDot} />
            <Text style={[s.statusText, { color: 'rgba(255,255,255,0.3)' }]}>Verification approved</Text>
          </View>
        </View>

        <View style={s.canDoCard}>
          <Text style={s.canDoTitle}>While you wait</Text>
          <View style={s.canDoRow}>
            <Ionicons name="checkmark-circle-outline" size={15} color="#22C55E" />
            <Text style={s.canDoText}>Browse the app freely</Text>
          </View>
          <View style={s.canDoRow}>
            <Ionicons name="checkmark-circle-outline" size={15} color="#22C55E" />
            <Text style={s.canDoText}>Set up your worker profile</Text>
          </View>
          <View style={s.canDoRow}>
            <Ionicons name="checkmark-circle-outline" size={15} color="#22C55E" />
            <Text style={s.canDoText}>Choose your subscription plan</Text>
          </View>
          <View style={s.canDoRow}>
            <Ionicons name="close-circle-outline" size={15} color="#EF4444" />
            <Text style={[s.canDoText, { color: 'rgba(255,255,255,0.4)' }]}>
              Accept jobs (available after approval)
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={s.browseBtn}
          onPress={() => navigation.replace('WorkerApp')}
          activeOpacity={0.85}
        >
          <Text style={s.browseBtnText}>Browse WiamApp</Text>
          <Ionicons name="arrow-forward" size={16} color={BG} style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        {email ? (
          <Text style={s.emailNote}>
            Confirmation sent to <Text style={s.emailHighlight}>{email}</Text>
          </Text>
        ) : null}

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
  iconWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(212,160,23,0.10)',
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title:     { color: WHITE, fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle:  { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  highlight: { color: GOLD, fontWeight: '600' },

  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16, width: '100%', marginBottom: 14,
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  statusDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.15)', flexShrink: 0,
  },
  statusDotDone:   { backgroundColor: '#22C55E' },
  statusDotActive: { backgroundColor: GOLD },
  statusText:      { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  statusDivider: {
    width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 4, marginVertical: 6,
  },
  statusPendingBadge: {
    backgroundColor: 'rgba(212,160,23,0.15)',
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  statusPendingBadgeText: { color: GOLD, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },

  canDoCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16, width: '100%', marginBottom: 24, gap: 10,
  },
  canDoTitle: { color: WHITE, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  canDoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  canDoText:  { color: 'rgba(255,255,255,0.65)', fontSize: 13 },

  browseBtn: {
    backgroundColor: GOLD, borderRadius: 13,
    paddingVertical: 15, width: '100%',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginBottom: 14,
  },
  browseBtnText: { color: BG, fontSize: 15, fontWeight: '700' },
  emailNote:     { color: MUTED, fontSize: 12, textAlign: 'center', marginBottom: 20 },
  emailHighlight:{ color: GOLD },
  copyright:     { color: 'rgba(212,160,23,0.3)', fontSize: 10, letterSpacing: 0.5 },
});
