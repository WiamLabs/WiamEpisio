import React from 'react';
import { Image, StyleSheet } from 'react-native';

/**
 * In-app WiamEpisio mark — transparent shield (no black plate).
 * Store icons keep the separate navy-plate asset.
 */
const LogoBadge = ({ size = 64, style }) => (
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
