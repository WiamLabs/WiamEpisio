/**
 * Layout: WiamStudio-Series-Dashboard.html
 * Live series stats · links to Analytics / Earnings — no fake chart data
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';

const isLive = (series) => (
  series?.pipeline_state === 'live'
  || ['published', 'ongoing', 'complete', 'approved'].includes(series?.status)
);

const StudioDashboardScreen = () => {
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!seriesId) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await studioEpisioApi.getSeries(seriesId);
        if (alive) setData(d);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [seriesId]));

  const series = data?.series;
  const eps = data?.episodes || [];
  const live = isLive(series);
  const poster = resolveUrl(series?.poster_url || series?.cover_url);
  const stats = series?.stats || data?.stats || {};

  const topEps = [...eps]
    .filter((e) => e.transcode_status === 'ready')
    .sort((a, b) => a.episode_number - b.episode_number)
    .slice(0, 6);

  return (
    <EpisioScreenShell
      title="Series Dashboard"
      subtitle={live ? '● Live' : 'Not live yet'}
      footer={live ? (
        <View style={styles.linkRow}>
          <View style={{ flex: 1 }}>
            <EpisioGoldButton
              label="Open Analytics"
              onPress={() => navigation.navigate('StudioAnalytics', { seriesId })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <EpisioGoldButton
              label="Earnings"
              onPress={() => navigation.navigate('StudioEarnings', { seriesId })}
              variant="ghost"
            />
          </View>
        </View>
      ) : (
        <EpisioGoldButton
          label="Back to series workspace"
          onPress={() => navigation.navigate('StudioSeriesDetail', { seriesId })}
        />
      )}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : !live ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Dashboard opens when our team publishes</Text>
          <Text style={styles.emptyBody}>
            Finish your complete {series?.unit_label || 'series'}, pass review, and the WiamEpisio team will put it live. Stats and earnings start from that moment.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.posterWrap}>
              {poster ? <Image source={{ uri: poster }} style={styles.poster} /> : <View style={styles.poster} />}
              <Text style={styles.liveTag}>LIVE</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.seriesTitle}>{series?.title || 'Series'}</Text>
              <Text style={styles.seriesSub}>
                {series?.ready_episodes || eps.length} Episodes · Published by our team
              </Text>
            </View>
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => navigation.navigate('StudioSeriesDetail', { seriesId })}
            >
              <Text style={styles.manageText}>Manage</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLbl}>Total Views</Text>
              <Text style={styles.statVal}>{stats.views != null ? String(stats.views) : '—'}</Text>
              <Text style={styles.statDelta}>From live traffic</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLbl}>Watch Time</Text>
              <Text style={styles.statVal}>{stats.watch_hours != null ? `${stats.watch_hours}h` : '—'}</Text>
              <Text style={styles.statDelta}>Hours watched</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLbl}>Unlocks</Text>
              <Text style={styles.statVal}>{stats.unlocks != null ? String(stats.unlocks) : '—'}</Text>
              <Text style={styles.statDelta}>Coin unlocks</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLbl}>Earnings</Text>
              <Text style={styles.statVal}>{stats.earnings != null ? `₵${stats.earnings}` : '₵0'}</Text>
              <Text style={styles.statDelta}>After KYC</Text>
            </View>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Daily Views</Text>
            <Text style={styles.chartEmpty}>
              Charts appear when viewer analytics are available for this series. No placeholder data.
            </Text>
          </View>

          <Text style={styles.epTitle}>Episodes ready</Text>
          {topEps.map((ep) => (
            <TouchableOpacity
              key={ep.id}
              style={styles.epRow}
              onPress={() => navigation.navigate('StudioEpisodeDetail', {
                seriesId, episodeId: ep.id, episodeNumber: ep.episode_number,
              })}
            >
              <Text style={styles.epNum}>EP{ep.episode_number}</Text>
              <Text style={styles.epName} numberOfLines={1}>{ep.title || 'Untitled'}</Text>
              <Text style={styles.epViews}>{ep.is_final ? 'Final' : 'Draft'}</Text>
            </TouchableOpacity>
          ))}
          {!topEps.length ? (
            <Text style={styles.chartEmpty}>No ready episodes yet.</Text>
          ) : null}
        </>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  emptyBox: { paddingTop: 12 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 10 },
  emptyBody: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textDim, lineHeight: 20 },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 16, padding: 13, marginBottom: 16,
  },
  posterWrap: { position: 'relative' },
  poster: { width: 48, height: 69, borderRadius: 9, backgroundColor: '#3a1420' },
  liveTag: {
    position: 'absolute', top: 5, left: 5, fontSize: 7, fontFamily: FONTS.extraBold,
    color: '#fff', backgroundColor: '#E4573D', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
    overflow: 'hidden',
  },
  seriesTitle: { fontSize: 14, fontFamily: FONTS.extraBold, color: '#fff' },
  seriesSub: { fontSize: 10.5, fontFamily: FONTS.regular, color: COLORS.textDim, marginTop: 3 },
  manageBtn: {
    marginLeft: 'auto', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10,
    backgroundColor: COLORS.navySoft,
  },
  manageText: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.gold },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47%', backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 14, padding: 13,
  },
  statLbl: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.textFaint, textTransform: 'uppercase' },
  statVal: { fontSize: 19, fontFamily: FONTS.extraBold, color: '#fff', marginVertical: 6 },
  statDelta: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.textFaint },
  chartCard: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  chartTitle: { fontSize: 12.5, fontFamily: FONTS.bold, color: '#fff', marginBottom: 8 },
  chartEmpty: { fontSize: 12, color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 18 },
  epTitle: {
    fontSize: 12, fontFamily: FONTS.extraBold, color: COLORS.textDim,
    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 12,
  },
  epRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  epNum: { width: 36, fontSize: 11, fontFamily: FONTS.extraBold, color: COLORS.textFaint },
  epName: { flex: 1, fontSize: 12.5, fontFamily: FONTS.medium, color: '#fff' },
  epViews: { fontSize: 10.5, fontFamily: FONTS.semi, color: COLORS.textDim },
  linkRow: { flexDirection: 'row', gap: 10 },
});

export default StudioDashboardScreen;
