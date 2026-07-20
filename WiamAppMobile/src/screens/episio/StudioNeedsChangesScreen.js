/**
 * Layout: WiamStudio-Needs-Changes.html
 * API: GET review-status · change_items with fix targets
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, X } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';

const StudioNeedsChangesScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      setData(await studioEpisioApi.reviewStatus(seriesId));
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const series = data?.series;
  const items = data?.change_items || [];
  const poster = resolveUrl(series?.poster_url || series?.cover_url);

  const openFix = (item) => {
    const t = item?.fix_target;
    if (t === 'trailer') {
      navigation.navigate('StudioTrailer', { seriesId });
    } else if (t === 'cover') {
      navigation.navigate('StudioSeriesDetail', { seriesId });
    } else if (item?.episode_id || item?.episode_number) {
      navigation.navigate('StudioEpisodeUpload', {
        seriesId,
        episodeId: item.episode_id,
        episodeNumber: item.episode_number,
      });
    } else {
      navigation.navigate('StudioEpisodeList', { seriesId });
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Needs Changes</Text>
      </View>

      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
            <View style={styles.banner}>
              <View style={styles.bannerIcon}><X size={18} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>The WiamEpisio team reviewed your series</Text>
                <Text style={styles.bannerSub}>
                  We flagged the problems below. Your whole series stays offline — no episode goes live until everything is fixed. Tap Fix → on each item, then resubmit the full series.
                </Text>
              </View>
            </View>

            <View style={styles.seriesRow}>
              {poster ? <Image source={{ uri: poster }} style={styles.poster} /> : <View style={styles.poster} />}
              <View>
                <Text style={styles.seriesTitle}>{series?.title || 'Series'}</Text>
                <Text style={styles.seriesMeta}>
                  {series?.planned_episode_count || 0} Episodes · {series?.genre || 'Drama'}
                </Text>
              </View>
            </View>

            <Text style={styles.section}>{items.length || 0} items to fix</Text>
            {items.map((item, idx) => (
              <TouchableOpacity key={`${item.tag}-${idx}`} style={styles.note} onPress={() => openFix(item)}>
                <View style={styles.noteHead}>
                  <Text style={styles.tag}>{item.tag || 'FIX'}</Text>
                  <Text style={styles.fixLink}>
                    Fix in {item.fix_target === 'trailer' ? 'Trailer' : item.fix_target === 'cover' ? 'Cover' : 'Episodes'} →
                  </Text>
                </View>
                <Text style={styles.noteTitle}>{item.title}</Text>
                <Text style={styles.noteText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
            {!items.length ? (
              <Text style={styles.empty}>No structured items — open Episodes or Trailer and re-upload failed assets.</Text>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => navigation.navigate('StudioEpisodeList', { seriesId })}
            >
              <Text style={styles.ctaText}>Open Items & Fix</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('StudioSubmitForLive', { seriesId })}>
              <Text style={styles.footerNote}>Resubmit once all items are resolved</Text>
            </TouchableOpacity>
          </View>
        </>
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
  banner: {
    flexDirection: 'row', gap: 12, backgroundColor: 'rgba(228,87,61,0.12)',
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(228,87,61,0.3)', marginBottom: 18,
  },
  bannerIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.error,
    alignItems: 'center', justifyContent: 'center',
  },
  bannerTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13 },
  bannerSub: { marginTop: 4, fontFamily: FONTS.regular, color: '#E0A79A', fontSize: 11.5, lineHeight: 17 },
  seriesRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 18 },
  poster: { width: 52, height: 74, borderRadius: 8, backgroundColor: COLORS.navyCard },
  seriesTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 15 },
  seriesMeta: { marginTop: 4, color: COLORS.textDim, fontFamily: FONTS.regular, fontSize: 12 },
  section: { fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 12, marginBottom: 10 },
  note: {
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  noteHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  tag: { fontFamily: FONTS.extraBold, color: COLORS.gold, fontSize: 10 },
  fixLink: { fontFamily: FONTS.bold, color: COLORS.gold, fontSize: 11 },
  noteTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13, marginBottom: 4 },
  noteText: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, lineHeight: 18 },
  empty: { color: COLORS.textFaint, fontFamily: FONTS.regular, marginTop: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.navyLine },
  cta: { backgroundColor: COLORS.gold, borderRadius: 16, padding: 16, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 15 },
  footerNote: { marginTop: 10, textAlign: 'center', color: COLORS.textFaint, fontFamily: FONTS.semi, fontSize: 11.5 },
});

export default StudioNeedsChangesScreen;
