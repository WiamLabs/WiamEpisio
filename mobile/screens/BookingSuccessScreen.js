// © 2026 WiamApp. Powered by WiamLabs
// screens/BookingSuccessScreen.js
// Shown after booking request is sent successfully

import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

const TIMELINE = [
  { key: 'sent', label: 'Request sent', state: 'done' },
  { key: 'accept', label: 'Waiting for worker to accept', state: 'pending' },
  { key: 'pay', label: 'Make payment (held in escrow)', state: 'future' },
  { key: 'done', label: 'Job completed & confirmed', state: 'future' },
];

export default function BookingSuccessScreen({ navigation, route }) {
  const { bookingRef, workerName } = route?.params || {};
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <View style={s.container}>

        <Animated.View style={[s.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <View style={s.checkCircle}>
            <Ionicons name="checkmark" size={38} color={Colors.gold} />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', width: '100%' }}>
          <Text style={s.title}>Request Sent!</Text>
          <Text style={s.subtitle}>
            Your booking request has been sent to{' '}
            <Text style={s.workerName}>{workerName || 'the worker'}</Text>.
            {'\n'}They will respond shortly.
          </Text>

          {bookingRef ? (
            <View style={s.refCard}>
              <Text style={s.refLabel}>Booking Reference</Text>
              <Text style={s.refValue}>{bookingRef}</Text>
            </View>
          ) : null}

          <View style={s.timeline}>
            {TIMELINE.map((item) => (
              <View key={item.key} style={s.tlRow}>
                <View style={[
                  s.tlDot,
                  item.state === 'done' && s.tlDotDone,
                  item.state === 'pending' && s.tlDotPending,
                ]} />
                <Text style={[s.tlText, item.state === 'future' && s.tlTextFuture]}>
                  {item.key === 'sent' && workerName
                    ? `Request sent to ${workerName}`
                    : item.label}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>

      <View style={s.actionBar}>
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => navigation.navigate('Bookings')}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>View My Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondaryBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={s.secondaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.footerCopy}>© 2026 WiamApp · Powered by WiamLabs</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  container: {
    flex: 1, paddingHorizontal: 30, alignItems: 'center', justifyContent: 'center',
  },
  iconWrap: { marginBottom: 20 },
  checkCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(212,160,23,0.12)', borderWidth: 2, borderColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: Colors.white, fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: Colors.textDim, fontSize: 12.5, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  workerName: { color: Colors.white, fontWeight: '600' },
  refCard: {
    width: '100%', backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 18, padding: 16, marginBottom: 20, alignItems: 'center',
  },
  refLabel: { color: Colors.textFaint, fontSize: 10.5, marginBottom: 4 },
  refValue: { color: Colors.gold, fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  timeline: { width: '100%', marginBottom: 16 },
  tlRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, alignItems: 'flex-start' },
  tlDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: Colors.navyLine },
  tlDotDone: { backgroundColor: Colors.success },
  tlDotPending: { backgroundColor: Colors.gold },
  tlText: { fontSize: 12, color: '#C9C9DE', flex: 1 },
  tlTextFuture: { color: Colors.textFaint },
  actionBar: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  primaryBtn: {
    backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 14, alignItems: 'center',
  },
  primaryBtnText: { color: Colors.navy, fontSize: 14, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 16, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.navyLine,
  },
  secondaryBtnText: { color: '#C9C9DE', fontSize: 13, fontWeight: '600' },
  footerCopy: { textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingBottom: 16 },
});
