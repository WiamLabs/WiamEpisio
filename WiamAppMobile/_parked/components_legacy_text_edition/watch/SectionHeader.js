/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { EPISIO, EPISIO_FONTS } from '../../constants/episioTheme';

const SectionHeader = ({ title, actionLabel = 'See all', onAction, style }) => (
  <View style={[styles.row, style]}>
    <Text style={styles.title}>{title}</Text>
    {onAction ? (
      <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.seeAll}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontFamily: EPISIO_FONTS.uiSemi,
    color: EPISIO.paper,
  },
  seeAll: {
    fontSize: 12,
    fontFamily: EPISIO_FONTS.uiMedium,
    color: EPISIO.smoke,
  },
});

export default SectionHeader;
