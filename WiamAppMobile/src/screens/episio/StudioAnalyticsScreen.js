/**
 * Layout: WiamStudio-Analytics.html — live series analytics (API when available)
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const PERIODS = ['7 Days', '30 Days', 'All Time'];

const StudioAnalyticsScreen = () => {
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30 Days');

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

  return (
    <EpisioScreenShell title="Analytics" subtitle={series?.title || 'Performance'}>
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <View style={styles.periodRow}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodChip, period === p && styles.periodOn]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.periodText, period === p && { color: COLORS.navy }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!live ? (
            <View style={styles.emptyCard}>
              <Text style={styles.empty}>
                Analytics open after the WiamEpisio team publishes your series. Finish your full {series?.unit_label || 'series'} and submit for review.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.grid}>
                <View style={styles.card}>
                  <Text style={styles.lbl}>Total Views</Text>
                  <Text style={styles.val}>{stats.views != null ? String(stats.views) : '—'}</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.lbl}>Watch Time</Text>
                  <Text style={styles.val}>{stats.watch_hours != null ? `${stats.watch_hours}h` : '—'}</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.lbl}>New Followers</Text>
                  <Text style={styles.val}>{stats.followers != null ? String(stats.followers) : '—'}</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.lbl}>Unlocks</Text>
                  <Text style={styles.val}>{stats.unlocks != null ? String(stats.unlocks) : '—'}</Text>
                </View>
              </View>

              <View style={styles.metaGrid}>
                <View style={styles.card}>
                  <Text style={styles.lbl}>Status</Text>
                  <Text style={styles.valSm}>Live</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.lbl}>Episodes</Text>
                  <Text style={styles.valSm}>{series?.ready_episodes || 0}</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.lbl}>Structure</Text>
                  <Text style={styles.valSm}>
                    {series?.structure_mode === 'season' ? `S${series?.season_number}` : 'Series'}
                  </Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.lbl}>QC</Text>
                  <Text style={styles.valSm}>{series?.season_qc_status || '—'}</Text>
                </View>
              </View>

              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Views trend · {period}</Text>
                <Text style={styles.note}>
                  Detailed watch charts connect as viewer traffic grows. No placeholder bars — real data only.
                </Text>
              </View>

              <TouchableOpacity onPress={() => navigation.navigate('StudioDashboard', { seriesId })}>
                <Text style={styles.link}>Open Series Dashboard →</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  periodOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  periodText: { fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 11.5 },
  emptyCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  empty: { color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  card: {
    width: '47%', backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  lbl: { color: COLORS.textFaint, fontFamily: FONTS.semi, fontSize: 11 },
  val: { marginTop: 6, color: '#fff', fontFamily: FONTS.extraBold, fontSize: 18 },
  valSm: { marginTop: 6, color: '#fff', fontFamily: FONTS.extraBold, fontSize: 15 },
  chartCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  chartTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13, marginBottom: 8 },
  note: { color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 19, fontSize: 12.5 },
  link: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
});

export default StudioAnalyticsScreen;
