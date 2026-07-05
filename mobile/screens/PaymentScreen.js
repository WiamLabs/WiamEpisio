// © 2026 WiamApp. Powered by WiamLabs
// screens/PaymentScreen.js
// Paystack payment — money goes to escrow, not directly to worker
// Backend: POST /api/payments/paystack/initiate, GET /api/payments/paystack/verify/:reference

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useAuth } from '../lib/AuthContext';

const BG      = '#FFFFFF';
const NAVY    = '#0D0D2B';
const GOLD    = '#D4A017';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const BORDER  = '#EBEBEB';
const MUTED   = '#888899';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function PaymentScreen({ navigation, route }) {
  const { bookingId, amount, workerName, currency = 'GHS' } = route?.params || {};
  const { session, user } = useAuth();

  const [loading,        setLoading]        = useState(false);
  const [paymentUrl,     setPaymentUrl]     = useState(null);
  const [verifying,      setVerifying]      = useState(false);
  const [error,          setError]          = useState('');

  // Commission already calculated on backend
  // Platform fee shown for transparency
  const platformFee    = amount ? (amount * 0.15).toFixed(2) : '0';
  const totalAmount    = amount ? parseFloat(amount).toFixed(2) : '0';

  const handleInitialize = async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${BACKEND}/api/payments/paystack/initiate`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body:    JSON.stringify({ bookingId, amount: parseFloat(amount), currency, email: user?.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment initialization failed.');
      setPaymentUrl(data.authorizationUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewNav = async (navState) => {
    const url = navState.url;
    // Paystack redirects to callback URL after payment
    if (url.includes('wiamapp.com/payment/callback') || url.includes('payment/success')) {
      setPaymentUrl(null);
      setVerifying(true);
      try {
        const reference = url.split('reference=')[1]?.split('&')[0];
        // Real status change (escrow, contact reveal, notifications)
        // happens server-to-server via the Paystack webhook, which
        // has usually already fired by the time this redirect lands.
        // This call just confirms status quickly for the UI.
        const res  = await fetch(`${BACKEND}/api/payments/paystack/verify/${reference}`, {
          method:  'GET',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Payment verification failed.');
        navigation.replace('PaymentSuccess', { bookingId, workerName, amount });
      } catch (err) {
        setError(err.message);
      } finally {
        setVerifying(false);
      }
    }
    if (url.includes('payment/cancel') || url.includes('payment/failed')) {
      setPaymentUrl(null);
      setError('Payment was cancelled or failed. Please try again.');
    }
  };

  // Show Paystack WebView
  if (paymentUrl) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
        <View style={s.webHeader}>
          <TouchableOpacity onPress={() => setPaymentUrl(null)}>
            <Ionicons name="close" size={22} color={NAVY} />
          </TouchableOpacity>
          <Text style={s.webHeaderTitle}>Secure Payment</Text>
          <View style={s.secureIndicator}>
            <Ionicons name="lock-closed" size={12} color="#22C55E" />
            <Text style={s.secureText}>Secure</Text>
          </View>
        </View>
        <WebView
          source={{ uri: paymentUrl }}
          onNavigationStateChange={handleWebViewNav}
          startInLoadingState
          renderLoading={() => <ActivityIndicator color={GOLD} style={{ marginTop: 60 }} />}
        />
      </SafeAreaView>
    );
  }

  // Verifying payment
  if (verifying) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.verifyingWrap}>
          <ActivityIndicator color={GOLD} size="large" />
          <Text style={s.verifyingText}>Verifying payment...</Text>
          <Text style={s.verifyingSub}>Please wait. Do not close this screen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Pay for Job</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Worker */}
        <View style={s.workerCard}>
          <View style={s.workerAvatar}>
            <Text style={s.workerAvatarText}>{workerName?.[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={s.workerName}>{workerName}</Text>
            <Text style={s.workerLabel}>Service provider</Text>
          </View>
        </View>

        {/* Amount breakdown */}
        <Text style={s.sectionTitle}>PAYMENT BREAKDOWN</Text>
        <View style={s.breakdownCard}>
          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Agreed job price</Text>
            <Text style={s.breakdownValue}>GHS {totalAmount}</Text>
          </View>
          <View style={[s.breakdownRow, s.breakdownRowBorder]}>
            <Text style={s.breakdownLabel}>Platform fee (included)</Text>
            <Text style={s.breakdownValue}>GHS {platformFee}</Text>
          </View>
          <View style={[s.breakdownRow, s.breakdownRowBorder, s.totalRow]}>
            <Text style={s.totalLabel}>Total to pay</Text>
            <Text style={s.totalValue}>GHS {totalAmount}</Text>
          </View>
        </View>

        {/* Escrow notice */}
        <View style={s.escrowCard}>
          <View style={s.escrowIcon}>
            <Ionicons name="lock-closed-outline" size={18} color={GOLD} />
          </View>
          <View style={s.escrowInfo}>
            <Text style={s.escrowTitle}>Protected by Escrow</Text>
            <Text style={s.escrowDesc}>
              Your money is held safely by WiamApp.
              It is only released to the worker after you confirm the job is done right.
              If anything goes wrong, you are protected.
            </Text>
          </View>
        </View>

        {/* Payment methods */}
        <Text style={s.sectionTitle}>PAY WITH</Text>
        <View style={s.methodsCard}>
          {[
            { icon: 'phone-portrait-outline', label: 'Mobile Money (MTN, Vodafone, AirtelTigo)' },
            { icon: 'card-outline',           label: 'Visa / Mastercard' },
            { icon: 'wallet-outline',         label: 'Bank Transfer' },
          ].map((method, i) => (
            <View key={i} style={[s.methodRow, i > 0 && s.methodRowBorder]}>
              <Ionicons name={method.icon} size={18} color={GOLD} />
              <Text style={s.methodText}>{method.label}</Text>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            </View>
          ))}
        </View>

        <Text style={s.paystackNote}>
          Payments powered by Paystack — Ghana's most trusted payment platform
        </Text>

        {/* Error */}
        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Pay button */}
        <TouchableOpacity
          style={s.payBtn}
          onPress={handleInitialize}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={NAVY} />
            : <>
                <Ionicons name="lock-closed-outline" size={17} color={NAVY} />
                <Text style={s.payBtnText}>Pay GHS {totalAmount} Securely</Text>
              </>
          }
        </TouchableOpacity>

        <Text style={s.cancelNote}>
          You can cancel before the worker arrives for a full refund.
        </Text>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  headerTitle: { color: NAVY, fontSize: 17, fontWeight: '700' },
  container:   { flexGrow: 1, padding: 20 },

  webHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: BORDER, backgroundColor: BG,
  },
  webHeaderTitle:  { color: NAVY, fontSize: 16, fontWeight: '600' },
  secureIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secureText:      { color: '#22C55E', fontSize: 12, fontWeight: '600' },

  verifyingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  verifyingText: { color: NAVY, fontSize: 16, fontWeight: '600' },
  verifyingSub:  { color: MUTED, fontSize: 13 },

  workerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8F8FB', borderRadius: 13,
    padding: 14, marginBottom: 24,
    borderWidth: 0.5, borderColor: BORDER,
  },
  workerAvatar:    { width: 44, height: 44, borderRadius: 12, backgroundColor: GOLD_BG, alignItems: 'center', justifyContent: 'center' },
  workerAvatarText:{ color: GOLD, fontSize: 18, fontWeight: '700' },
  workerName:      { color: NAVY, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  workerLabel:     { color: MUTED, fontSize: 12 },

  sectionTitle: { color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },

  breakdownCard: {
    backgroundColor: '#F8F8FB', borderRadius: 14,
    borderWidth: 0.5, borderColor: BORDER,
    marginBottom: 16, overflow: 'hidden',
  },
  breakdownRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  breakdownRowBorder: { borderTopWidth: 0.5, borderTopColor: BORDER },
  breakdownLabel:     { color: MUTED, fontSize: 13 },
  breakdownValue:     { color: NAVY, fontSize: 13, fontWeight: '500' },
  totalRow:           { backgroundColor: GOLD_BG },
  totalLabel:         { color: NAVY, fontSize: 14, fontWeight: '700' },
  totalValue:         { color: GOLD, fontSize: 16, fontWeight: '800' },

  escrowCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: GOLD_BG, borderRadius: 14,
    borderWidth: 0.5, borderColor: GOLD_BD,
    padding: 14, marginBottom: 24,
  },
  escrowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(212,160,23,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  escrowInfo: { flex: 1 },
  escrowTitle:{ color: NAVY, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  escrowDesc: { color: MUTED, fontSize: 12, lineHeight: 18 },

  methodsCard: {
    backgroundColor: '#F8F8FB', borderRadius: 14,
    borderWidth: 0.5, borderColor: BORDER,
    marginBottom: 12, overflow: 'hidden',
  },
  methodRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  methodRowBorder: { borderTopWidth: 0.5, borderTopColor: BORDER },
  methodText:      { color: NAVY, fontSize: 13, flex: 1 },
  paystackNote:    { color: '#CCC', fontSize: 11, textAlign: 'center', marginBottom: 20 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText:{ color: '#EF4444', fontSize: 12, flex: 1 },

  payBtn: {
    backgroundColor: GOLD, borderRadius: 13, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10, marginBottom: 12,
  },
  payBtnText: { color: NAVY, fontSize: 15, fontWeight: '700' },
  cancelNote: { color: MUTED, fontSize: 12, textAlign: 'center' },
});
