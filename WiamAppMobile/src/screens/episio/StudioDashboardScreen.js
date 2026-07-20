/**
 * Layout: WiamStudio-Series-Dashboard.html
 * Live series stats · links to Analytics / Earnings
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';

const DEMO_BARS = [40, 55, 48, 70, 100, 82, 65];
const DEMO_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const isLive = (series) => (
  series?.pipeline_state === 'live'
  || ['published', 'ongoing', 'complete', 'approved'].includes(series?.status)
);

const StudioDashboardScreen = () => {
  const insets = useSafeAreaInsets();
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

  const topEps = [...eps]
    .filter((e) => e.transcode_status === 'ready')
    .sort((a, b) => a.episode_number - b.episode_number)
    .slice(0, 4);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.h1}>Series Dashboard</Text>
          {live ? (
            <Text style={styles.liveSub}>● Live · Last 7 days</Text>
          ) : (
            <Text style={styles.waitSub}>Not live yet</Text>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : !live ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Dashboard opens when our team publishes</Text>
          <Text style={styles.emptyBody}>
            Finish your complete {series?.unit_label || 'series'}, pass review, and the WiamEpisio team will put it live. Stats and earnings start from that moment.
          </Text>
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => navigation.navigate('StudioSeriesDetail', { seriesId })}
          >
            <Text style={styles.manageText}>Back to series workspace</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
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
              <Text style={styles.statVal}>—</Text>
              <Text style={[styles.statDelta, styles.up]}>Charts connect as traffic grows</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLbl}>Watch Time</Text>
              <Text style={styles.statVal}>—</Text>
              <Text style={[styles.statDelta, styles.up]}>Last 7 days</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLbl}>Unlocks</Text>
              <Text style={styles.statVal}>—</Text>
              <Text style={[styles.statDelta, styles.up]}>Coin unlocks</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLbl}>Earnings</Text>
              <Text style={styles.statVal}>₵0</Text>
              <Text style={styles.statDelta}>After KYC</Text>
            </View>
          </View>

          <View style={styles.chartCard}>
            <View style={styles.chartHead}>
              <Text style={styles.chartTitle}>Daily Views</Text>
              <Text style={styles.chartPeriod}>Last 7 days</Text>
            </View>
            <View style={styles.bars}>
              {DEMO_BARS.map((h, i) => (
                <View
                  key={DEMO_DAYS[i]}
                  style={[styles.bar, { height: `${h}%` }, h === 100 && styles.barPeak]}
                />
              ))}
            </View>
            <View style={styles.barLabels}>
              {DEMO_DAYS.map((d) => (
                <Text key={d} style={styles.barLbl}>{d}</Text>
              ))}
            </View>
            <Text style={styles.chartNote}>Placeholder bars until viewer analytics API ships.</Text>
          </View>

          <Text style={styles.epTitle}>Episodes ready</Text>
          {topEps.map((ep, i) => (
            <View key={ep.id} style={styles.epRow}>
              <Text style={styles.epNum}>EP{ep.episode_number}</Text>
              <View style={styles.epTrack}>
                <View style={[styles.epFill, { width: `${100 - i * 18}%` }]} />
              </View>
              <Text style={styles.epViews}>{ep.is_final ? 'Final' : 'Draft'}</Text>
            </View>
          ))}

          <View style={styles.linkRow}>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => navigation.navigate('StudioAnalytics', { seriesId })}
            >
              <Text style={styles.linkText}>Open Analytics</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkBtnAlt}
              onPress={() => navigation.navigate('StudioEarnings', { seriesId })}
            >
              <Text style={styles.linkTextAlt}>Earnings</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontSize: 16, fontFamily: FONTS.extraBold, color: '#fff' },
  liveSub: { fontSize: 10.5, fontFamily: FONTS.bold, color: '#3BB273', marginTop: 1 },
  waitSub: { fontSize: 10.5, fontFamily: FONTS.semi, color: COLORS.textFaint, marginTop: 1 },
  emptyBox: { paddingHorizontal: 24, paddingTop: 24 },
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
  up: { color: '#3BB273' },
  chartCard: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  chartTitle: { fontSize: 12.5, fontFamily: FONTS.bold, color: '#fff' },
  chartPeriod: { fontSize: 10.5, fontFamily: FONTS.regular, color: COLORS.textFaint },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 70 },
  bar: { flex: 1, backgroundColor: COLORS.gold, borderTopLeftRadius: 4, borderTopRightRadius: 4, opacity: 0.85 },
  barPeak: { opacity: 1 },
  barLabels: { flexDirection: 'row', gap: 6, marginTop: 6 },
  barLbl: { flex: 1, textAlign: 'center', fontSize: 8, color: COLORS.textFaint },
  chartNote: { marginTop: 10, fontSize: 10, color: COLORS.textFaint, fontFamily: FONTS.regular },
  epTitle: {
    fontSize: 12, fontFamily: FONTS.extraBold, color: COLORS.textDim,
    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 12,
  },
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.navyLine },
  epNum: { width: 36, fontSize: 11, fontFamily: FONTS.extraBold, color: COLORS.textFaint },
  epTrack: { flex: 1, height: 6, backgroundColor: COLORS.navyLine, borderRadius: 99, overflow: 'hidden' },
  epFill: { height: '100%', backgroundColor: COLORS.gold, borderRadius: 99 },
  epViews: { width: 44, textAlign: 'right', fontSize: 10.5, fontFamily: FONTS.semi, color: COLORS.textDim },
  linkRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  linkBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: COLORS.gold, alignItems: 'center' },
  linkText: { fontFamily: FONTS.bold, color: COLORS.navy },
  linkBtnAlt: {
    flex: 1, padding: 14, borderRadius: 14, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center',
  },
  linkTextAlt: { fontFamily: FONTS.bold, color: COLORS.gold },
});

export default StudioDashboardScreen;
