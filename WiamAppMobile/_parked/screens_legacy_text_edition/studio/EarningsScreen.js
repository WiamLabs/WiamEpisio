/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import walletApi from '../../api/wallet';
import { ChevronLeft, Coins, TrendingUp, Calendar, Tv, House } from 'lucide-react-native';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import BrandedFooter from '../../components/BrandedFooter';
import AdBanner from '../../components/ads/AdBanner';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EarningsScreen = ({ navigation }) => {
  const [data, setData] = useState(null);
  const [adData, setAdData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = async () => {
    try {
      const [result, adResult] = await Promise.all([
        walletApi.getCreatorEarnings(),
        walletApi.getAdEarnings().catch(() => null),
      ]);
      setData(result);
      setAdData(adResult);
    } catch (err) {
      console.error('Earnings fetch error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchEarnings(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchEarnings(); };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <SkeletonLoader.ListItem count={4} />
      </View>
    );
  }

  return (
    <AppBackground>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Main')}>
          <House size={18} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Creator Earnings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: 'rgba(212,168,67,0.25)' }]}>
            <Coins size={22} color={COLORS.secondary} />
            <Text style={styles.summaryValue}>{data?.total_coins?.toLocaleString() || 0}</Text>
            <Text style={styles.summaryLabel}>Total Coins</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: 'rgba(46,204,113,0.25)' }]}>
            <TrendingUp size={22} color="#2ecc71" />
            <Text style={[styles.summaryValue, { color: '#2ecc71' }]}>GH₵{data?.total_ghs?.toFixed(2) || '0.00'}</Text>
            <Text style={styles.summaryLabel}>Your Share</Text>
          </View>
        </View>

        {/* Share Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Your revenue share is <Text style={{ fontWeight: '700', color: COLORS.secondary }}>{data?.creator_share_pct || 50}%</Text>.
            {' '}1 coin = GH₵{data?.coin_to_ghs || 0.05}.
          </Text>
        </View>

        {/* Ad Revenue Share */}
        {adData && adData.total_impressions > 0 && (
          <>
            <Text style={styles.sectionTitle}>Ad Revenue Share</Text>
            <View style={[styles.summaryRow, { marginBottom: SPACING.md }]}>
              <View style={[styles.summaryCard, { borderColor: 'rgba(168,85,247,0.25)' }]}>
                <Tv size={22} color="#a855f7" />
                <Text style={[styles.summaryValue, { color: '#a855f7' }]}>{adData.total_impressions.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>Ad Impressions</Text>
              </View>
              <View style={[styles.summaryCard, { borderColor: 'rgba(168,85,247,0.25)' }]}>
                <TrendingUp size={22} color="#a855f7" />
                <Text style={[styles.summaryValue, { color: '#a855f7' }]}>${adData.creator_share_usd?.toFixed(4) || '0.00'}</Text>
                <Text style={styles.summaryLabel}>Your 50% Share</Text>
              </View>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Ads shown in your books earn you <Text style={{ fontWeight: '700', color: '#a855f7' }}>50%</Text> of the ad revenue.
                Total ad revenue: ${adData.total_revenue_usd?.toFixed(4) || '0.00'}.
              </Text>
            </View>
          </>
        )}

        {/* Monthly Breakdown */}
        <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
        {data?.months?.length > 0 ? (
          data.months.map((m, idx) => (
            <View key={`${m.year}-${m.month}`} style={styles.monthCard}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthName}>{MONTH_NAMES[m.month]} {m.year}</Text>
                <Text style={styles.monthTotal}>{m.total_coins.toLocaleString()} coins</Text>
              </View>
              <View style={styles.monthDetails}>
                <View style={styles.detailItem}>
                  <Unlock size={14} color={COLORS.secondary} />
                  <Text style={styles.detailText}>Unlocks: {m.coins_from_unlocks.toLocaleString()}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Heart size={14} color="#e74c3c" />
                  <Text style={styles.detailText}>Tips: {m.coins_from_tips.toLocaleString()}</Text>
                </View>
                <Text style={styles.detailGhs}>GH₵{m.creator_share_ghs.toFixed(2)}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <TrendingUp size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No earnings yet. Publish stories with locked chapters to start earning!</Text>
          </View>
        )}

        <AdBanner placement="studio" navigation={navigation} />

        <View style={{ paddingHorizontal: SPACING.md }}>
          <BrandedFooter compact />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: SPACING.md,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.secondary },
  backBtn: { padding: SPACING.sm },
  container: { flex: 1 },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.secondary,
    marginTop: SPACING.sm,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  infoBox: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: 'rgba(212,168,67,0.05)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.1)',
  },
  infoText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  monthCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  monthName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  monthTotal: { fontSize: 14, fontWeight: '600', color: COLORS.secondary },
  monthDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flexWrap: 'wrap',
  },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12, color: COLORS.textMuted },
  detailGhs: { fontSize: 13, fontWeight: '700', color: '#2ecc71', marginLeft: 'auto' },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xl * 2 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, marginTop: SPACING.md, textAlign: 'center', paddingHorizontal: SPACING.xl },
});

export default EarningsScreen;
