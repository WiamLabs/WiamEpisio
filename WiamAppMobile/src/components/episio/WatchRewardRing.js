/**
 * Small circular watch-reward ring — progress follows episode playhead.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS, FONTS } from '../../constants/theme';

const SIZE = 44;
const STROKE = 3.5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

const WatchRewardRing = ({ progress = 0, paused = false, granted = false }) => {
  const p = Math.max(0, Math.min(1, progress));
  const offset = C * (1 - (paused ? 0 : p));
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={STROKE}
          fill="transparent"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={paused ? COLORS.textFaint : COLORS.gold}
          strokeWidth={STROKE}
          fill="transparent"
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View style={styles.label}>
        <Text style={[styles.plus, paused && { color: COLORS.textFaint }]}>
          {granted ? '✓' : paused ? '—' : '+2'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center',
  },
  label: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
  },
  plus: { fontFamily: FONTS.extraBold, fontSize: 11, color: COLORS.gold },
});

export default WatchRewardRing;
