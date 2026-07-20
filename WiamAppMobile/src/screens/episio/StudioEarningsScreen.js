/**
 * Layout: WiamStudio-Earnings.html — empty until team publishes / API ships
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Wallet } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const StudioEarningsScreen = () => {
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (!seriesId) {
          if (alive) setSeries(null);
          return;
        }
        const d = await studioEpisioApi.getSeries(seriesId);
        if (alive) setSeries(d?.series);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [seriesId]));

  const live = series?.pipeline_state === 'live'
    || ['published', 'ongoing', 'complete', 'approved'].includes(series?.status);
  const stats = series?.stats || {};
  const available = stats.earnings_available ?? stats.earnings ?? null;

  return (
    <EpisioScreenShell
      title="Earnings"
      subtitle={series?.title || 'Creator payouts'}
      footer={(
        <EpisioGoldButton
          label="Payout & KYC"
          onPress={() => navigation.navigate('StudioPayoutKyc')}
        />
      )}
    >
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <View style={styles.balanceCard}>
            <View style={styles.balTop}>
              <Wallet size={18} color={COLORS.navy} />
              <Text style={styles.balLbl}>AVAILABLE BALANCE</Text>
            </View>
            <Text style={styles.amount}>
              {live ? (available != null ? `₵${Number(available).toFixed(2)}` : '₵0.00') : '—'}
            </Text>
            <Text style={styles.balSub}>
              {live ? 'Ready to withdraw after KYC clears' : 'Opens when your series goes live'}
            </Text>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLbl}>This Month</Text>
              <Text style={styles.statVal}>{live ? '₵0.00' : '—'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLbl}>Pending Clearance</Text>
              <Text style={styles.statVal}>{live ? '₵0.00' : '—'}</Text>
            </View>
          </View>

          <View style={styles.nextCard}>
            <Text style={styles.nextTitle}>Next automatic payout</Text>
            <Text style={styles.nextBody}>
              Monthly payouts once your balance exceeds ₵100 and identity verification is complete.
            </Text>
          </View>

          <Text style={styles.section}>Earnings by Series</Text>
          {seriesId && series ? (
            <View style={styles.seriesRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.seriesTitle}>{series.title}</Text>
                <Text style={styles.seriesMeta}>
                  {live ? 'Live · earnings start after publish' : 'Not live yet'}
                </Text>
              </View>
              <Text style={styles.seriesAmt}>{live ? '₵0.00' : '—'}</Text>
            </View>
          ) : (
            <Text style={styles.empty}>Open a live series to see per-title earnings.</Text>
          )}

          <Text style={styles.section}>Payout History</Text>
          <View style={styles.historyEmpty}>
            <Text style={styles.empty}>
              {live
                ? 'No payouts yet. Complete KYC, then withdraw when your balance clears.'
                : 'Earnings stay empty until the WiamEpisio team publishes your complete series. Half stories never earn.'}
            </Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('StudioHelpQuality')}>
            <Text style={styles.helpLink}>Creator payout FAQ →</Text>
          </TouchableOpacity>
        </>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  balanceCard: {
    backgroundColor: COLORS.gold, borderRadius: 18, padding: 18, marginBottom: 14,
  },
  balTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  balLbl: { fontSize: 10, fontFamily: FONTS.extraBold, color: COLORS.navy, letterSpacing: 0.6 },
  amount: { fontSize: 32, fontFamily: FONTS.extraBold, color: COLORS.navy },
  balSub: { marginTop: 4, fontSize: 11.5, fontFamily: FONTS.medium, color: 'rgba(8,8,26,0.7)' },
  statGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  statLbl: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.textFaint, textTransform: 'uppercase' },
  statVal: { marginTop: 6, fontSize: 18, fontFamily: FONTS.extraBold, color: '#fff' },
  nextCard: {
    backgroundColor: 'rgba(59,178,115,0.1)', borderWidth: 1, borderColor: 'rgba(59,178,115,0.28)',
    borderRadius: 14, padding: 14, marginBottom: 18,
  },
  nextTitle: { fontFamily: FONTS.bold, color: '#3BB273', fontSize: 12.5, marginBottom: 4 },
  nextBody: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 11.5, lineHeight: 17 },
  section: {
    fontSize: 12, fontFamily: FONTS.extraBold, color: COLORS.textDim,
    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10, marginTop: 4,
  },
  seriesRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  seriesTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13 },
  seriesMeta: { marginTop: 3, fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 11 },
  seriesAmt: { fontFamily: FONTS.extraBold, color: COLORS.gold, fontSize: 14 },
  historyEmpty: {
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  empty: { color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 18, fontSize: 12.5 },
  helpLink: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 12.5, textAlign: 'center', paddingVertical: 8 },
});

export default StudioEarningsScreen;
