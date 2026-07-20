/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { EPISIO, EPISIO_FONTS, EPISIO_RADIUS, placeholderPosterFor } from '../../constants/episioTheme';
import FreeRing from './FreeRing';
import resolveUrl from '../../utils/resolveUrl';

const HeroSeriesCard = ({ series, onWatch, style }) => {
  if (!series) return null;
  const uri = resolveUrl(series.poster_url || series.cover_url);
  const freeN = series.free_episode_count ?? 5;
  const total = series.total_episodes || 24;
  const pct = total > 0 ? Math.round((freeN / total) * 100) : 21;

  return (
    <View style={[styles.hero, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <Image source={placeholderPosterFor(series.id)} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}
      <LinearGradient
        colors={['rgba(11,10,8,0.1)', 'rgba(11,10,8,0.85)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={styles.top}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>New season</Text>
        </View>
        <FreeRing pct={pct} size={44} label={`${freeN}/${total}\nfree`} />
      </View>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>
          {(series.genre || 'Drama')} · African originals
        </Text>
        <Text style={styles.title} numberOfLines={2}>{series.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          Season 1 · {total} episodes
          {series.match_pct ? ` · ${series.match_pct}% match` : ''}
        </Text>
        <TouchableOpacity style={styles.cta} onPress={onWatch} activeOpacity={0.88}>
          <Play size={13} color={EPISIO.emberDeep} fill={EPISIO.emberDeep} />
          <Text style={styles.ctaText}>Watch episode 1</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: {
    height: 210,
    borderRadius: EPISIO_RADIUS.hero,
    overflow: 'hidden',
    backgroundColor: EPISIO.ink700,
    justifyContent: 'flex-end',
    padding: 18,
  },
  top: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  chip: {
    backgroundColor: EPISIO.ember,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: EPISIO_RADIUS.pill,
  },
  chipText: {
    fontSize: 10,
    fontFamily: EPISIO_FONTS.uiSemi,
    color: EPISIO.emberDeep,
  },
  content: { zIndex: 2 },
  eyebrow: {
    fontSize: 11,
    fontFamily: EPISIO_FONTS.uiSemi,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: EPISIO.smoke,
  },
  title: {
    fontFamily: EPISIO_FONTS.displayItalic,
    fontSize: 26,
    color: EPISIO.paper,
    marginTop: 6,
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    color: EPISIO.smoke,
    fontFamily: EPISIO_FONTS.ui,
    marginBottom: 14,
  },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: EPISIO.ember,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: EPISIO_RADIUS.pill,
  },
  ctaText: {
    fontFamily: EPISIO_FONTS.uiSemi,
    fontSize: 14,
    color: EPISIO.emberDeep,
  },
});

export default HeroSeriesCard;
