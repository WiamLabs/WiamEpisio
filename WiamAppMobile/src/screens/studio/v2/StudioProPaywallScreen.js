/**
 * StudioProPaywallScreen — Push 9 paywall.
 *
 * Shown when:
 *   - The user taps "Upgrade" anywhere in Studio.
 *   - A protected endpoint returns 402 with proRequired.
 *
 * Lists products from /studio/pro/products. Tapping a plan posts an
 * IAP receipt stub to /studio/pro/iap-receipt — Push 10+ wires this to
 * the real RevenueCat purchase flow. For now we surface the call so
 * founder accounts (already Pro) can flow through end-to-end.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Crown, Layers, Globe, Calendar, Lock, Bot, ArrowLeft, House } from 'lucide-react-native';
import { COLORS, FONTS, SPACING } from '../../../constants/theme';
import { STUDIO_COLORS } from '../../../constants/studioTheme';
import studioV2Api from '../../../api/studioV2';

const FEATURES = [
  { icon: Layers, text: 'Series — group books into a reading order' },
  { icon: Globe, text: 'Universes — hold multiple series in one ecosystem' },
  { icon: Calendar, text: 'Scheduling extras — recurring releases & arc planning' },
  { icon: Lock, text: 'Premium locking — paywall any chapter, set your price' },
  { icon: Bot, text: 'AI tools — writing suggestions and reminders (rolling out)' },
];

const StudioProPaywallScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const reason = route?.params?.reason;

  useEffect(() => {
    let cancelled = false;
    studioV2Api.getProProducts()
      .then((res) => {
        if (cancelled) return;
        setProducts(res?.products || []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const buy = async (product) => {
    setPurchasing(product.id);
    try {
      const res = await studioV2Api.postIapReceipt({
        plan: product.plan,
        product_id: product.id,
        source: 'mobile_stub',
      });
      if (res?.is_pro) {
        Alert.alert('You\'re Pro!', 'Studio Pro is now active. Welcome aboard.', [
          { text: 'Open Studio', onPress: () => navigation.navigate('StudioRoot') },
        ]);
      } else {
        Alert.alert('Pending', 'Payment recorded. We\'ll activate Pro once payment confirms.');
      }
    } catch (e) {
      Alert.alert('Could not complete purchase', typeof e === 'string' ? e : 'Try again later.');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.headBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Main')}>
          <House size={17} color={STUDIO_COLORS.accent} />
        </TouchableOpacity>
        <Text style={styles.headTitle}>Studio Pro</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <View style={styles.crownWrap}>
            <Crown size={28} color={STUDIO_COLORS.pro} />
          </View>
          <Text style={styles.heroTitle}>Take your storytelling further</Text>
          {reason ? (
            <Text style={styles.heroReason}>You hit a Pro feature: {reason}.</Text>
          ) : (
            <Text style={styles.heroReason}>Unlock the full WiamStudio toolkit.</Text>
          )}
        </View>

        <View style={styles.featureCard}>
          {FEATURES.map((f, idx) => {
            const Icon = f.icon;
            return (
              <View key={`f-${idx}`} style={styles.featureRow}>
                <Icon size={14} color={STUDIO_COLORS.accent} />
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={STUDIO_COLORS.accent} style={{ marginTop: SPACING.lg }} />
        ) : (
          products.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.product, p.badge && styles.productHighlight]}
              disabled={!!purchasing}
              onPress={() => buy(p)}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.productPlan}>{(p.plan || '').toUpperCase()}</Text>
                  {p.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{p.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.productPrice}>{p.price_label}</Text>
                {p.description ? (
                  <Text style={styles.productDesc}>{p.description}</Text>
                ) : null}
              </View>
              {purchasing === p.id ? (
                <ActivityIndicator color={STUDIO_COLORS.pro} />
              ) : (
                <View style={styles.buyBtn}>
                  <Text style={styles.buyBtnText}>Choose</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.fineprint}>
          Subscriptions auto-renew. Cancel any time from your store account.
          You can keep using free Studio features at any time.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: STUDIO_COLORS.background },
  headBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: STUDIO_COLORS.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headTitle: { color: STUDIO_COLORS.textBright, fontSize: 16, fontWeight: '700' },
  scroll: { padding: SPACING.lg, paddingBottom: 120 },

  heroCard: {
    padding: SPACING.lg,
    borderRadius: 18,
    backgroundColor: STUDIO_COLORS.proSoft,
    borderWidth: 1, borderColor: STUDIO_COLORS.proBorder,
    alignItems: 'center',
  },
  crownWrap: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    marginBottom: SPACING.sm,
  },
  heroTitle: {
    color: STUDIO_COLORS.textBright,
    fontSize: 20,
    fontFamily: FONTS.displaySemi,
    textAlign: 'center',
  },
  heroReason: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },

  featureCard: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: 14,
    backgroundColor: STUDIO_COLORS.card,
    borderWidth: 1, borderColor: STUDIO_COLORS.border,
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8,
  },
  featureText: { color: COLORS.text, fontSize: 13, flex: 1 },

  product: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: SPACING.md,
    borderRadius: 14,
    backgroundColor: STUDIO_COLORS.card,
    borderWidth: 1, borderColor: STUDIO_COLORS.border,
    marginTop: SPACING.md,
  },
  productHighlight: {
    borderColor: STUDIO_COLORS.proBorder,
    backgroundColor: STUDIO_COLORS.proSoft,
  },
  productPlan: {
    color: STUDIO_COLORS.textBright,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: STUDIO_COLORS.pro,
  },
  badgeText: { color: '#000', fontSize: 9, fontWeight: '800' },
  productPrice: { color: STUDIO_COLORS.textBright, fontSize: 18, fontFamily: FONTS.displaySemi, marginTop: 4 },
  productDesc: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },

  buyBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: STUDIO_COLORS.accent,
  },
  buyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  fineprint: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: SPACING.lg,
    lineHeight: 16,
    textAlign: 'center',
  },
});

export default StudioProPaywallScreen;
