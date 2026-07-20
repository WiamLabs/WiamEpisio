/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { EPISIO, EPISIO_FONTS, EPISIO_RADIUS, EPISIO_SPACE } from '../../constants/episioTheme';

const GenreChips = ({ chips = [], active = 'For you', onSelect }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.row}
  >
    {chips.map((chip) => {
      const isActive = chip === active;
      return (
        <TouchableOpacity
          key={chip}
          style={[styles.chip, isActive && styles.chipActive]}
          onPress={() => onSelect?.(chip)}
          activeOpacity={0.85}
        >
          <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{chip}</Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  row: { gap: 10, paddingVertical: 2 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: EPISIO_RADIUS.pill,
    backgroundColor: EPISIO.ink700,
  },
  chipActive: { backgroundColor: EPISIO.ember },
  chipText: {
    fontSize: 12,
    fontFamily: EPISIO_FONTS.uiSemi,
    color: EPISIO.smoke,
  },
  chipTextActive: { color: EPISIO.emberDeep },
});

export default GenreChips;
