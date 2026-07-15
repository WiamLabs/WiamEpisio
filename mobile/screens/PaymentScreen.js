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
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const PAD = Colors.screenPad;

const PAY_METHODS = [
  { id: 'card', icon: 'card-outline', name: 'Debit / Credit Card', sub: 'Visa, Mastercard via Paystack' },
  { id: 'momo', icon: 'phone-portrait-outline', name: 'Mobile Money', sub: 'MTN, Vodafone, AirtelTigo' },
];

export default function PaymentScreen({ navigation, route }) {
  const { bookingId, amount, workerName, currency = 'GHS' } = route?.params || {};
  const { session, user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [paymentProvider, setPaymentProvider] = useState('paystack');
  const [paymentReference, setPaymentReference] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('card');

  const platformFee = amount ? (amount * 0.15).toFixed(2) : '0';
  const totalAmount = amount ? parseFloat(amount).toFixed(2) : '0';
  const workerReceives = amount ? (parseFloat(amount) * 0.9).toFixed(0) : '0';

  const handleInitialize = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND}/api/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          bookingId,
          amount: parseFloat(amount),
          currency,
          email: user?.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment initialization failed.');
      setPaymentUrl(data.checkoutUrl || data.authorizationUrl);
      setPaymentProvider(data.provider || 'paystack');
      setPaymentReference(data.reference || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewNav = async (navState) => {
    const url = navState.url;
    const isSuccess = url.includes('wiamapp.com/payment/success')
      || url.includes('wiamapp.com/payment/callback')
      || /\/payment\/success(\?|$)/.test(url);
    if (isSuccess) {
      setPaymentUrl(null);
      setVerifying(true);
      try {
        const fromUrl = url.split('reference=')[1]?.split('&')[0]
          || url.split('session_id=')[1]?.split('&')[0];
        const reference = fromUrl || paymentReference;
        const res = await fetch(
          `${BACKEND}/api/payments/verify/${encodeURIComponent(reference)}?provider=${paymentProvider}`,
          { method: 'GET', headers: { Authorization: `Bearer ${session?.access_token}` } },
        );
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

  if (paymentUrl) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.navy }}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
        <View style={s.webHeader}>
          <TouchableOpacity style={s.backBtn} onPress={() => setPaymentUrl(null)}>
            <Ionicons name="close" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={s.webHeaderTitle}>Secure Payment</Text>
          <View style={s.secureIndicator}>
            <Ionicons name="lock-closed" size={12} color={Colors.success} />
            <Text style={s.secureText}>Secure</Text>
          </View>
        </View>
        <WebView
          source={{ uri: paymentUrl }}
          onNavigationStateChange={handleWebViewNav}
          startInLoadingState
          renderLoading={() => <ActivityIndicator color={Colors.gold} style={{ marginTop: 60 }} />}
        />
      </SafeAreaView>
    );
  }

  if (verifying) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
        <View style={s.verifyingWrap}>
          <ActivityIndicator color={Colors.gold} size="large" />
          <Text style={s.verifyingText}>Verifying payment...</Text>
          <Text style={s.verifyingSub}>Please wait. Do not close this screen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Payment</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.escrowHero}>
          <View style={s.escrowIcon}>
            <Ionicons name="lock-closed-outline" size={24} color={Colors.gold} />
          </View>
          <Text style={s.escrowTitle}>Your money is protected</Text>
          <Text style={s.escrowDesc}>
            Payment is held safely by WiamApp and only released to {workerName || 'the worker'} once you confirm the job is complete.
          </Text>
        </View>

        <View style={s.breakdown}>
          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Service amount</Text>
            <Text style={s.breakdownValue}>GHS {totalAmount}</Text>
          </View>
          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Platform fee (included)</Text>
            <Text style={s.breakdownValue}>GHS {platformFee}</Text>
          </View>
          <View style={s.breakdownDivider} />
          <View style={s.breakdownRow}>
            <Text style={s.totalLabel}>Total to pay</Text>
            <Text style={s.totalValue}>GHS {totalAmount}</Text>
          </View>
          {workerName ? (
            <Text style={s.commissionNote}>
              {workerName} receives GHS {workerReceives} (90%) once the job is confirmed complete.
            </Text>
          ) : null}
        </View>

        <Text style={s.sectionLabel}>Payment method</Text>
        <View style={s.methodsWrap}>
          {PAY_METHODS.map((method) => {
            const selected = selectedMethod === method.id;
            return (
              <TouchableOpacity
                key={method.id}
                style={[s.payMethod, selected && s.payMethodSelected]}
                onPress={() => setSelectedMethod(method.id)}
                activeOpacity={0.8}
              >
                <View style={s.payIcon}>
                  <Ionicons name={method.icon} size={17} color={Colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.payName}>{method.name}</Text>
                  <Text style={s.paySub}>{method.sub}</Text>
                </View>
                <View style={[s.radio, selected && s.radioOn]}>
                  {selected ? <View style={s.radioInner} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.protectionNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color={Colors.success} />
          <Text style={s.protectionText}>
            Never pay a worker outside WiamApp. Off-platform payments are not protected and violate platform terms.
          </Text>
        </View>

        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={s.footerCopy}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>

      <View style={s.payBar}>
        <TouchableOpacity style={s.payBtn} onPress={handleInitialize} disabled={loading} activeOpacity={0.85}>
          {loading ? (
            <ActivityIndicator color={Colors.navy} />
          ) : (
            <>
              <Ionicons name="lock-closed-outline" size={16} color={Colors.navy} />
              <Text style={s.payBtnText}>Pay GHS {totalAmount}</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={s.payNote}>Secured by Paystack · Held in escrow by WiamApp</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: PAD, paddingBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },
  scroll: { paddingHorizontal: PAD, paddingBottom: 110 },
  escrowHero: {
    borderRadius: 22, padding: 20, marginBottom: 18, textAlign: 'center',
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
  },
  escrowIcon: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(212,160,23,0.12)',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12,
  },
  escrowTitle: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 6 },
  escrowDesc: { fontSize: 12, color: Colors.textDim, lineHeight: 18 },
  breakdown: {
    backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 18, padding: 16, marginBottom: 18,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  breakdownLabel: { fontSize: 12.5, color: Colors.textDim },
  breakdownValue: { fontSize: 12.5, color: Colors.white, fontWeight: '500' },
  breakdownDivider: { height: 1, backgroundColor: Colors.navyLine, marginVertical: 6 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: Colors.white },
  totalValue: { fontSize: 16, fontWeight: '800', color: Colors.gold },
  commissionNote: { fontSize: 10.5, color: Colors.textFaint, marginTop: 4 },
  sectionLabel: { fontSize: 12.5, fontWeight: '600', color: Colors.white, marginBottom: 10 },
  methodsWrap: { gap: 9, marginBottom: 18 },
  payMethod: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 13, borderRadius: 14, backgroundColor: Colors.navyCard,
    borderWidth: 1.5, borderColor: Colors.navyLine,
  },
  payMethodSelected: { borderColor: Colors.gold, backgroundColor: 'rgba(212,160,23,0.06)' },
  payIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.navySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  payName: { fontSize: 13, fontWeight: '600', color: Colors.white },
  paySub: { fontSize: 11, color: Colors.textFaint, marginTop: 1 },
  radio: {
    width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: Colors.navyLine,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.gold, backgroundColor: Colors.gold },
  radioInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.navy },
  protectionNote: {
    flexDirection: 'row', gap: 9, padding: 12, borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
  },
  protectionText: { fontSize: 11, color: '#8FD6A8', lineHeight: 16, flex: 1 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginTop: 14,
  },
  errorText: { color: Colors.error, fontSize: 12, flex: 1 },
  footerCopy: { textAlign: 'center', fontSize: 10, color: '#3A3A56', marginTop: 18 },
  payBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.navySoft, borderTopWidth: 1, borderTopColor: '#1C1C38',
    paddingHorizontal: PAD, paddingTop: 14, paddingBottom: 24,
  },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 14,
  },
  payBtnText: { color: Colors.navy, fontSize: 14.5, fontWeight: '700' },
  payNote: { textAlign: 'center', fontSize: 10.5, color: Colors.textFaint, marginTop: 8 },
  webHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.navyLine,
  },
  webHeaderTitle: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  secureIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secureText: { color: Colors.success, fontSize: 12, fontWeight: '600' },
  verifyingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  verifyingText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  verifyingSub: { color: Colors.textDim, fontSize: 13 },
});
