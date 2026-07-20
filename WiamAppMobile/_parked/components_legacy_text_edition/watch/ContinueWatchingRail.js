/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * Continue watching rail for drama episodes (native Watch hub / Home).
 */
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { Play } from 'lucide-react-native';
import resolveUrl from '../../utils/resolveUrl';

const ContinueWatchingRail = ({ items = [], navigation, title = 'Continue watching' }) => {
  if (!items.length) return null;

  const handlePress = (item) => {
    const seriesId = item.series?.id;
    const episodeId = item.episode?.id;
    if (!seriesId) return;
    navigation.navigate('Player', { seriesId, episodeId });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{title}</Text>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item, i) => String(item.episode?.id || i)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: SPACING.lg }}
        renderItem={({ item }) => {
          const poster = resolveUrl(
            item.episode?.poster_url || item.series?.poster_url || item.series?.cover_url,
          );
          return (
            <TouchableOpacity style={styles.card} onPress={() => handlePress(item)} activeOpacity={0.85}>
              {poster ? (
                <Image source={{ uri: poster }} style={styles.poster} />
              ) : (
                <View style={[styles.poster, styles.ph]}>
                  <Play size={22} color={COLORS.secondary} />
                </View>
              )}
              <Text style={styles.title} numberOfLines={1}>{item.series?.title || 'Series'}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                Ep. {item.episode?.episode_number || '?'}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  heading: {
    fontFamily: FONTS.displaySemi,
    color: COLORS.text,
    fontSize: 18,
    marginBottom: SPACING.sm,
  },
  card: { width: 110, marginRight: 12 },
  poster: {
    width: 110,
    height: 160,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  ph: { alignItems: 'center', justifyContent: 'center' },
  title: { color: COLORS.text, fontSize: 12, fontWeight: '700', marginTop: 6 },
  meta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
});

export default ContinueWatchingRail;
