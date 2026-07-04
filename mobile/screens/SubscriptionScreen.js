// © 2026 WiamApp. Powered by WiamLabs
// screens/SubscriptionScreen.js — Worker subscription plans with RevenueCat

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
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
        'This plan is not available for in-app purchase right now. You can also subscribe at wiamapp.com/pricing to save 20%.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Visit Website', onPress: () => {} },
        ]
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
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.loadingText}>Loading plans...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upgrade Your Plan</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Grow faster on WiamApp</Text>
          <Text style={styles.heroSub}>
            Upgrade to lower your commission, unlock Spotlight, and
            shorten the climb to earning your Checkmark badge.
          </Text>
          <View style={styles.savingsBadge}>
            <Ionicons name="globe-outline" size={14} color={Colors.navy} />
            <Text style={styles.savingsText}>Subscribe at wiamapp.com to save 20%</Text>
          </View>
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
                plan.highlight && styles.planCardHighlight,
                isCurrentPlan && styles.planCardActive,
              ]}
            >
              {plan.highlight && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>MOST POPULAR</Text>
                </View>
              )}

              {/* Plan Header */}
              <View style={styles.planHeader}>
                <View>
                  <Text style={[styles.planName, plan.highlight && { color: Colors.white }]}>
                    {plan.name}
                  </Text>
                  {plan.badgeLabel && (
                    <View style={styles.planBadgeRow}>
                      <Ionicons name="trending-up-outline" size={13} color={plan.color} />
                      <Text style={[styles.planBadgeLabel, { color: plan.color }]}>
                        {plan.badgeLabel}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.planPricing}>
                  <Text style={[styles.planPrice, plan.highlight && { color: Colors.gold }]}>
                    {plan.priceLabel}
                  </Text>
                  <Text style={[styles.planPriceSub, plan.highlight && { color: 'rgba(255,255,255,0.5)' }]}>
                    {plan.priceSub}
                  </Text>
                </View>
              </View>

              {/* Commission */}
              <View style={[styles.commissionRow, plan.highlight && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="wallet-outline" size={15} color={plan.highlight ? Colors.gold : Colors.navy} />
                <Text style={[styles.commissionText, plan.highlight && { color: Colors.white }]}>
                  {plan.commission} commission per booking
                </Text>
              </View>

              {/* Features */}
              <View style={styles.featuresList}>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={plan.highlight ? Colors.gold : Colors.success}
                    />
                    <Text style={[styles.featureText, plan.highlight && { color: 'rgba(255,255,255,0.85)' }]}>
                      {f}
                    </Text>
                  </View>
                ))}
                {plan.notIncluded?.map((f, i) => (
                  <View key={`n${i}`} style={styles.featureRow}>
                    <Ionicons name="close-circle" size={16} color="#ccc" />
                    <Text style={styles.notIncludedText}>{f}</Text>
                  </View>
                ))}
              </View>

              {/* Action Button */}
              {isCurrentPlan ? (
                <View style={styles.currentPlanBtn}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.currentPlanText}>Current Plan</Text>
                </View>
              ) : plan.key === 'free' ? null : (
                <TouchableOpacity
                  style={[
                    styles.upgradeBtn,
                    plan.highlight ? styles.upgradeBtnPrimary : styles.upgradeBtnSecondary,
                  ]}
                  onPress={() => handlePurchase(plan)}
                  disabled={isBuying}
                  activeOpacity={0.85}
                >
                  {isBuying ? (
                    <ActivityIndicator size="small" color={Colors.navy} />
                  ) : (
                    <>
                      <Text style={[
                        styles.upgradeBtnText,
                        !plan.highlight && { color: Colors.navy },
                      ]}>
                        Upgrade to {plan.name}
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={16}
                        color={plan.highlight ? Colors.navy : Colors.navy}
                      />
                    </>
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

        {/* Restore and notes */}
        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
          <Text style={styles.restoreBtnText}>Restore Previous Purchases</Text>
        </TouchableOpacity>

        <Text style={styles.noteText}>
          Subscriptions auto-renew monthly. Cancel anytime in your App Store or Google Play settings.
          Prices shown are approximate. Final price charged in your local App Store currency.
        </Text>

        <Text style={styles.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  loadingText: { color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '600' },

  hero: { paddingHorizontal: 24, paddingBottom: 20 },
  heroTitle: { color: Colors.white, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  heroSub: { color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 22, marginBottom: 14 },
  savingsBadge: {
    backgroundColor: 'rgba(212,160,23,0.15)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start',
    borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.3)',
  },
  savingsText: { color: Colors.gold, fontSize: 12, fontWeight: '500' },

  planCard: {
    backgroundColor: Colors.white, marginHorizontal: 20,
    borderRadius: 18, padding: 20, marginBottom: 16,
    borderWidth: 0.5, borderColor: '#EBEBEB', overflow: 'hidden',
  },
  planCardHighlight: {
    backgroundColor: Colors.navy,
    borderColor: Colors.gold, borderWidth: 1.5,
  },
  planCardActive: { borderColor: Colors.success, borderWidth: 1.5 },

  popularBadge: {
    backgroundColor: Colors.gold, alignSelf: 'flex-start',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12,
  },
  popularText: { color: Colors.navy, fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  planName: { color: Colors.navy, fontSize: 20, fontWeight: '700' },
  planBadgeRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  planBadgeLabel: { fontSize: 13 },
  planPricing: { alignItems: 'flex-end' },
  planPrice: { color: Colors.navy, fontSize: 22, fontWeight: '700' },
  planPriceSub: { color: '#888', fontSize: 12, marginTop: 2 },

  commissionRow: {
    backgroundColor: '#F8F8F8', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16,
  },
  commissionText: { color: Colors.navy, fontSize: 13, fontWeight: '500' },

  featuresList: { gap: 8, marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { color: Colors.navy, fontSize: 14, flex: 1 },
  notIncludedText: { color: '#bbb', fontSize: 14, flex: 1 },

  currentPlanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  currentPlanText: { color: Colors.success, fontSize: 15, fontWeight: '600' },

  upgradeBtn: {
    borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  upgradeBtnPrimary: { backgroundColor: Colors.gold },
  upgradeBtnSecondary: { backgroundColor: Colors.navy },
  upgradeBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' },

  businessCta: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 20, borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 16,
    borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.3)',
  },
  businessCtaTitle: { color: Colors.white, fontSize: 18, fontWeight: '700', marginTop: 10, marginBottom: 8 },
  businessCtaSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  businessCtaBtn: {
    backgroundColor: Colors.gold, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  businessCtaBtnText: { color: Colors.navy, fontSize: 14, fontWeight: '600' },

  restoreBtn: { alignItems: 'center', paddingVertical: 14 },
  restoreBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textDecorationLine: 'underline' },

  noteText: {
    color: 'rgba(255,255,255,0.25)', fontSize: 11,
    textAlign: 'center', marginHorizontal: 24, lineHeight: 17, marginBottom: 12,
  },
  copyright: { color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center' },
});
