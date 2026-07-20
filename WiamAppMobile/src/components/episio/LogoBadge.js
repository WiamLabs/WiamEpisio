import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';

/** Gold clipped "W" mark from HTML splash/home. */
const LogoBadge = ({ size = 30 }) => (
  <LinearGradient
    colors={[COLORS.gold, COLORS.goldDark]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={[
      styles.badge,
      {
        width: size,
        height: size,
        borderRadius: size * 0.3,
      },
    ]}
  >
    <Text style={[styles.letter, { fontSize: size * 0.47 }]}>W</Text>
  </LinearGradient>
);

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: FONTS.extraBold,
    color: COLORS.navy,
  },
});

export default LogoBadge;
