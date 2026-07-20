import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Standard app background for all non-premium screens.
 * Deep dark with a subtle gradient — no orbs, no premium effects.
 * Use PremiumBackground ONLY for the PremiumTabScreen.
 */
const AppBackground = ({ children, style, padTop = false }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={['#0a0a1a', '#0d0d22', '#08081a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={padTop ? { flex: 1, paddingTop: insets.top } : { flex: 1 }}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08081a',
  },
});

export default AppBackground;
