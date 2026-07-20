/**
 * StudioMoneyScreen — V2 Money tab (Push 9).
 *
 * Quick earnings + Pro CTA. The deep earnings/payouts UX still lives in
 * the existing EarningsScreen — this tab links into it but adds a
 * top-of-page Pro hero so creators have a single place to upgrade.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Crown, Coins, BarChart3, ChevronRight, Wallet } from 'lucide-react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../constants/theme';
import { STUDIO_COLORS } from '../../../constants/studioTheme';
import creatorApi from '../../../api/creator';
import studioV2Api from '../../../api/studioV2';
import StudioBackHomeRow from '../../../components/studio/StudioBackHomeRow';

const StudioMoneyScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({ earnings: 0, available: 0, pending: 0 });
  const [pro, setPro] = useState({ is_pro: false, subscription: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [earningsRes, proRes] = await Promise.allSettled([
        creatorApi.getEarnings(),
        studioV2Api.getProStatus(),
      ]);
      if (earningsRes.status === 'fulfilled') {
        const e = earningsRes.value || {};
        setStats({
          earnings: Number(e.total_earned_ghs || e.total_ghs || 0),
          available: Number(e.available_ghs || 0),
          pending: Number(e.pending_ghs || 0),
        });
      }
      if (proRes.status === 'fulfilled') {
        setPro(proRes.value || { is_pro: false });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={STUDIO_COLORS.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={STUDIO_COLORS.accent}
          />
        }
      >
        <StudioBackHomeRow navigation={navigation} title="Money" />
        <Text style={styles.heroTitle}>Money</Text>
        <Text style={styles.heroSub}>Earnings, payouts and Studio Pro.</Text>

        {/* Pro Hero */}
        {pro.is_pro ? (
          <View style={styles.proHero}>
            <View style={styles.proIcon}>
              <Crown size={20} color={STUDIO_COLORS.pro} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.proTitle}>You&apos;re on Studio Pro</Text>
              <Text style={styles.proSub}>
                Plan: {pro.subscription?.plan || 'monthly'} · {pro.subscription?.status || 'active'}
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.upgradeHero}
            onPress={() => navigation.navigate('StudioProPaywall')}
          >
            <View style={styles.proIcon}>
              <Crown size={20} color={STUDIO_COLORS.pro} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.proTitle}>Unlock Studio Pro</Text>
              <Text style={styles.proSub}>
                Universes, Series, Premium locks, AI tools, scheduling extras.
              </Text>
            </View>
            <ChevronRight size={18} color={STUDIO_COLORS.pro} />
          </TouchableOpacity>
        )}

        {/* Stat tiles */}
        <View style={styles.statRow}>
          <Stat label="All-time earned" value={`GHS ${stats.earnings.toFixed(2)}`} icon={<Coins size={14} color={STUDIO_COLORS.accent} />} />
          <Stat label="Available" value={`GHS ${stats.available.toFixed(2)}`} icon={<Wallet size={14} color="#22d3ee" />} />
        </View>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => navigation.navigate('Earnings')}
        >
          <BarChart3 size={16} color={STUDIO_COLORS.accent} />
          <Text style={styles.actionText}>Open earnings dashboard</Text>
          <ChevronRight size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const Stat = ({ label, value, icon }) => (
  <View style={styles.stat}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: STUDIO_COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 120 },
  heroTitle: { color: STUDIO_COLORS.textBright, fontSize: 22, fontFamily: FONTS.display },
  heroSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 4, marginBottom: SPACING.lg },

  proHero: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: SPACING.md,
    borderRadius: 14,
    backgroundColor: STUDIO_COLORS.proSoft,
    borderWidth: 1, borderColor: STUDIO_COLORS.proBorder,
  },
  upgradeHero: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: SPACING.md,
    borderRadius: 14,
    backgroundColor: STUDIO_COLORS.proSoft,
    borderWidth: 1, borderColor: STUDIO_COLORS.proBorder,
  },
  proIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  proTitle: { color: STUDIO_COLORS.textBright, fontSize: 14, fontWeight: '700' },
  proSub: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2, lineHeight: 16 },

  statRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  stat: {
    flex: 1,
    padding: SPACING.md,
    backgroundColor: STUDIO_COLORS.card,
    borderRadius: 12,
    borderWidth: 1, borderColor: STUDIO_COLORS.border,
  },
  statLabel: { color: COLORS.textMuted, fontSize: 11 },
  statValue: { color: STUDIO_COLORS.textBright, fontSize: 18, fontFamily: FONTS.displaySemi, marginTop: 6 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: SPACING.md,
    backgroundColor: STUDIO_COLORS.card,
    borderRadius: 12,
    borderWidth: 1, borderColor: STUDIO_COLORS.border,
    marginTop: SPACING.lg,
  },
  actionText: { flex: 1, color: STUDIO_COLORS.textBright, fontSize: 13, fontWeight: '600' },
});

export default StudioMoneyScreen;
