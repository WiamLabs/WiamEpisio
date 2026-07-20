/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Play, Lock, Coins } from 'lucide-react-native';
import { EPISIO, EPISIO_FONTS } from '../../constants/episioTheme';

const EpisodeRow = ({ episode, onPress }) => {
  const locked = !!episode?.locked;
  const free = !!episode?.is_free_tier || (!locked && (episode?.episode_number || 0) <= 5);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.thumb}>
        {locked ? (
          <Lock size={16} color={EPISIO.smoke} />
        ) : (
          <Play size={16} color={EPISIO.smoke} fill={EPISIO.smoke} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {episode?.title || `Episode ${episode?.episode_number}`}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          Ep {episode?.episode_number}
          {episode?.duration_seconds
            ? ` · ${Math.round(episode.duration_seconds / 60)} min`
            : ''}
        </Text>
      </View>
      {locked ? (
        <View style={styles.locked}>
          <Coins size={12} color={EPISIO.smoke} />
          <Text style={styles.lockedText}>{episode?.unlock_price_coins || 10}</Text>
        </View>
      ) : (
        <Text style={[styles.status, free && styles.free]}>
          {free ? 'Free' : 'Unlocked'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: EPISIO.borderRow,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: EPISIO.ink700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: {
    fontSize: 13,
    fontFamily: EPISIO_FONTS.uiSemi,
    color: EPISIO.paper,
  },
  meta: {
    fontSize: 11,
    color: EPISIO.smokeDim,
    marginTop: 2,
    fontFamily: EPISIO_FONTS.ui,
  },
  status: {
    fontSize: 11,
    fontFamily: EPISIO_FONTS.uiBold,
    color: EPISIO.smoke,
  },
  free: { color: EPISIO.ember },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockedText: {
    fontSize: 11,
    fontFamily: EPISIO_FONTS.uiBold,
    color: EPISIO.smoke,
  },
});

export default EpisodeRow;
