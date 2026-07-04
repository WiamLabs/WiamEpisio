// © 2026 WiamApp. Powered by WiamLabs
// screens/PaymentSuccessScreen.js

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

export default function PaymentSuccessScreen({ navigation, route }) {
  const { bookingId, workerName, amount } = route?.params || {};
  const scale = useRef(new Animated.Value(0)).current;
  const fade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(fade,  { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <View style={s.container}>

        <Animated.View style={[s.iconWrap, { transform: [{ scale }] }]}>
          <View style={s.iconOuter}>
            <Ionicons name="lock-closed" size={36} color={BG} />
          </View>
        </Animated.View>

        <Animated.View style={[s.content, { opacity: fade }]}>
          <Text style={s.title}>Payment Received!</Text>
          <Text style={s.amount}>GHS {amount}</Text>
          <Text style={s.subtitle}>
            Your money is safely held in escrow.{'\n'}
            It will be released to <Text style={s.gold}>{workerName}</Text> only after you confirm the job is done right.
          </Text>

          <View style={s.infoCard}>
            {[
              { icon: 'shield-checkmark-outline', color: '#22C55E', text: 'Payment secured in WiamApp escrow' },
              { icon: 'chatbubbles-outline',       color: GOLD,      text: 'Chat with the worker about arrival time' },
              { icon: 'location-outline',          color: '#3B82F6', text: 'Worker will GPS check-in when they arrive' },
              { icon: 'checkmark-circle-outline',  color: '#22C55E', text: 'You confirm job done — payment released' },
            ].map((item, i) => (
              <View key={i} style={s.infoRow}>
                <View style={[s.infoIcon, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon} size={16} color={item.color} />
                </View>
                <Text style={s.infoText}>{item.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={s.chatBtn}
            onPress={() => navigation.navigate('ChatRoom', { bookingId, workerName })}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubbles-outline" size={17} color={NAVY} />
            <Text style={s.chatBtnText}>Open Chat with {workerName}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.bookingsBtn}
            onPress={() => navigation.navigate('Bookings')}
          >
            <Text style={s.bookingsBtnText}>View All Bookings</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  container: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', paddingBottom: 20 },
  iconWrap:  { marginBottom: 24 },
  iconOuter: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center',
    shadowColor: GOLD, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  content:   { alignItems: 'center', width: '100%' },
  title:     { color: NAVY, fontSize: 24, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  amount:    { color: GOLD, fontSize: 32, fontWeight: '800', marginBottom: 12 },
  subtitle:  { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  gold:      { color: GOLD, fontWeight: '600' },
  infoCard: {
    backgroundColor: '#F8F8FB', borderRadius: 14,
    borderWidth: 0.5, borderColor: '#EBEBEB',
    padding: 16, width: '100%', gap: 12, marginBottom: 24,
  },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoText: { color: NAVY, fontSize: 13, flex: 1, lineHeight: 19 },
  chatBtn: {
    backgroundColor: GOLD, borderRadius: 13, paddingVertical: 15,
    width: '100%', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 12,
  },
  chatBtnText:     { color: NAVY, fontSize: 15, fontWeight: '700' },
  bookingsBtn:     { paddingVertical: 10 },
  bookingsBtnText: { color: MUTED, fontSize: 14 },
});
