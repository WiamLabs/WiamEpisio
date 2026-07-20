/**
 * WiamEpisio-VIP-Checkout.html — plan picker → in-app payment.
 * Plans from route.params.plans or GET /vip/plans.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { X, Crown, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import vipApi from '../../api/vip';
import useAuthStore from '../../store/useAuthStore';

const FALLBACK_PLANS = [
  { id: 'monthly', name: 'Monthly', sub: 'Billed every month', price_label: '₵35', period: '/month' },
  {
    id: 'quarterly', name: 'Quarterly', sub: 'Billed every 3 months',
    price_label: '₵84', period: '₵28/mo', save: 'SAVE 20%', popular: true,
  },
  {
    id: 'yearly', name: 'Yearly', sub: 'Billed once a year',
    price_label: '₵273', period: '₵22.75/mo', save: 'SAVE 35%',
  },
];

const BENEFITS = [
  'Unlimited access to every VIP-exclusive series',
  'New episodes unlocked the moment they drop — no waiting',
  'Zero ads, anywhere in the app',
  'Download episodes for offline viewing',
];

function normalizePlans(raw) {
  const list = raw?.plans || (Array.isArray(raw) ? raw : null);
  if (!list?.length) return FALLBACK_PLANS;
  return list.map((p, i) => ({
    id: p.id || p.plan_id || `plan_${i}`,
    name: p.name || p.title || p.label || 'Plan',
    sub: p.sub || p.description || p.billing_note || '',
    price_label: p.price_label || p.display_price || (p.price_ghs != null ? `₵${p.price_ghs}` : p.price) || '—',
    period: p.period || p.per_month_label || p.interval_label || '',
    save: p.save || p.save_tag || p.badge || null,
    popular: !!(p.popular || p.is_popular || p.recommended),
    amount: p.amount || p.price_ghs || p.price,
  }));
}

const VipCheckoutScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const paramPlans = route.params?.plans;

  const [plans, setPlans] = useState(() => normalizePlans(paramPlans ? { plans: paramPlans } : null));
  const [selected, setSelected] = useState(plans[1]?.id || plans[0]?.id);
  const [loading, setLoading] = useState(!paramPlans);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (paramPlans?.length) {
      const n = normalizePlans({ plans: paramPlans });
      setPlans(n);
      setSelected((cur) => (n.some((p) => p.id === cur) ? cur : (n.find((p) => p.popular)?.id || n[0].id)));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await vipApi.plans();
      const n = normalizePlans(data);
      setPlans(n);
      setSelected(n.find((p) => p.popular)?.id || n[0].id);
      setError(null);
    } catch {
      setPlans(FALLBACK_PLANS);
      setSelected(FALLBACK_PLANS[1].id);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [paramPlans]);

  useEffect(() => { load(); }, [load]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selected) || plans[0],
    [plans, selected],
  );

  const continuePay = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    if (!selectedPlan?.id) return;
    setBusy(true);
    setError(null);
    try {
      const data = await vipApi.initialize(selectedPlan.id);
      const url = data?.authorization_url || data?.checkout_url || data?.url;
      if (!url) {
        setError(data?.error || 'Checkout unavailable');
        return;
      }
      navigation.navigate('CheckoutWeb', {
        checkoutUrl: url,
        reference: data?.reference,
        packLabel: `${selectedPlan.name} VIP`,
        totalLabel: selectedPlan.price_label,
        amount: selectedPlan.price_label,
        label: `VIP ${selectedPlan.name}`,
      });
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e?.message || 'Failed to start checkout');
      setError(msg);
      Alert.alert('VIP Checkout', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <X size={15} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>VIP Membership</Text>
      </View>

      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.vipIcon}>
          <Crown size={26} color={COLORS.navy} fill={COLORS.navy} />
        </LinearGradient>
        <Text style={styles.heroTitle}>Watch without limits</Text>
        <Text style={styles.heroSub}>Every VIP title, zero coin cost, ad-free</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            {plans.map((p) => {
              const on = p.id === selected;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.planCard, on && styles.planSelected]}
                  onPress={() => setSelected(p.id)}
                  activeOpacity={0.85}
                >
                  {p.save ? <Text style={styles.saveTag}>{p.save}</Text> : null}
                  <View style={[styles.radio, on && styles.radioOn]}>
                    {on ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={styles.planName}>{p.name}</Text>
                    {p.sub ? <Text style={styles.planSub}>{p.sub}</Text> : null}
                  </View>
                  <View style={styles.planPrice}>
                    <Text style={styles.planPriceB}>{p.price_label}</Text>
                    {p.period ? <Text style={styles.planPeriod}>{p.period}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.benefitsTitle}>What you get</Text>
            {BENEFITS.map((b) => (
              <View key={b} style={styles.benefitRow}>
                <Check size={16} color={COLORS.gold} />
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.priceSummary}>
              <Text style={styles.priceSummaryLabel}>Total today</Text>
              <Text style={styles.priceSummaryAmt}>{selectedPlan?.price_label || '—'}</Text>
            </View>
            <EpisioGoldButton
              label="Continue to Payment"
              onPress={continuePay}
              loading={busy}
              style={{ marginBottom: 8 }}
            />
            <Text style={styles.footerNote}>
              Auto-renews · Cancel anytime in Settings
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 4,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontSize: 18, fontFamily: FONTS.extraBold, color: '#fff' },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 18 },
  vipIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 16, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 4 },
  heroSub: { fontSize: 11.5, color: COLORS.textDim, fontFamily: FONTS.regular },
  planCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.navyCard, borderWidth: 1.5, borderColor: COLORS.navyLine,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 15, marginBottom: 10,
    position: 'relative',
  },
  planSelected: {
    borderColor: COLORS.gold, backgroundColor: 'rgba(212,160,23,0.12)',
  },
  saveTag: {
    position: 'absolute', top: -8, right: 14, fontSize: 8.5, fontFamily: FONTS.extraBold,
    color: COLORS.navy, backgroundColor: COLORS.gold, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, overflow: 'hidden',
  },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.navyLine,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: COLORS.gold },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },
  planInfo: { flex: 1 },
  planName: { fontSize: 13.5, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 3 },
  planSub: { fontSize: 10.5, color: COLORS.textDim, fontFamily: FONTS.regular },
  planPrice: { alignItems: 'flex-end' },
  planPriceB: { fontSize: 15, fontFamily: FONTS.extraBold, color: '#fff' },
  planPeriod: { fontSize: 9.5, color: COLORS.textFaint, fontFamily: FONTS.regular },
  benefitsTitle: {
    fontSize: 12, fontFamily: FONTS.extraBold, color: COLORS.textDim,
    letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 20, marginBottom: 12,
  },
  benefitRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  benefitText: { flex: 1, fontSize: 12, color: '#E7E7F2', fontFamily: FONTS.regular, lineHeight: 18 },
  error: { color: COLORS.error, fontFamily: FONTS.medium, marginTop: 8, fontSize: 13 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  priceSummary: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  priceSummaryLabel: { fontSize: 11.5, color: COLORS.textDim, fontFamily: FONTS.regular },
  priceSummaryAmt: { fontSize: 18, color: '#fff', fontFamily: FONTS.extraBold },
  footerNote: {
    textAlign: 'center', fontSize: 10, color: COLORS.textFaint, fontFamily: FONTS.regular,
  },
});

export default VipCheckoutScreen;
