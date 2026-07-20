/**
 * Temporary empty shell while all product screens are parked in
 * `_parked/`. Replace when Martin delivers HTML mockups.
 * Not a product feature screen — deck-clearing only.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../constants/theme';

const EpisioHoldScreen = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Text style={styles.brand}>WiamEpisio</Text>
      <Text style={styles.sub}>Screens cleared. Waiting for HTML mockups.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  brand: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  sub: {
    marginTop: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default EpisioHoldScreen;
