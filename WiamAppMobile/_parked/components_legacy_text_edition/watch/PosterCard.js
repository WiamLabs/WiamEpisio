/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Lock } from 'lucide-react-native';
import { EPISIO, EPISIO_FONTS, EPISIO_RADIUS, placeholderPosterFor } from '../../constants/episioTheme';
import FreeRing from './FreeRing';
import resolveUrl from '../../utils/resolveUrl';

const PosterCard = ({
  series,
  onPress,
  width,
  style,
  showRing = true,
}) => {
  const id = series?.id || 0;
  const uri = resolveUrl(series?.poster_url || series?.cover_url);
  const freeN = series?.free_episode_count ?? 5;
  const total = series?.total_episodes || series?.episode_count || 24;
  const pct = total > 0 ? Math.round((freeN / total) * 100) : 20;
  const lockedHint = freeN < total;

  return (
    <TouchableOpacity
      style={[styles.wrap, width ? { width } : null, style]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.poster}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Image source={placeholderPosterFor(id)} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0.4 }}
          end={{ x: 0.5, y: 1 }}
        />
        {showRing ? (
          <View style={styles.badge}>
            <FreeRing pct={pct} size={22} label="">
              {lockedHint && freeN < total * 0.5 ? (
                <Lock size={10} color={EPISIO.paper} />
              ) : (
                <Play size={10} color={EPISIO.paper} fill={EPISIO.paper} />
              )}
            </FreeRing>
          </View>
        ) : null}
        <Text style={styles.title} numberOfLines={2}>{series?.title || 'Series'}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {total ? `${total} episodes` : 'Series'}
          {series?.genre ? ` · ${series.genre}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: EPISIO_RADIUS.poster,
    overflow: 'hidden',
    backgroundColor: EPISIO.ink700,
    justifyContent: 'flex-end',
    padding: 10,
  },
  badge: { position: 'absolute', top: 8, right: 8, zIndex: 2 },
  title: {
    fontFamily: EPISIO_FONTS.display,
    fontSize: 13,
    color: EPISIO.paper,
    zIndex: 2,
  },
  meta: {
    fontSize: 10,
    color: EPISIO.smoke,
    marginTop: 2,
    fontFamily: EPISIO_FONTS.uiMedium,
    zIndex: 2,
  },
});

export default PosterCard;
