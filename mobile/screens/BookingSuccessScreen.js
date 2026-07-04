// © 2026 WiamApp. Powered by WiamLabs
// screens/BookingSuccessScreen.js
// Shown after booking request is sent successfully

import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const BG   = '#FFFFFF';
const NAVY = '#0D0D2B';
const GOLD = '#D4A017';
const MUTED = '#888899';

export default function BookingSuccessScreen({ navigation, route }) {
  const { bookingRef, workerName } = route?.params || {};
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <View style={s.container}>

        {/* Animated checkmark */}
        <Animated.View style={[s.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <View style={s.iconOuter}>
            <View style={s.iconInner}>
              <Ionicons name="checkmark" size={40} color={BG} />
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <Text style={s.title}>Booking Request Sent!</Text>
          <Text style={s.subtitle}>
            Your request has been sent to{' '}
            <Text style={s.workerName}>{workerName || 'the worker'}</Text>.
            {'\n'}They will respond shortly.
          </Text>

          {/* Booking ref */}
          {bookingRef && (
            <View style={s.refCard}>
              <Text style={s.refLabel}>BOOKING REFERENCE</Text>
              <Text style={s.refValue}>{bookingRef}</Text>
              <Text style={s.refNote}>Save this for your records</Text>
            </View>
          )}

          {/* What happens next */}
          <View style={s.stepsCard}>
            <Text style={s.stepsTitle}>WHAT HAPPENS NEXT</Text>
            {[
              { icon: 'notifications-outline',    text: 'Worker accepts your request' },
              { icon: 'chatbubbles-outline',       text: 'Chat opens — agree on final price' },
              { icon: 'card-outline',              text: 'Pay securely — money held in escrow' },
              { icon: 'checkmark-circle-outline',  text: 'Job done — release payment' },
            ].map((step, i) => (
              <View key={i} style={s.stepRow}>
                <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                <View style={s.stepIcon}>
                  <Ionicons name={step.icon} size={15} color={GOLD} />
                </View>
                <Text style={s.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => navigation.navigate('Bookings')}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>View My Bookings</Text>
            <Ionicons name="arrow-forward" size={16} color={NAVY} style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={s.secondaryBtn}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  container: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', paddingBottom: 20 },

  iconWrap:  { marginBottom: 28 },
  iconOuter: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
  },
  iconInner: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
  },

  title:      { color: NAVY, fontSize: 24, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  subtitle:   { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  workerName: { color: GOLD, fontWeight: '600' },

  refCard: {
    backgroundColor: '#F8F8FB', borderRadius: 13,
    borderWidth: 0.5, borderColor: '#EBEBEB',
    padding: 16, width: '100%',
    alignItems: 'center', marginBottom: 20,
  },
  refLabel: { color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  refValue: { color: NAVY, fontSize: 20, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  refNote:  { color: MUTED, fontSize: 11 },

  stepsCard: {
    backgroundColor: '#F8F8FB', borderRadius: 14,
    borderWidth: 0.5, borderColor: '#EBEBEB',
    padding: 16, width: '100%', marginBottom: 24, gap: 12,
  },
  stepsTitle: { color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  stepRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum:    { width: 20, height: 20, borderRadius: 10, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText:{ color: NAVY, fontSize: 10, fontWeight: '800' },
  stepIcon:   { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(212,160,23,0.10)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepText:   { color: NAVY, fontSize: 13, flex: 1 },

  primaryBtn: {
    backgroundColor: GOLD, borderRadius: 13, paddingVertical: 15,
    width: '100%', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  primaryBtnText: { color: NAVY, fontSize: 15, fontWeight: '700' },
  secondaryBtn:   { color: MUTED, fontSize: 14 },
});
