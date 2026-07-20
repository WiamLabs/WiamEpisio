/**
 * Layout: WiamStudio-Analytics.html — live series analytics (API when available)
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const StudioAnalyticsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await studioEpisioApi.getSeries(seriesId);
        if (alive) setSeries(d?.series);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [seriesId]));

  const live = ['published', 'ongoing', 'complete', 'approved'].includes(series?.status);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.h1}>Analytics</Text>
          <Text style={styles.sub}>{series?.title || 'Series'}</Text>
        </View>
      </View>
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {!live ? (
            <Text style={styles.empty}>
              Analytics open after the WiamEpisio team publishes your series. Finish your full {series?.unit_label || 'series'} and submit for review.
            </Text>
          ) : (
            <>
              <View style={styles.grid}>
                <View style={styles.card}><Text style={styles.lbl}>Status</Text><Text style={styles.val}>Live</Text></View>
                <View style={styles.card}><Text style={styles.lbl}>Episodes</Text><Text style={styles.val}>{series?.ready_episodes || 0}</Text></View>
                <View style={styles.card}><Text style={styles.lbl}>Structure</Text><Text style={styles.val}>{series?.structure_mode === 'season' ? `S${series?.season_number}` : 'Series'}</Text></View>
                <View style={styles.card}><Text style={styles.lbl}>QC</Text><Text style={styles.val}>{series?.season_qc_status || '—'}</Text></View>
              </View>
              <Text style={styles.note}>
                Detailed watch charts connect as viewer traffic grows. Your team publish moment is the start of earnings-ready stats.
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontFamily: FONTS.extraBold, color: '#fff', fontSize: 16 },
  sub: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 11.5, marginTop: 2 },
  empty: { color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%', backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  lbl: { color: COLORS.textFaint, fontFamily: FONTS.semi, fontSize: 11 },
  val: { marginTop: 6, color: '#fff', fontFamily: FONTS.extraBold, fontSize: 18 },
  note: { marginTop: 18, color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 19 },
});

export default StudioAnalyticsScreen;
