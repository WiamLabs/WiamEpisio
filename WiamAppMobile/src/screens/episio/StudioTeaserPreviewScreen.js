/**
 * Layout: WiamStudio-Teaser-Public-Preview.html
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';

const StudioTeaserPreviewScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      try {
        const d = await studioEpisioApi.getSeries(seriesId);
        setSeries(d?.series);
      } finally {
        setLoading(false);
      }
    })();
  }, [seriesId]));

  const poster = resolveUrl(series?.poster_url || series?.cover_url);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingHorizontal: 20 }]}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <ChevronLeft size={20} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Teaser public preview</Text>
      <Text style={styles.sub}>
        This is how soft-interest viewers taste your story before the WiamEpisio team publishes the full series.
      </Text>
      {loading ? <ActivityIndicator color={COLORS.gold} /> : (
        <View style={styles.card}>
          {poster ? <Image source={{ uri: poster }} style={styles.poster} /> : <View style={styles.poster} />}
          <Text style={styles.name}>{series?.title || 'Series'}</Text>
          <Text style={styles.meta}>
            Trailer {series?.trailer_qa_status || 'none'} · {series?.planned_episode_count || 0} eps planned
          </Text>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate('StudioTrailer', { seriesId })}
          >
            <Text style={styles.ctaText}>Open Trailer tools</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff' },
  sub: { marginTop: 8, marginBottom: 18, color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 19 },
  card: {
    backgroundColor: COLORS.navyCard, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center',
  },
  poster: { width: 120, height: 170, borderRadius: 12, backgroundColor: COLORS.navySoft, marginBottom: 12 },
  name: { fontFamily: FONTS.extraBold, color: '#fff', fontSize: 16 },
  meta: { marginTop: 6, color: COLORS.textFaint, fontFamily: FONTS.regular, fontSize: 12 },
  cta: { marginTop: 16, backgroundColor: COLORS.gold, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18 },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
});

export default StudioTeaserPreviewScreen;
