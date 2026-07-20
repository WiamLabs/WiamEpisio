import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

/** Matches web `landing.html` l-bg + l-orb when variant is `landing` (softer, same hex feel). */
const PremiumBackground = ({ children, variant = 'default' }) => {
  const isLanding = variant === 'landing';
  const orbOpacity = isLanding ? 0.07 : 0.15;
  return (
    <View style={styles.container}>
      <View style={styles.base} />
      {isLanding ? (
        <>
          <LinearGradient
            colors={['rgba(212,168,67,0.07)', 'transparent']}
            start={{ x: 0.25, y: 0.15 }}
            end={{ x: 0.7, y: 0.6 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['transparent', 'rgba(124,58,237,0.05)']}
            start={{ x: 0.3, y: 0.4 }}
            end={{ x: 0.85, y: 0.95 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : null}
      <View style={[styles.orb, styles.orb1, { opacity: orbOpacity }]} />
      <View style={[styles.orb, styles.orb2, { opacity: orbOpacity }]} />
      <View style={[styles.grain, isLanding ? styles.grainLanding : styles.grainDefault]} />

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08081a',
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#08081a',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: width * 0.95,
    height: width * 0.95,
    backgroundColor: COLORS.secondary,
    top: -height * 0.08,
    left: -width * 0.12,
  },
  orb2: {
    width: width * 0.85,
    height: width * 0.85,
    backgroundColor: '#7c3aed',
    bottom: -height * 0.06,
    right: -width * 0.1,
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  grainDefault: {
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
  },
  grainLanding: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
});

export default PremiumBackground;
