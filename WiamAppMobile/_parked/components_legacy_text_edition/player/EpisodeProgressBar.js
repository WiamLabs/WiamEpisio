/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

/** Thin scrub/progress bar for episode watch position. */
const EpisodeProgressBar = ({ current = 0, duration = 0 }) => {
  const pct = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 3,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
  },
});

export default EpisodeProgressBar;
