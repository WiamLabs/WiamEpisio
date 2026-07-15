// © 2026 WiamApp. Powered by WiamLabs
// screens/PaymentSuccessScreen.js

import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import GoldAvatar from '../components/ui/GoldAvatar';

const PAD = Colors.screenPad;

export default function PaymentSuccessScreen({ navigation, route }) {
  const { bookingId, workerName, amount } = route?.params || {};
  const scale = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const workerReceives = amount ? (parseFloat(amount) * 0.9).toFixed(0) : '0';
  const totalPaid = amount ? parseFloat(amount).toFixed(2) : '0';

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[s.hero, { transform: [{ scale }] }]}>
          <View style={s.checkCircle}>
            <Ionicons name="checkmark" size={36} color={Colors.success} />
          </View>
          <Text style={s.title}>Payment Successful</Text>
          <Text style={s.subtitle}>
            Your payment is safely held in escrow until{'\n'}the job is confirmed complete.
          </Text>
        </Animated.View>

        <Animated.View style={{ opacity: fade }}>
          <View style={s.amountBlock}>
            <Text style={s.amountLabel}>Amount Paid</Text>
            <Text style={s.amountValue}>GHS {totalPaid}</Text>
          </View>

          <View style={s.workerMini}>
            <GoldAvatar name={workerName} size={40} />
            <View>
              <Text style={s.workerName}>{workerName}</Text>
              <Text style={s.workerSub}>Payment secured in escrow</Text>
            </View>
          </View>

          <View style={s.receiptCard}>
            <View style={s.receiptRow}>
              <Text style={s.receiptLabel}>Booking</Text>
              <Text style={s.receiptValue}>#{bookingId?.slice?.(0, 8) || '—'}</Text>
            </View>
            <View style={s.receiptRow}>
              <Text style={s.receiptLabel}>Payment method</Text>
              <Text style={s.receiptValue}>Paystack</Text>
            </View>
            <View style={s.receiptRow}>
              <Text style={s.receiptLabel}>Date</Text>
              <Text style={s.receiptValue}>
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <View style={s.receiptDivider} />
            <View style={s.receiptRow}>
              <Text style={s.receiptLabel}>Service amount</Text>
              <Text style={s.receiptValue}>GHS {totalPaid}</Text>
            </View>
            <View style={s.receiptRow}>
              <Text style={s.receiptLabel}>WiamApp escrow fee</Text>
              <Text style={s.receiptValue}>GHS 0.00</Text>
            </View>
            <View style={s.receiptDivider} />
            <View style={s.receiptRow}>
              <Text style={s.receiptTotalLabel}>Total Paid</Text>
              <Text style={s.receiptTotalValue}>GHS {totalPaid}</Text>
            </View>
          </View>

          <View style={s.escrowNote}>
            <Ionicons name="lock-closed-outline" size={15} color={Colors.gold} />
            <Text style={s.escrowNoteText}>
              {workerName || 'The worker'} will receive GHS {workerReceives} (90%) automatically once you confirm the job is done in Bookings.
            </Text>
          </View>

          <Text style={s.footerCopy}>© 2026 WiamApp · Powered by WiamLabs</Text>
        </Animated.View>
      </ScrollView>

      <View style={s.actionBar}>
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => navigation.navigate('ChatRoom', { bookingId, workerName })}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubbles-outline" size={16} color={Colors.navy} />
          <Text style={s.primaryBtnText}>Chat with {workerName?.split(' ')?.[0] || 'Worker'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={() => navigation.navigate('Bookings')}
        >
          <Text style={s.secondaryBtnText}>View All Bookings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  scroll: { paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 140 },
  hero: { alignItems: 'center', paddingVertical: 20 },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 2, borderColor: Colors.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.white, marginBottom: 6 },
  subtitle: { fontSize: 12.5, color: Colors.textDim, textAlign: 'center', lineHeight: 18 },
  amountBlock: { alignItems: 'center', paddingVertical: 6, marginBottom: 20 },
  amountLabel: { fontSize: 11.5, color: Colors.textFaint, marginBottom: 4 },
  amountValue: { fontSize: 32, fontWeight: '800', color: Colors.gold },
  workerMini: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 16, padding: 13, marginBottom: 16,
  },
  workerName: { fontSize: 13, fontWeight: '600', color: Colors.white },
  workerSub: { fontSize: 11, color: Colors.textFaint, marginTop: 1 },
  receiptCard: {
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 20, padding: 18, marginBottom: 16,
  },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  receiptLabel: { fontSize: 12, color: Colors.textDim },
  receiptValue: { fontSize: 12, color: Colors.white, fontWeight: '500', textAlign: 'right' },
  receiptDivider: { height: 1, backgroundColor: Colors.navyLine, marginVertical: 8 },
  receiptTotalLabel: { fontSize: 13.5, fontWeight: '700', color: Colors.white },
  receiptTotalValue: { fontSize: 14.5, fontWeight: '800', color: Colors.gold },
  escrowNote: {
    flexDirection: 'row', gap: 9, padding: 13, borderRadius: 14,
    backgroundColor: 'rgba(212,160,23,0.08)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.2)',
    marginBottom: 16,
  },
  escrowNoteText: { fontSize: 11, color: '#D9BE6E', lineHeight: 16, flex: 1 },
  footerCopy: { textAlign: 'center', fontSize: 10, color: '#3A3A56' },
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.navySoft, borderTopWidth: 1, borderTopColor: '#1C1C38',
    paddingHorizontal: PAD, paddingTop: 14, paddingBottom: 24, gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 14,
  },
  primaryBtnText: { color: Colors.navy, fontSize: 14, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 16, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.navyLine,
  },
  secondaryBtnText: { color: '#C9C9DE', fontSize: 13, fontWeight: '600' },
});
