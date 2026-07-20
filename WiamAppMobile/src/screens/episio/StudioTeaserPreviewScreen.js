/**
 * Layout: WiamStudio-Teaser-Public-Preview.html
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Image, Share, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Bell } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';
import CONFIG from '../../constants/config';

const StudioTeaserPreviewScreen = () => {
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [series, setSeries] = useState(null);
  const [soft, setSoft] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [d, c] = await Promise.all([
          studioEpisioApi.getSeries(seriesId),
          studioEpisioApi.completeness(seriesId).catch(() => null),
        ]);
        if (!alive) return;
        setSeries(d?.series);
        setSoft(c?.soft_interest || null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [seriesId]));

  const poster = series?.has_cover
    ? resolveUrl(series?.poster_url || series?.cover_url)
    : null;
  const interested = soft?.combined || ((soft?.followers || 0) + (soft?.remind_count || 0));
  const publicUrl = `${CONFIG.SITE_ORIGIN || 'https://episio.wiamlabs.com'}/series/${seriesId}`;

  return (
    <EpisioScreenShell
      title="Teaser preview"
      subtitle="What viewers see before go-live"
      footer={(
        <>
          <EpisioGoldButton
            label="Open Trailer tools"
            onPress={() => navigation.navigate('StudioTrailer', { seriesId })}
          />
          <View style={{ height: 10 }} />
          <EpisioGoldButton
            label="Share teaser link"
            variant="ghost"
            onPress={() => Share.share({
              message: `Coming soon on WiamEpisio: ${series?.title || 'my series'}\n${publicUrl}`,
            }).catch(() => {})}
          />
        </>
      )}
    >
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <View style={styles.previewBanner}>
            <Text style={styles.previewBannerText}>PREVIEW MODE — this is what viewers see</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.exit}>Exit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {poster ? (
              <Image source={{ uri: poster }} style={styles.poster} />
            ) : (
              <View style={[styles.poster, styles.posterEmpty]}>
                <Text style={styles.posterEmptyText}>No cover yet</Text>
              </View>
            )}
            <View style={styles.comingSoon}>
              <Text style={styles.comingText}>COMING SOON</Text>
            </View>
            {series?.genre ? (
              <View style={styles.genreRow}>
                <Text style={styles.genreChip}>{series.genre}</Text>
              </View>
            ) : null}
            <Text style={styles.name}>{series?.title || 'Series'}</Text>
            <Text style={styles.meta}>
              {series?.planned_episode_count || 0} Episodes planned
              {interested ? ` · ${interested} interested` : ''}
            </Text>

            <View style={styles.viewerCta}>
              <View style={styles.remindFake}>
                <Bell size={14} color={COLORS.navy} />
                <Text style={styles.remindText}>Remind Me</Text>
              </View>
            </View>
          </View>

          <View style={styles.creatorNote}>
            <Text style={styles.creatorNoteText}>
              Soft interest is optional for submit. Share your teaser link — remind-me and follower counts apply once the team lists your series as Coming Soon.
            </Text>
          </View>
        </>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  previewBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(212,160,23,0.14)', borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.3)',
  },
  previewBannerText: { flex: 1, fontFamily: FONTS.bold, color: COLORS.gold, fontSize: 10.5 },
  exit: { fontFamily: FONTS.semi, color: COLORS.textDim, fontSize: 12, marginLeft: 8 },
  card: {
    backgroundColor: COLORS.navyCard, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center',
  },
  poster: { width: 140, height: 200, borderRadius: 12, backgroundColor: COLORS.navySoft, marginBottom: 12 },
  posterEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.navyLine },
  posterEmptyText: { fontFamily: FONTS.semi, color: COLORS.textFaint, fontSize: 11 },
  comingSoon: {
    backgroundColor: 'rgba(212,160,23,0.16)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, marginBottom: 8,
  },
  comingText: { fontFamily: FONTS.extraBold, color: COLORS.gold, fontSize: 10 },
  genreRow: { flexDirection: 'row', marginBottom: 8 },
  genreChip: {
    fontFamily: FONTS.semi, color: COLORS.textDim, fontSize: 11,
    backgroundColor: COLORS.navySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  name: { fontFamily: FONTS.extraBold, color: '#fff', fontSize: 18, textAlign: 'center' },
  meta: { marginTop: 6, color: COLORS.textFaint, fontFamily: FONTS.regular, fontSize: 12, textAlign: 'center' },
  viewerCta: { marginTop: 16, width: '100%' },
  remindFake: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 13,
  },
  remindText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 13 },
  creatorNote: {
    marginTop: 14, backgroundColor: COLORS.navyCard, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  creatorNoteText: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, lineHeight: 17 },
});

export default StudioTeaserPreviewScreen;
