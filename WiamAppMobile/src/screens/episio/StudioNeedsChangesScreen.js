/**
 * Layout: WiamStudio-Needs-Changes.html
 * API: GET review-status · change_items with fix targets
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';

const StudioNeedsChangesScreen = () => {
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
      navigation.navigate('StudioCover', { seriesId });
    } else if (t === 'banner') {
      navigation.navigate('StudioBanner', { seriesId });
    } else if (t === 'rights') {
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

  const fixLabel = (item) => {
    const t = item?.fix_target;
    if (t === 'trailer') return 'Trailer';
    if (t === 'cover') return 'Cover';
    if (t === 'banner') return 'Banner';
    if (t === 'rights') return 'Rights';
    return 'Episodes';
  };

  return (
    <EpisioScreenShell
      title="Reviewer Feedback"
      subtitle={data?.reviewed_at ? `Reviewed ${data.reviewed_at}` : 'Needs changes before going live'}
      footer={(
        <>
          <EpisioGoldButton
            label="Open Items & Fix"
            onPress={() => {
              if (items[0]) openFix(items[0]);
              else navigation.navigate('StudioEpisodeList', { seriesId });
            }}
          />
          <TouchableOpacity
            onPress={() => navigation.navigate('StudioSubmitForLive', { seriesId })}
            style={{ paddingVertical: 12 }}
          >
            <Text style={styles.footerNote}>
              Resubmit once all {items.length || ''} items are resolved
            </Text>
          </TouchableOpacity>
        </>
      )}
    >
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <View style={styles.banner}>
            <View style={styles.bannerIcon}><X size={18} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Needs changes before going live</Text>
              <Text style={styles.bannerSub}>
                Fix the items below, then resubmit — no need to redo what already passed. Your whole series stays offline until everything is fixed.
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
                <Text style={styles.tag}>{(item.tag || 'FIX').toUpperCase()}</Text>
                <Text style={styles.fixLink}>Fix in {fixLabel(item)} →</Text>
              </View>
              <Text style={styles.noteTitle}>{item.title}</Text>
              <Text style={styles.noteText}>{item.text}</Text>
            </TouchableOpacity>
          ))}
          {!items.length ? (
            <Text style={styles.empty}>No structured items — open Episodes or Trailer and re-upload failed assets.</Text>
          ) : null}
        </>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', gap: 12, backgroundColor: 'rgba(228,87,61,0.12)',
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(228,87,61,0.3)', marginBottom: 18,
  },
  bannerIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#E4573D',
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
  footerNote: { textAlign: 'center', color: COLORS.textFaint, fontFamily: FONTS.semi, fontSize: 11.5 },
});

export default StudioNeedsChangesScreen;
