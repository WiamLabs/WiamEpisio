/**
 * Style: WiamEpisio-Membership.html
 * Wired: GET /vip/plans, GET /vip/status, POST /vip/initialize → Paystack,
 * Restore → GET /vip/status (+ premium/status fallback).
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { X, Play, Download, Star, Ban } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';
import vipApi from '../../api/vip';

const FALLBACK_PLANS = [
  {
    id: 'weekly',
    name: 'Weekly Membership',
    display_price: 'GHS 24.99',
    display_old: 'GHS 34.99',
    badge: 'Save 29%',
    detail: 'GHS 24.99/week for the first 3 weeks, then GHS 34.99/week',
  },
  {
    id: 'annual',
    name: 'Annual Membership',
    display_price: 'GHS 299/year',
    display_old: null,
    badge: null,
    detail: 'Best value — less than GHS 6 per week',
  },
];

const FALLBACK_BENEFITS = [
  { title: 'Unlimited access to every series', sub: 'No coins needed, ever', Icon: Play },
  { title: 'Download for offline watching', sub: null, Icon: Download },
  { title: 'Daily member coin bonus', sub: null, Icon: Star },
  { title: 'Ad-free experience', sub: null, Icon: Ban },
];

const MembershipScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [selected, setSelected] = useState('weekly');
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [benefits, setBenefits] = useState(FALLBACK_BENEFITS);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const pendingPay = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (pendingPay.current?.reference && isAuthenticated) {
        const { reference, planId } = pendingPay.current;
        pendingPay.current = null;
        try {
          await vipApi.verify(reference, planId);
          Alert.alert('Membership', 'Payment confirmed — welcome!');
        } catch { /* still mid-checkout or Restore later */ }
      }
      const [p, s] = await Promise.all([
        vipApi.plans().catch(() => null),
        isAuthenticated ? vipApi.status().catch(() => null) : Promise.resolve(null),
      ]);
      if (p?.plans?.length) {
        setPlans(p.plans);
        setSelected((cur) => (p.plans.some((x) => x.id === cur) ? cur : p.plans[0].id));
      }
      if (p?.benefits?.length) {
        setBenefits(p.benefits.map((b, i) => ({
          ...b,
          Icon: FALLBACK_BENEFITS[i]?.Icon || Star,
        })));
      }
      setStatus(s);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Could not load membership');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  const restore = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    try {
      const s = await vipApi.status();
      setStatus(s);
      if (s?.is_vip) {
        Alert.alert('Membership', 'Your membership is active.');
      } else {
        Alert.alert('Restore', 'No active membership found on this account.');
      }
    } catch (e) {
      Alert.alert('Restore', typeof e === 'string' ? e : 'Could not restore');
    }
  };

  const join = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    if (status?.is_vip) {
      Alert.alert('Membership', 'You already have an active membership.');
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const data = await vipApi.initialize(selected);
      const url = data?.authorization_url;
      if (!url) throw data?.error || 'Checkout unavailable';
      if (data?.reference) pendingPay.current = { reference: data.reference, planId: selected };
      await Linking.openURL(url);
      Alert.alert(
        'Complete payment',
        'After paying in the browser, return here — we will confirm automatically. You can also tap Restore.',
      );
    } catch (e) {
      setError(typeof e === 'string' ? e : (e?.message || 'Could not start checkout'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={close}>
          <X size={15} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Join Membership</Text>
        <TouchableOpacity onPress={restore}>
          <Text style={styles.restore}>Restore</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {status?.is_vip ? (
            <View style={styles.activeBanner}>
              <Text style={styles.activeTitle}>Membership active</Text>
              <Text style={styles.activeSub}>
                {status.plan ? `${String(status.plan)} plan` : 'Member'}
                {status.expires_at ? ` · renews/ends ${String(status.expires_at).slice(0, 10)}` : ''}
              </Text>
            </View>
          ) : null}

          {plans.map((p) => {
            const active = selected === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.planCard, active && styles.planSelected]}
                onPress={() => setSelected(p.id)}
                activeOpacity={0.9}
              >
                {p.badge ? <Text style={styles.discountBadge}>{p.badge}</Text> : null}
                <Text style={styles.planName}>{p.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>{p.display_price || `GHS ${p.price_ghs}`}</Text>
                  {p.display_old ? <Text style={styles.planOld}>{p.display_old}</Text> : null}
                </View>
                <Text style={styles.planDetail}>{p.detail}</Text>
              </TouchableOpacity>
            );
          })}

          <Text style={styles.sectionLabel}>Why Join?</Text>
          {benefits.map(({ Icon, title, sub }) => (
            <View key={title} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                {Icon ? <Icon size={16} color={COLORS.gold} /> : <Star size={16} color={COLORS.gold} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.benefitTitle}>{title}</Text>
                {sub ? <Text style={styles.benefitSub}>{sub}</Text> : null}
              </View>
            </View>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.footer}>© 2026 WiamEpisio · Powered by WiamLabs</Text>
        </ScrollView>
      )}

      <View style={[styles.joinbar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.joinBtn} onPress={join} disabled={joining} activeOpacity={0.9}>
          {joining ? (
            <ActivityIndicator color={COLORS.navy} />
          ) : (
            <Text style={styles.joinBtnText}>
              {status?.is_vip ? 'Membership Active' : 'Join Now'}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={styles.joinNote}>Auto-renew · Cancel anytime · Paid via Paystack</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontSize: 19, fontFamily: FONTS.extraBold, color: '#fff' },
  restore: { fontSize: 12, color: COLORS.gold, fontFamily: FONTS.semi },
  scroll: { flex: 1, paddingHorizontal: 20 },
  activeBanner: {
    backgroundColor: 'rgba(212,160,23,0.12)', borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.gold, padding: 14, marginBottom: 14,
  },
  activeTitle: { fontFamily: FONTS.bold, color: COLORS.gold, fontSize: 14 },
  activeSub: { marginTop: 4, fontSize: 12, color: COLORS.textDim, fontFamily: FONTS.regular },
  planCard: {
    borderRadius: 20, padding: 18, marginBottom: 12,
    backgroundColor: COLORS.navyCard, borderWidth: 1.5, borderColor: COLORS.navyLine,
  },
  planSelected: {
    borderColor: COLORS.gold, backgroundColor: 'rgba(212,160,23,0.06)',
  },
  discountBadge: {
    position: 'absolute', top: -9, right: 16,
    backgroundColor: COLORS.gold, color: COLORS.navy,
    fontSize: 9.5, fontFamily: FONTS.bold, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 999, overflow: 'hidden',
  },
  planName: { fontSize: 14.5, fontFamily: FONTS.bold, color: '#fff', marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  planPrice: { fontSize: 20, fontFamily: FONTS.extraBold, color: '#fff' },
  planOld: { fontSize: 13, color: COLORS.textFaint, textDecorationLine: 'line-through' },
  planDetail: { marginTop: 4, fontSize: 11, color: COLORS.textDim, lineHeight: 15, fontFamily: FONTS.regular },
  sectionLabel: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff', marginTop: 22, marginBottom: 14 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  benefitIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(212,160,23,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  benefitTitle: { fontSize: 12.5, color: '#fff', fontFamily: FONTS.medium },
  benefitSub: { marginTop: 1, fontSize: 10.5, color: COLORS.textFaint, fontFamily: FONTS.regular },
  error: { color: '#EF4444', fontFamily: FONTS.medium, marginTop: 12, textAlign: 'center' },
  footer: { textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingVertical: 20, fontFamily: FONTS.regular },
  joinbar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.navySoft, borderTopWidth: 1, borderTopColor: '#1C1C38',
    paddingHorizontal: 20, paddingTop: 12,
  },
  joinBtn: {
    paddingVertical: 15, borderRadius: 16, backgroundColor: COLORS.gold, alignItems: 'center',
  },
  joinBtnText: { fontSize: 14.5, fontFamily: FONTS.bold, color: COLORS.navy },
  joinNote: { textAlign: 'center', fontSize: 10.5, color: COLORS.textFaint, marginTop: 8, fontFamily: FONTS.regular },
});

export default MembershipScreen;
