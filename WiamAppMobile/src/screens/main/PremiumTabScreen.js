import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, Text, TouchableOpacity, ScrollView,
  Animated, Dimensions, Alert, ActivityIndicator, Platform,
  Share, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import {
  Crown, Star, Diamond, Sparkles, Check, X, Zap, ChevronLeft,
  BookOpen, Download, MessageSquareHeart, Palette, Bot, ShieldCheck,
  Gift, Users, Copy, Share2,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import useAuthStore from '../../store/useAuthStore';
import walletApi from '../../api/wallet';
import authApi from '../../api/auth';
import { purchaseSubscription, restorePurchases, getCustomerInfo, getProducts, isIAPAvailable } from '../../services/iap';
import { SUBSCRIPTION_PRODUCTS } from '../../services/iapProducts';
import getDeviceFingerprint from '../../utils/deviceFingerprint';
import getDeviceSignal from '../../utils/deviceSignal';
import getPlayIntegrityPayload from '../../utils/playIntegrity';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Plan definitions ──
const PLANS = [
  {
    id: 'free',
    key: 'none',
    name: 'Free',
    price: '$0',
    priceNum: 0,
    period: '/forever',
    icon: Sparkles,
    iconColor: '#94a3b8',
    credits: 0,
    popular: false,
    readonly: true,
    features: [
      { text: 'Standard reading', included: true },
      { text: '5 WiamBot msgs/day', included: true },
      { text: 'Ads in reading', included: true },
      { text: 'Premium credits', included: false },
      { text: 'Custom themes', included: false },
      { text: 'Early access chapters', included: false },
    ],
  },
  {
    id: 'wiampremium_basic',
    key: 'basic',
    name: 'Basic',
    price: '$2.99',
    priceNum: 2.99,
    period: '/month',
    icon: Star,
    iconColor: '#d4a843',
    credits: 5,
    popular: false,
    features: [
      { text: 'Ad-free reading', included: true },
      { text: 'Gold Premium badge', included: true },
      { text: '5 monthly credits', included: true },
      { text: '10 WiamBot msgs/day', included: true },
      { text: 'Offline reading: up to 5 books', included: true },
      { text: 'Priority comments', included: false },
      { text: 'Custom themes', included: false },
      { text: 'Early access', included: false },
    ],
  },
  {
    id: 'wiampremium_plus',
    key: 'plus',
    name: 'Plus',
    price: '$4.99',
    priceNum: 4.99,
    period: '/month',
    icon: Diamond,
    iconColor: '#60a5fa',
    credits: 15,
    popular: true,
    features: [
      { text: 'Ad-free reading', included: true },
      { text: 'Diamond Premium badge', included: true },
      { text: '15 monthly credits', included: true },
      { text: '30 WiamBot msgs/day', included: true },
      { text: 'Offline reading: up to 15 books', included: true },
      { text: 'Priority comments', included: true },
      { text: 'Custom themes', included: false },
      { text: 'Early access', included: false },
    ],
  },
  {
    id: 'wiampremium_unlimited',
    key: 'unlimited',
    name: 'Unlimited',
    price: '$7.99',
    priceNum: 7.99,
    period: '/month',
    icon: Crown,
    iconColor: '#d4a843',
    credits: -1, // unlimited
    popular: false,
    features: [
      { text: 'Ad-free reading', included: true },
      { text: 'Crown Premium badge', included: true },
      { text: 'Unlimited credits', included: true },
      { text: 'Unlimited WiamBot', included: true },
      { text: 'Offline reading: up to 50 books', included: true },
      { text: 'Priority comments', included: true },
      { text: 'All custom themes', included: true },
      { text: 'Early access chapters', included: true },
    ],
  },
];

const PremiumTabScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [selectedPlan, setSelectedPlan] = useState('wiampremium_plus');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [rcProducts, setRcProducts] = useState([]);
  const [referralCode, setReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState(null);
  const [refInput, setRefInput] = useState('');
  const [applyingRef, setApplyingRef] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
    ]).start();

    // Pulsing CTA button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    // Shimmer effect
    Animated.loop(
      Animated.timing(shimmerAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
    ).start();
  }, []);

  // Fetch premium status + RC products + referral data
  useEffect(() => {
    walletApi.getPremiumStatus().then(setPremiumStatus).catch(() => {});
    walletApi.getReferralCode().then((d) => setReferralCode(d.referral_code || '')).catch(() => {});
    walletApi.getReferralStats().then(setReferralStats).catch(() => {});
    if (isIAPAvailable()) {
      getProducts().then(({ subscriptionProducts }) => {
        setRcProducts(subscriptionProducts || []);
      }).catch(() => {});
    }
  }, []);

  // Ensure active premium users actually receive monthly credits.
  useEffect(() => {
    if (!premiumStatus?.is_premium) return;
    walletApi.claimMonthlyCredits()
      .then((res) => {
        if (res?.ok && typeof res.credits_balance === 'number') {
          setPremiumStatus((prev) => prev ? { ...prev, credits_balance: res.credits_balance } : prev);
        }
      })
      .catch(() => {});
  }, [premiumStatus?.is_premium]);

  const isPremium = premiumStatus?.is_premium || user?.premium_status === 'active' || user?.premium_status === 'trial';
  const trialUsed = premiumStatus?.trial_used ?? user?.trial_used ?? false;

  const handlePurchase = useCallback(async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      // If eligible, start one-time 7-day trial first.
      if (!trialUsed && premiumStatus?.trial_eligible) {
        const fp = await getDeviceFingerprint();
        const deviceSignal = await getDeviceSignal();
        const nonceRes = await walletApi.issueIntegrityNonce(Platform.OS);
        const serverNonce = nonceRes?.integrity_nonce || null;
        const integrity = await getPlayIntegrityPayload(serverNonce);
        if (
          Platform.OS === 'android' &&
          premiumStatus?.integrity_required_for_trial &&
          !integrity?.integrity_supported
        ) {
          Alert.alert(
            'Security Check Required',
            'Free trial currently needs Play Integrity verification on Android. Please use a production/dev-client build (not Expo Go) and try again.'
          );
          return;
        }
        if (
          Platform.OS === 'ios' &&
          premiumStatus?.ios_integrity_required_for_trial &&
          !integrity?.integrity_supported
        ) {
          Alert.alert(
            'Security Check Required',
            'Free trial currently needs iOS app integrity verification. Please use a production/TestFlight build and try again.'
          );
          return;
        }
        const trial = await walletApi.startTrial({
          deviceFingerprint: fp,
          platform: Platform.OS,
          deviceSignal,
          playIntegrityToken: integrity?.play_integrity_token,
          iosIntegrityToken: integrity?.ios_integrity_token,
          integrityNonce: integrity?.integrity_nonce,
        });
        if (trial?.ok) {
          const status = await walletApi.getPremiumStatus();
          setPremiumStatus(status);
          try {
            const freshUser = await authApi.me();
            const token = useAuthStore.getState().token;
            setAuth(freshUser, token);
          } catch (_) {}
          Alert.alert('Trial Started', 'Your 7-day WiamPremium trial is active now.');
          return;
        }
      }

      // Find the matching RC product object
      const product = rcProducts.find((p) => p.productId === selectedPlan);
      if (!product) {
        if (!__DEV__) {
          Alert.alert(
            'Store Unavailable',
            'Purchases are temporarily unavailable. Please try again later or restore your purchases.'
          );
          return;
        }

        // DEV SANDBOX: No store available (Expo Go) — offer dev activation
        const plan = PLANS.find((p) => p.id === selectedPlan);
        const planKey = plan?.key || 'plus';
        Alert.alert(
          'Dev Sandbox Mode',
          `Store not available in Expo Go.\nActivate "${planKey}" premium via dev sandbox for 30 days?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setPurchasing(false) },
            {
              text: 'Activate (Dev)',
              style: 'default',
              onPress: async () => {
                try {
                  const res = await walletApi.devActivatePremium(planKey);
                  if (res?.ok) {
                    const status = await walletApi.getPremiumStatus();
                    setPremiumStatus(status);
                    try {
                      const freshUser = await authApi.me();
                      const token = useAuthStore.getState().token;
                      setAuth(freshUser, token);
                    } catch (_) {}
                    Alert.alert('Dev Sandbox', `${planKey} premium activated for 30 days!`);
                  } else {
                    Alert.alert('Dev Sandbox Error', res?.error || 'Activation failed');
                  }
                } catch (err) {
                  Alert.alert('Dev Sandbox Error', err?.message || 'Server not reachable or not in dev mode');
                } finally {
                  setPurchasing(false);
                }
              },
            },
          ],
        );
        return;
      }

      const result = await purchaseSubscription(product);
      if (result && result.ok !== false) {
        // Refresh user data
        const status = await walletApi.getPremiumStatus();
        setPremiumStatus(status);
        // Sync auth store so isPremium is correct everywhere
        try {
          const freshUser = await authApi.me();
          const token = useAuthStore.getState().token;
          setAuth(freshUser, token);
        } catch (_) {}
        // Convert pending referral (awards bonus credits to referrer + referee)
        try { await walletApi.convertReferral(); } catch (_) {}
        Alert.alert(
          'Welcome to WiamPremium!',
          'You now have access to all premium features. Enjoy ad-free reading!',
          [{ text: 'Let\'s Go!', style: 'default' }]
        );
      } else if (result?.cancelled) {
        // User cancelled — do nothing
      } else {
        Alert.alert('Purchase Failed', result?.error || 'Something went wrong.');
      }
    } catch (err) {
      if (!err?.userCancelled) {
        const apiError = err?.response?.data?.error || err?.response?.data?.reason;
        Alert.alert('Purchase Failed', apiError || err?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  }, [selectedPlan, purchasing, user, rcProducts, premiumStatus, trialUsed, setAuth]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      if (info?.ok && (info.entitlements?.includes('premium') || info.activeSubscriptions?.length > 0)) {
        const status = await walletApi.getPremiumStatus();
        setPremiumStatus(status);
        // Sync auth store so isPremium is correct everywhere
        try {
          const freshUser = await authApi.me();
          const token = useAuthStore.getState().token;
          setAuth(freshUser, token);
        } catch (_) {}
        Alert.alert('Restored!', 'Your premium subscription has been restored.');
      } else {
        Alert.alert('No Purchase Found', 'We couldn\'t find an active subscription to restore.');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, []);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_W, SCREEN_W],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Back button header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '700', marginLeft: 4 }}>WiamPremium</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Section ── */}
        <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient
            colors={['#722f37', '#3d1520', '#08081a']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroGradient}
          >
            {/* Gold glow orb */}
            <View style={styles.glowOrb} />

            <Crown size={48} color="#d4a843" strokeWidth={1.5} />
            <Text style={styles.heroTitle}>WiamPremium</Text>
            <Text style={styles.heroSubtitle}>
              Elevate your reading experience
            </Text>

            {/* Free trial badge */}
            {!trialUsed && !isPremium && (
              <View style={styles.trialBadge}>
                <Sparkles size={14} color="#d4a843" />
                <Text style={styles.trialText}>7-Day Free Trial</Text>
              </View>
            )}

            {/* Active premium badge */}
            {isPremium && (
              <View style={styles.activeBadge}>
                <ShieldCheck size={16} color="#4ade80" />
                <Text style={styles.activeText}>
                  {premiumStatus?.plan?.toUpperCase() || 'PREMIUM'} Active
                </Text>
                {premiumStatus?.trial_remaining_days > 0 && (
                  <Text style={styles.trialDays}>
                    {premiumStatus.trial_remaining_days}d trial left
                  </Text>
                )}
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* ── Plan Cards ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.sectionTitle}>Choose Your Plan</Text>

          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isSelected = selectedPlan === plan.id;
            const isCurrentPlan = isPremium && premiumStatus?.plan === plan.key;

            return (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  isSelected && styles.planCardSelected,
                  plan.popular && styles.planCardPopular,
                  plan.readonly && { opacity: 0.9 },
                ]}
                onPress={() => !plan.readonly && setSelectedPlan(plan.id)}
                activeOpacity={0.8}
              >
                {/* Popular tag */}
                {plan.popular && (
                  <LinearGradient
                    colors={['#d4a843', '#b8860b']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.popularTag}
                  >
                    <Text style={styles.popularTagText}>MOST POPULAR</Text>
                  </LinearGradient>
                )}

                {/* Current plan tag */}
                {isCurrentPlan && (
                  <View style={styles.currentTag}>
                    <Text style={styles.currentTagText}>CURRENT PLAN</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View style={[styles.planIconWrap, { backgroundColor: plan.iconColor + '18' }]}>
                    <Icon size={24} color={plan.iconColor} />
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.planPrice}>{plan.price}</Text>
                      <Text style={styles.planPeriod}>{plan.period}</Text>
                    </View>
                  </View>
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </View>

                {/* Feature checklist (shown when selected) */}
                {isSelected && (
                  <View style={styles.featureList}>
                    {plan.features.map((f, i) => (
                      <View key={i} style={styles.featureRow}>
                        {f.included ? (
                          <Check size={14} color="#4ade80" strokeWidth={3} />
                        ) : (
                          <X size={14} color="#555" strokeWidth={2} />
                        )}
                        <Text style={[styles.featureText, !f.included && styles.featureDisabled]}>
                          {f.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* ── Subscribe Button ── */}
        {!isPremium && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={styles.subscribeBtn}
              onPress={handlePurchase}
              disabled={purchasing}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#d4a843', '#b8860b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.subscribeBtnGrad}
              >
                {purchasing ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Zap size={20} color="#000" />
                    <Text style={styles.subscribeBtnText}>
                      {trialUsed ? 'Subscribe Now' : 'Start 7-Day Free Trial'}
                    </Text>
                  </>
                )}

                {/* Shimmer overlay */}
                <Animated.View
                  style={[styles.shimmer, { transform: [{ translateX: shimmerTranslate }] }]}
                />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Restore + Cancel text ── */}
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={handleRestore} disabled={restoring}>
            <Text style={styles.footerLink}>
              {restoring ? 'Restoring...' : 'Restore Purchases'}
            </Text>
          </TouchableOpacity>
          {!isPremium && (
            <Text style={styles.legalText}>
              Cancel anytime. {!trialUsed ? 'Free trial converts to paid subscription after 7 days. ' : ''}
              Payment will be charged through {Platform.OS === 'ios' ? 'Apple' : 'Google Play'}.
            </Text>
          )}
        </View>

        {/* ── Feature Highlights ── */}
        <Text style={styles.sectionTitle}>Premium Perks</Text>
        <View style={styles.perksGrid}>
          {[
            { icon: BookOpen, color: '#d4a843', title: 'Ad-Free', desc: 'Read without interruptions' },
            { icon: Download, color: '#60a5fa', title: 'Offline Cache', desc: 'Continue reading cached chapters offline' },
            { icon: Bot, color: '#a855f7', title: 'WiamBot+', desc: 'More daily messages & smarter replies' },
            { icon: Palette, color: '#f472b6', title: 'Themes', desc: 'Ocean, Forest, Midnight & more' },
            { icon: MessageSquareHeart, color: '#fb923c', title: 'Priority', desc: 'Your comments appear first' },
            { icon: Sparkles, color: '#4ade80', title: 'Credits', desc: 'Monthly credits to unlock chapters' },
          ].map((perk, i) => {
            const PerkIcon = perk.icon;
            return (
              <View key={i} style={styles.perkCard}>
                <View style={[styles.perkIconWrap, { backgroundColor: perk.color + '15' }]}>
                  <PerkIcon size={20} color={perk.color} />
                </View>
                <Text style={styles.perkTitle}>{perk.title}</Text>
                <Text style={styles.perkDesc}>{perk.desc}</Text>
              </View>
            );
          })}
        </View>

        {/* ── Referral Section ── */}
        <Text style={styles.sectionTitle}>Invite Friends</Text>
        <View style={styles.referralCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Gift size={22} color="#c084fc" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700' }}>Earn 3 bonus credits per referral</Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>Your friend gets 1 bonus credit too!</Text>
            </View>
          </View>

          {/* Referral code display + copy/share */}
          {referralCode ? (
            <View style={styles.refCodeRow}>
              <Text style={styles.refCodeLabel}>Your code:</Text>
              <Text style={styles.refCode}>{referralCode}</Text>
              <TouchableOpacity
                style={styles.refActionBtn}
                onPress={() => {
                  Clipboard.setStringAsync(referralCode);
                  Alert.alert('Copied!', 'Referral code copied to clipboard.');
                }}
              >
                <Copy size={14} color="#d4a843" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.refActionBtn}
                onPress={() => {
                  Share.share({
                    message: `Join me on WiamApp and get bonus credits! Use my referral code: ${referralCode}\nhttps://wiamapp.com/join?ref=${referralCode}`,
                  });
                }}
              >
                <Share2 size={14} color="#d4a843" />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Referral stats */}
          {referralStats && (
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: '#c084fc', fontSize: 20, fontWeight: '800' }}>{referralStats.total_referrals}</Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 10 }}>Invited</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: '#4ade80', fontSize: 20, fontWeight: '800' }}>{referralStats.converted}</Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 10 }}>Subscribed</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: '#d4a843', fontSize: 20, fontWeight: '800' }}>{referralStats.total_bonus_credits}</Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 10 }}>Credits earned</Text>
              </View>
            </View>
          )}

          {/* Apply referral code */}
          {!isPremium && !user?.referred_by && (
            <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12 }}>
              <Text style={{ color: COLORS.textMuted, fontSize: 11, marginBottom: 6 }}>Have a referral code?</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={styles.refInput}
                  placeholder="Enter code"
                  placeholderTextColor="#555"
                  value={refInput}
                  onChangeText={setRefInput}
                  autoCapitalize="characters"
                  maxLength={10}
                />
                <TouchableOpacity
                  style={[styles.refApplyBtn, !refInput.trim() && { opacity: 0.4 }]}
                  disabled={!refInput.trim() || applyingRef}
                  onPress={async () => {
                    setApplyingRef(true);
                    try {
                      const res = await walletApi.applyReferralCode(refInput.trim());
                      Alert.alert('Referral Applied!', res.message || 'Referral code applied successfully.');
                      setRefInput('');
                    } catch (e) {
                      Alert.alert('Error', e?.response?.data?.error || 'Invalid referral code.');
                    } finally {
                      setApplyingRef(false);
                    }
                  }}
                >
                  {applyingRef ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Hero
  hero: { marginBottom: SPACING.lg },
  heroGradient: {
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: SPACING.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(212,168,67,0.12)',
  },
  heroTitle: {
    color: '#d4a843',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 12,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
  },
  trialBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 16,
    backgroundColor: 'rgba(212,168,67,0.15)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.3)',
  },
  trialText: { color: '#d4a843', fontSize: 13, fontWeight: '700' },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 16,
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
  },
  activeText: { color: '#4ade80', fontSize: 13, fontWeight: '700' },
  trialDays: { color: 'rgba(74,222,128,0.7)', fontSize: 11, marginLeft: 4 },

  // Section title
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },

  // Plan cards
  planCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: 'rgba(212,168,67,0.5)',
    backgroundColor: 'rgba(212,168,67,0.06)',
  },
  planCardPopular: {
    borderColor: 'rgba(212,168,67,0.35)',
  },
  popularTag: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: 12, paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  popularTagText: { color: '#000', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  currentTag: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: 12, paddingVertical: 4,
    borderBottomLeftRadius: 10,
    backgroundColor: 'rgba(74,222,128,0.2)',
  },
  currentTagText: { color: '#4ade80', fontSize: 10, fontWeight: '800' },
  planHeader: { flexDirection: 'row', alignItems: 'center' },
  planIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  planInfo: { flex: 1, marginLeft: 14 },
  planName: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  planPrice: { color: COLORS.secondary, fontSize: 22, fontWeight: '800' },
  planPeriod: { color: COLORS.textMuted, fontSize: 13, marginLeft: 2 },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: '#d4a843' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#d4a843' },

  // Feature list
  featureList: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  featureText: { color: COLORS.text, fontSize: 13, flex: 1 },
  featureDisabled: { color: '#555' },

  // Subscribe button
  subscribeBtn: { marginHorizontal: SPACING.lg, marginTop: SPACING.md, borderRadius: 16, overflow: 'hidden' },
  subscribeBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, overflow: 'hidden',
  },
  subscribeBtnText: { color: '#000', fontSize: 17, fontWeight: '800' },
  shimmer: {
    position: 'absolute', top: 0, bottom: 0, width: 60,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  // Footer links
  footerLinks: { alignItems: 'center', marginTop: SPACING.lg, paddingHorizontal: SPACING.xl },
  footerLink: { color: COLORS.secondary, fontSize: 13, fontWeight: '600', paddingVertical: 8 },
  legalText: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 8 },

  // Perks grid
  perksGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    gap: 12,
  },
  perkCard: {
    width: (SCREEN_W - SPACING.lg * 2 - 12) / 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 14,
  },
  perkIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  perkTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  perkDesc: { color: COLORS.textMuted, fontSize: 11, lineHeight: 15 },

  // Referral section
  referralCard: {
    marginHorizontal: SPACING.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.2)',
    backgroundColor: 'rgba(192,132,252,0.04)',
    padding: 16,
  },
  refCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 10,
  },
  refCodeLabel: { color: COLORS.textMuted, fontSize: 11 },
  refCode: { color: '#d4a843', fontSize: 16, fontWeight: '800', letterSpacing: 2, flex: 1 },
  refActionBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(212,168,67,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  refInput: {
    flex: 1, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    color: COLORS.text, fontSize: 14, fontWeight: '700',
    paddingHorizontal: 12, letterSpacing: 1.5,
  },
  refApplyBtn: {
    height: 40, paddingHorizontal: 20, borderRadius: 10,
    backgroundColor: '#d4a843',
    alignItems: 'center', justifyContent: 'center',
  },
});

export default PremiumTabScreen;
