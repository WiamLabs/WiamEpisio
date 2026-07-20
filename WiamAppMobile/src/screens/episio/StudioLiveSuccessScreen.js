/**
 * Layout: WiamStudio-Live-Success.html — warm team talk (Screens 2 copy)
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Image, ActivityIndicator, Share, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Layers, Link2 } from 'lucide-react-native';
import EpisioCenterState from '../../components/episio/EpisioCenterState';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';

const StudioLiveSuccessScreen = () => {
  const navigation = useNavigation();
  const { title: paramTitle, underReview, message, autoPublished, seriesId } = useRoute().params || {};
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(!!seriesId);

  useFocusEffect(useCallback(() => {
    if (!seriesId) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const d = await studioEpisioApi.getSeries(seriesId);
        if (alive) setSeries(d?.series);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [seriesId]));

  const title = series?.title || paramTitle || 'Series';
  const poster = resolveUrl(series?.poster_url || series?.cover_url);
  const publicUrl = seriesId
    ? `https://episio.wiamlabs.com/series/${seriesId}`
    : 'https://episio.wiamlabs.com';

  const headline = underReview
    ? 'With the WiamEpisio team'
    : "You're live!";

  const body = message || (
    underReview
      ? `We've received "${title}". Our team is reviewing your trailer and every episode. We'll publish it for viewers when it clears — you don't publish yourself.`
      : autoPublished
        ? `WiamEpisio has published "${title}" after a clean Good/Excellent review. Viewers can find, follow and unlock it right now.`
        : `WiamEpisio has published "${title}". Viewers across WiamEpisio can find, follow and unlock it right now.`
  );

  const shareLink = async () => {
    try {
      await Share.share({ message: `Watch ${title} on WiamEpisio: ${publicUrl}`, url: publicUrl });
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  return (
    <EpisioCenterState
      hideBack
      icon={<Layers size={42} color={COLORS.gold} />}
      title={headline}
      subtitle={body}
      card={(
        <View style={styles.cardInner}>
          {poster ? <Image source={{ uri: poster }} style={styles.poster} /> : <View style={styles.poster} />}
          <View style={{ flex: 1 }}>
            <View style={styles.liveDot}>
              <Text style={styles.liveText}>{underReview ? 'REVIEW' : 'LIVE'}</Text>
            </View>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardMeta}>
              {underReview
                ? 'Full check in progress · Our team publishes'
                : (autoPublished ? 'Published after clean review' : 'Published by the WiamEpisio team')}
            </Text>
          </View>
          {!underReview ? (
            <TouchableOpacity onPress={shareLink} style={styles.linkBtn}>
              <Link2 size={16} color={COLORS.gold} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      primary={(
        <View style={{ width: '100%', gap: 10 }}>
          {!underReview && seriesId ? (
            <EpisioGoldButton
              label="View Public Page"
              onPress={() => navigation.navigate('SeriesDetail', { seriesId })}
            />
          ) : null}
          <EpisioGoldButton
            label="Back to Studio Home"
            onPress={() => navigation.navigate('StudioHome')}
            variant={!underReview && seriesId ? 'ghost' : 'gold'}
          />
        </View>
      )}
      tertiary={(
        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>{underReview ? 'While you wait' : 'Tips to grow this week'}</Text>
          {!underReview ? (
            <>
              <Text style={styles.tip}>Share your public series link — every view helps early ranking.</Text>
              <Text style={styles.tip}>Reply to early comments — creators who show up in week one keep people longer.</Text>
              <Text style={styles.tip}>Check Analytics daily for where viewers drop off.</Text>
            </>
          ) : (
            <>
              <Text style={styles.tip}>Share your teaser — soft interest still helps.</Text>
              <Text style={styles.tip}>Start Season 2 only after this unit is live and complete.</Text>
              <Text style={styles.tip}>Trusted creators get faster review windows after clean seasons.</Text>
            </>
          )}
          <TouchableOpacity onPress={() => navigation.navigate('CreatorTrustTier')}>
            <Text style={styles.ghost}>View Creator Trust Tier</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  cardInner: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  poster: { width: 48, height: 70, borderRadius: 8, backgroundColor: COLORS.navySoft },
  liveDot: {
    alignSelf: 'flex-start', backgroundColor: '#E4573D', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2, marginBottom: 4,
  },
  liveText: { fontSize: 9, fontFamily: FONTS.extraBold, color: '#fff' },
  cardTitle: { fontSize: 14, fontFamily: FONTS.extraBold, color: '#fff' },
  cardMeta: { marginTop: 3, fontSize: 11, color: COLORS.textDim, fontFamily: FONTS.regular },
  linkBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  tips: { width: '100%', marginTop: 8 },
  tipsTitle: { fontSize: 13, fontFamily: FONTS.bold, color: '#fff', marginBottom: 10, textAlign: 'center' },
  tip: { fontSize: 12, color: COLORS.textDim, lineHeight: 18, marginBottom: 8, fontFamily: FONTS.regular, textAlign: 'center' },
  ghost: { textAlign: 'center', color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 13, paddingVertical: 12 },
});

export default StudioLiveSuccessScreen;
