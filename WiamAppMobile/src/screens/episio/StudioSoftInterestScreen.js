/**
 * Layout: WiamStudio-Soft-Interest.html
 * Data: readiness.soft_interest from series completeness
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import CONFIG from '../../constants/config';

const StudioSoftInterestScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      setData(await studioEpisioApi.completeness(seriesId));
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const soft = data?.soft_interest || {};
  const followers = soft.followers || 0;
  const reminds = soft.remind_count || 0;
  const combined = soft.combined || followers + reminds;
  const target = 200;
  const pct = Math.min(100, Math.round((combined / target) * 100));
  const need = Math.max(0, target - combined);
  const series = data?.series;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.h1}>Soft Interest</Text>
          <Text style={styles.sub}>{series?.title || 'Series'}</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View style={styles.ringCard}>
            <Text style={styles.ringBig}>{combined}</Text>
            <Text style={styles.ringOf}>OF {target}</Text>
            <Text style={styles.ringTitle}>{pct}% to launch-ready</Text>
            <Text style={styles.ringSub}>
              {soft.soft_ok
                ? 'Threshold met — you can submit for live'
                : `Need ${need} more followers or remind-me taps`}
            </Text>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Followers</Text>
              <Text style={styles.statValue}>{followers}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Remind Me Taps</Text>
              <Text style={styles.statValue}>{reminds}</Text>
            </View>
          </View>

          <View style={styles.thresholdCard}>
            <Text style={styles.thresholdTitle}>Why this matters</Text>
            <Text style={styles.thresholdText}>
              Series need <Text style={{ color: '#fff', fontFamily: FONTS.bold }}>50 followers or 200 combined remind-me + followers</Text>
              {' '}before Submit unlocks. Hard quality (full season + trailer) still comes first.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => Share.share({
              message: `Coming soon on WiamEpisio: ${series?.title || 'my series'}\n${CONFIG.SITE_ORIGIN}/series/${seriesId}`,
            }).catch(() => {})}
          >
            <Text style={styles.shareText}>Share Teaser to Boost Interest</Text>
          </TouchableOpacity>

          {soft.soft_ok && series?.season_locked ? (
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => navigation.navigate('StudioSubmitForLive', { seriesId })}
            >
              <Text style={styles.nextText}>Continue to Submit for Live</Text>
            </TouchableOpacity>
          ) : null}

          {!series?.season_locked ? (
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => navigation.navigate('StudioSeasonLock', { seriesId })}
            >
              <Text style={styles.nextText}>Lock complete season first</Text>
            </TouchableOpacity>
          ) : null}
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
  sub: { fontSize: 10.5, color: COLORS.textFaint, fontFamily: FONTS.semi },
  ringCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 18, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 24, alignItems: 'center', marginBottom: 16,
  },
  ringBig: { fontSize: 36, fontFamily: FONTS.extraBold, color: COLORS.gold },
  ringOf: { fontSize: 11, color: COLORS.textFaint, fontFamily: FONTS.bold, marginTop: 2 },
  ringTitle: { marginTop: 14, fontSize: 15, fontFamily: FONTS.extraBold, color: '#fff' },
  ringSub: { marginTop: 6, fontSize: 12, color: COLORS.textDim, textAlign: 'center', fontFamily: FONTS.regular },
  statGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: COLORS.navyCard, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.navyLine, padding: 14,
  },
  statLabel: { fontSize: 11, color: COLORS.textFaint, fontFamily: FONTS.semi },
  statValue: { marginTop: 6, fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff' },
  thresholdCard: {
    backgroundColor: 'rgba(212,160,23,0.1)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.28)',
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  thresholdTitle: { fontSize: 12.5, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 8 },
  thresholdText: { fontSize: 11.5, color: '#D9C89A', lineHeight: 18, fontFamily: FONTS.regular },
  shareBtn: {
    width: '100%', paddingVertical: 15, borderRadius: 15, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center',
  },
  shareText: { color: COLORS.gold, fontFamily: FONTS.bold, fontSize: 13 },
  nextBtn: {
    marginTop: 12, backgroundColor: COLORS.gold, borderRadius: 15, paddingVertical: 15, alignItems: 'center',
  },
  nextText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 14 },
});

export default StudioSoftInterestScreen;
