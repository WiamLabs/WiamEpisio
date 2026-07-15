// © 2026 WiamApp. Powered by WiamLabs
// screens/SubscriptionScreen.js — Worker subscription plans with RevenueCat

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, goldGradient } from '../constants/colors';
import {
  getSubscriptionPackages,
  purchaseSubscription,
  restorePurchases,
  getCurrentSubscription,
} from '../lib/api/revenuecat';

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    badge: null,
    priceLabel: 'GHS 0',
    priceSub: 'forever',
    commission: '15%',
    color: '#888',
    features: [
      'Create verified profile',
      'Appear in search results',
      'Receive booking requests',
      'Standard search placement',
      'In-app chat with customers',
    ],
    notIncluded: ['Spotlight access', 'Analytics'],
    revenuecat: null,
  },
  {
    key: 'basic',
    name: 'Basic',
    badge: 'blue',
    badgeLabel: 'Lower bar to earn the Checkmark',
    priceLabel: 'GHS 30',
    priceSub: 'per month',
    commission: '10%',
    color: '#3B82F6',
    highlight: false,
    features: [
      'Lower bar to earn the Checkmark badge',
      'Higher search placement',
      'Spotlight access — post your work',
      'Basic analytics dashboard',
      'Profile gold border highlight',
      'Priority customer notifications',
    ],
    revenuecat: 'com.wiamlabs.wiamapp.basic_monthly',
  },
  {
    key: 'pro',
    name: 'Pro',
    badge: 'blue_pro',
    badgeLabel: 'Lowest bar to earn the Checkmark',
    priceLabel: 'GHS 80',
    priceSub: 'per month',
    commission: '7%',
    color: Colors.gold,
    highlight: true,
    features: [
      'Lowest bar to earn the Checkmark badge',
      'TOP search placement',
      'Advanced analytics dashboard',
      '5 free Spotlight boosts/month',
      'Featured in "Top Rated" section',
      'Priority customer support',
      'Eligible for Business upgrade',
    ],
    revenuecat: 'com.wiamlabs.wiamapp.pro_monthly',
  },
];

export default function SubscriptionScreen({ navigation }) {
  const [currentPlan, setCurrentPlan]   = useState('free');
  const [loading, setLoading]           = useState(true);
  const [purchasing, setPurchasing]     = useState(null);
  const [packages, setPackages]         = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plan, pkgs] = await Promise.all([
        getCurrentSubscription(),
        getSubscriptionPackages(),
      ]);
      setCurrentPlan(plan || 'free');
      setPackages(pkgs);
    } catch (err) {
      console.log('Subscription load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (plan) => {
    if (plan.key === 'free') return;
    if (plan.key === currentPlan) {
      Alert.alert('Already subscribed', `You are already on the ${plan.name} plan.`);
      return;
    }

    // Find the RevenueCat package for this plan
    const pkg = packages.find(p => p.product.identifier === plan.revenuecat);
    if (!pkg) {
      Alert.alert(
        'Purchase unavailable',
        'This plan is not available through the App Store right now. Please try again later, or use Restore Purchases if you subscribed before.',
        [{ text: 'OK' }]
      );
      return;
    }

    setPurchasing(plan.key);
    try {
      const result = await purchaseSubscription(pkg);
      if (result.success) {
        setCurrentPlan(result.plan);
        Alert.alert(
          'Subscription activated!',
          `Welcome to ${plan.name}! Your new benefits are active. The Checkmark badge is still earned through your job history and ratings — this plan just lowered how far you have to go.`,
          [{ text: 'Great!', onPress: () => navigation.goBack() }]
        );
      } else if (!result.cancelled) {
        Alert.alert('Purchase failed', result.error || 'Please try again.');
      }
    } catch (err) {
      Alert.alert('Purchase failed', err.message);
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      const result = await restorePurchases();
      if (result.success && result.plan !== 'free') {
        setCurrentPlan(result.plan);
        Alert.alert('Purchases restored!', `Your ${result.plan} plan is active again.`);
      } else {
        Alert.alert('No purchases found', 'No previous purchases were found to restore.');
      }
    } catch (err) {
      Alert.alert('Restore failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.loadingText}>Loading plans...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upgrade Plan</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Lower your commission</Text>
          <Text style={styles.heroSub}>
            Upgrade to keep more of what you earn on every completed job.
          </Text>
        </View>

        {/* Plans */}
        {PLANS.map((plan) => {
          const isCurrentPlan = plan.key === currentPlan;
          const isBuying      = purchasing === plan.key;

          return (
            <View
              key={plan.key}
              style={[
                styles.planCard,
                plan.highlight && styles.planCardPro,
                isCurrentPlan && styles.planCardActive,
              ]}
            >
              {isCurrentPlan && (
                <View style={styles.currentPill}>
                  <Text style={styles.currentPillText}>Current Plan</Text>
                </View>
              )}

              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>
                {plan.priceLabel}
                <Text style={styles.planPriceSub}> /{plan.priceSub === 'forever' ? 'forever' : 'month'}</Text>
              </Text>
              <Text style={styles.planCommission}>{plan.commission} commission per booking</Text>

              <View style={styles.featuresList}>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons name="checkmark" size={14} color={Colors.gold} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
                {plan.notIncluded?.map((f, i) => (
                  <View key={`n${i}`} style={styles.featureRow}>
                    <Ionicons name="close" size={14} color={Colors.textFaint} />
                    <Text style={styles.notIncludedText}>{f}</Text>
                  </View>
                ))}
              </View>

              {isCurrentPlan ? null : plan.key === 'free' ? null : (
                <TouchableOpacity onPress={() => handlePurchase(plan)} disabled={isBuying} activeOpacity={0.85}>
                  {plan.highlight ? (
                    <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.upgradeBtn}>
                      {isBuying ? (
                        <ActivityIndicator size="small" color={Colors.navy} />
                      ) : (
                        <Text style={[styles.upgradeBtnText, { color: Colors.navy }]}>Subscribe to {plan.name}</Text>
                      )}
                    </LinearGradient>
                  ) : (
                    <View style={[styles.upgradeBtn, styles.upgradeBtnSecondary]}>
                      {isBuying ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <Text style={styles.upgradeBtnText}>Subscribe to {plan.name}</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Business CTA */}
        <View style={styles.businessCta}>
          <Ionicons name="business-outline" size={24} color={Colors.gold} />
          <Text style={styles.businessCtaTitle}>Running a company?</Text>
          <Text style={styles.businessCtaSub}>
            Get the Gold Checkmark with a Business Account.
            Manage your team, access advanced analytics, and more.
          </Text>
          <TouchableOpacity
            style={styles.businessCtaBtn}
            onPress={() => navigation.navigate('BusinessApplication')}
          >
            <Text style={styles.businessCtaBtnText}>Apply for Business Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.storeNote}>
          <Ionicons name="information-circle-outline" size={15} color={Colors.info} />
          <Text style={styles.storeNoteText}>
            Subscriptions are billed through your App Store or Google Play account, not WiamApp directly. Cancel anytime from your device's subscription settings.
          </Text>
        </View>

        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
          <Text style={styles.restoreBtnText}>Restore Previous Purchases</Text>
        </TouchableOpacity>

        <Text style={styles.noteText}>
          Payment will be charged to your Apple ID or Google Play account. Subscriptions auto-renew unless cancelled at least 24 hours before the renewal date.
        </Text>

        <Text style={styles.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  loadingText: { color: Colors.textDim, marginTop: 12, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Colors.screenPad, paddingVertical: 14,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },

  hero: { paddingHorizontal: Colors.screenPad, paddingBottom: 20, alignItems: 'center' },
  heroTitle: { color: Colors.white, fontSize: 19, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  heroSub: { color: Colors.textDim, fontSize: 12.5, lineHeight: 20, textAlign: 'center' },

  planCard: {
    backgroundColor: Colors.navyCard, marginHorizontal: Colors.screenPad,
    borderRadius: 22, padding: 20, marginBottom: 14,
    borderWidth: 1.5, borderColor: Colors.navyLine, position: 'relative',
  },
  planCardPro: { borderColor: Colors.gold, backgroundColor: 'rgba(212,160,23,0.06)' },
  planCardActive: { borderColor: Colors.success },

  currentPill: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  currentPillText: { color: Colors.success, fontSize: 9.5, fontWeight: '700' },

  planName: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  planPrice: { color: Colors.white, fontSize: 24, fontWeight: '800', marginTop: 6 },
  planPriceSub: { fontSize: 12, fontWeight: '500', color: Colors.textDim },
  planCommission: { color: Colors.gold, fontSize: 12, fontWeight: '600', marginTop: 2, marginBottom: 14 },

  featuresList: { gap: 5 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  featureText: { color: '#C9C9DE', fontSize: 12, flex: 1 },
  notIncludedText: { color: Colors.textFaint, fontSize: 12, flex: 1 },

  upgradeBtn: { borderRadius: 14, paddingVertical: 12, marginTop: 14, alignItems: 'center', justifyContent: 'center' },
  upgradeBtnSecondary: { backgroundColor: Colors.navyLine },
  upgradeBtnText: { color: Colors.white, fontSize: 13, fontWeight: '600' },

  businessCta: {
    backgroundColor: 'rgba(212,160,23,0.06)',
    marginHorizontal: Colors.screenPad, borderRadius: 20, padding: 20,
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.3)',
  },
  businessCtaTitle: { color: Colors.white, fontSize: 18, fontWeight: '700', marginTop: 10, marginBottom: 8 },
  businessCtaSub: { color: Colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  businessCtaBtn: { backgroundColor: Colors.gold, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },
  businessCtaBtnText: { color: Colors.navy, fontSize: 14, fontWeight: '600' },

  storeNote: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    marginHorizontal: Colors.screenPad, marginTop: 8,
    padding: 13, borderRadius: 14,
    backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
  },
  storeNoteText: { flex: 1, fontSize: 11, color: '#8FB4F0', lineHeight: 17 },

  restoreBtn: { alignItems: 'center', paddingVertical: 14 },
  restoreBtnText: { color: Colors.textDim, fontSize: 14, textDecorationLine: 'underline' },

  noteText: {
    color: Colors.textFaint, fontSize: 10,
    textAlign: 'center', marginHorizontal: 24, lineHeight: 17, marginBottom: 12,
  },
  copyright: { color: '#3A3A56', fontSize: 10, textAlign: 'center', paddingBottom: 8 },
});
