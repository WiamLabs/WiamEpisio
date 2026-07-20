import React from 'react';
import { Image, StyleSheet } from 'react-native';

/**
 * In-app WiamEpisio mark — transparent / black-plate logo (same as splash).
 * Navy-plate asset stays for store icons only.
 */
const LogoBadge = ({ size = 52, style }) => (
  <Image
    source={require('../../../assets/episio-logo-splash.png')}
    style={[
      styles.img,
      {
        width: size,
        height: size,
      },
      style,
    ]}
    resizeMode="contain"
  />
);

const styles = StyleSheet.create({
  img: {
    backgroundColor: 'transparent',
  },
});

export default LogoBadge;
