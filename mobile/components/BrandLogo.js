// © 2026 WiamApp. Powered by WiamLabs
// components/BrandLogo.js — one shared logo for auth / onboarding screens
import React from 'react';
import { Image, StyleSheet } from 'react-native';

const LOGO = require('../assets/logo.png');

/** Default size is intentionally large — tiny logos look broken on navy screens. */
const SIZES = {
  sm: 72,
  md: 96,
  lg: 112,
  xl: 140,
};

/**
 * @param {'sm'|'md'|'lg'|'xl'|number} [size='md']
 * @param {object} [style]
 */
export default function BrandLogo({ size = 'md', style }) {
  const px = typeof size === 'number' ? size : (SIZES[size] || SIZES.md);
  return (
    <Image
      source={LOGO}
      style={[styles.logo, { width: px, height: px }, style]}
      resizeMode="contain"
      accessibilityLabel="WiamApp"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    marginBottom: 16,
  },
});
