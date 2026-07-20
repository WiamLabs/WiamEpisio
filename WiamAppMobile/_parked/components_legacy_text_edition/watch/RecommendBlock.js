/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { EPISIO, EPISIO_FONTS, EPISIO_RADIUS, placeholderPosterFor } from '../../constants/episioTheme';
import resolveUrl from '../../utils/resolveUrl';

/**
 * Wattpad-style Recommended: 1 large featured + 2×2 small grid.
 */
const RecommendBlock = ({ items = [], onPressSeries }) => {
  if (!items.length) return null;
  const [hero, ...rest] = items;
  const grid = rest.slice(0, 4);

  const Poster = ({ series, large }) => {
    const uri = resolveUrl(series?.poster_url || series?.cover_url);
    const src = uri ? { uri } : placeholderPosterFor(series?.id);
    return (
      <TouchableOpacity
        style={[styles.card, large ? styles.large : styles.small]}
        onPress={() => onPressSeries?.(series)}
        activeOpacity={0.88}
      >
        <Image source={src} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0.45 }}
          end={{ x: 0.5, y: 1 }}
        />
        <Text style={[styles.title, large && styles.titleLg]} numberOfLines={2}>
          {series?.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {series?.genre || 'Drama'}
          {series?.total_episodes ? ` · ${series.total_episodes} eps` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.row}>
      <Poster series={hero} large />
      <View style={styles.grid}>
        {grid.map((s) => (
          <Poster key={String(s.id)} series={s} />
        ))}
        {grid.length < 4
          ? Array.from({ length: 4 - grid.length }).map((_, i) => (
            <View key={`ph-${i}`} style={[styles.card, styles.small, styles.ph]} />
          ))
          : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    borderRadius: EPISIO_RADIUS.poster,
    overflow: 'hidden',
    backgroundColor: EPISIO.ink700,
    justifyContent: 'flex-end',
    padding: 8,
  },
  large: { width: '46%', aspectRatio: 2 / 3 },
  small: { width: '47%', aspectRatio: 1 },
  ph: { opacity: 0.3 },
  title: {
    fontFamily: EPISIO_FONTS.display,
    fontSize: 11,
    color: EPISIO.paper,
    zIndex: 2,
  },
  titleLg: { fontSize: 14 },
  meta: {
    fontSize: 9,
    color: EPISIO.smoke,
    fontFamily: EPISIO_FONTS.uiMedium,
    marginTop: 2,
    zIndex: 2,
  },
});

export default RecommendBlock;
