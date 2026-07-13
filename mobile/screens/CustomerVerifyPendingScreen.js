// © 2026 WiamApp. Powered by WiamLabs
// screens/CustomerVerifyPendingScreen.js
// Shown after customer submits verification docs
// Customer can still browse but booking is held until approved

import React, { useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BrandLogo from '../components/BrandLogo';

const BG    = '#0D0D2B';
const GOLD  = '#D4A017';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.45)';

export default function CustomerVerifyPendingScreen({ navigation, route }) {
  const { user, refreshUser } = useAuth();

  // ✅ Poll every 30 seconds — auto-navigate when admin approves
  useEffect(() => {
    if (!user?.id) return;
    const check = async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('is_verified')
          .eq('id', user.id)
          .single();
        if (data?.is_verified) {
          await refreshUser();
          navigation.replace('CustomerApp');
        }
      } catch {}
    };
    check(); // Check immediately on mount
    const interval = setInterval(check, 30000); // Then every 30s
    return () => clearInterval(interval);
  }, [user?.id]);
  const { bookingData } = route?.params || {};

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
          Your booking request is saved and will be confirmed once approved.
        </Text>

        {/* Status tracker */}
        <View style={s.statusCard}>
          <View style={s.statusRow}>
            <View style={[s.dot, s.dotDone]} />
            <Text style={s.statusText}>Documents uploaded</Text>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
          </View>
          <View style={s.statusLine} />
          <View style={s.statusRow}>
            <View style={[s.dot, s.dotActive]} />
            <Text style={s.statusText}>Admin review in progress</Text>
            <View style={s.pendingBadge}>
              <Text style={s.pendingBadgeText}>PENDING</Text>
            </View>
          </View>
          <View style={s.statusLine} />
          <View style={s.statusRow}>
            <View style={s.dot} />
            <Text style={[s.statusText, { color: 'rgba(255,255,255,0.3)' }]}>Booking confirmed</Text>
          </View>
        </View>

        {/* What happens next */}
        <View style={s.nextCard}>
          <Text style={s.nextTitle}>WHAT HAPPENS NEXT</Text>
          {[
            { icon: 'notifications-outline',    text: 'You get a notification when approved' },
            { icon: 'checkmark-circle-outline', text: 'Your booking is automatically confirmed' },
            { icon: 'shield-checkmark-outline', text: 'You are verified for all future bookings' },
          ].map((item, i) => (
            <View key={i} style={s.nextRow}>
              <View style={s.nextIcon}>
                <Ionicons name={item.icon} size={15} color={GOLD} />
              </View>
              <Text style={s.nextText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Browse button */}
        <TouchableOpacity
          style={s.browseBtn}
          onPress={() => navigation.replace('CustomerApp')}
          activeOpacity={0.85}
        >
          <Text style={s.browseBtnText}>Browse WiamApp</Text>
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusLine: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 4, marginVertical: 6 },
  statusText: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  dot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.15)', flexShrink: 0 },
  dotDone:    { backgroundColor: '#22C55E' },
  dotActive:  { backgroundColor: GOLD },
  pendingBadge: { backgroundColor: 'rgba(212,160,23,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  pendingBadgeText: { color: GOLD, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },

  nextCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16, width: '100%', marginBottom: 24, gap: 12,
  },
  nextTitle: { color: GOLD, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  nextRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(212,160,23,0.10)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  nextText: { color: 'rgba(255,255,255,0.65)', fontSize: 13, flex: 1 },

  browseBtn: {
    backgroundColor: GOLD, borderRadius: 13, paddingVertical: 15,
    width: '100%', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  browseBtnText: { color: BG, fontSize: 15, fontWeight: '700' },
  copyright:     { color: 'rgba(212,160,23,0.3)', fontSize: 10, letterSpacing: 0.5 },
});
