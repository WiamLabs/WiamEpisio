/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { EPISIO, EPISIO_FONTS } from '../../constants/episioTheme';

/**
 * Free-episode / progress ring (design-system.css .ring).
 * pct: 0–100 fill of ember arc.
 */
const FreeRing = ({
  pct = 20,
  size = 44,
  label,
  children,
  style,
}) => {
  const stroke = Math.max(3, Math.round(size * 0.09));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c - (clamped / 100) * c;
  const inner = size - stroke * 2 - 2;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={EPISIO.ringTrack}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={EPISIO.ember}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[styles.inner, { width: inner, height: inner, borderRadius: inner / 2, top: (size - inner) / 2, left: (size - inner) / 2 }]}>
        {children || (
          <Text style={[styles.label, { fontSize: size > 50 ? 11 : 9 }]} numberOfLines={2}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  inner: {
    position: 'absolute',
    backgroundColor: EPISIO.ink800,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  label: {
    color: EPISIO.paper,
    fontFamily: EPISIO_FONTS.uiBold,
    textAlign: 'center',
    lineHeight: 12,
  },
});

export default FreeRing;
