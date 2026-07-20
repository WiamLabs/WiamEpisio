import React from 'react';
import { Image, StyleSheet } from 'react-native';

/** In-app WiamEpisio mark (navy background logo). */
const LogoBadge = ({ size = 30, style }) => (
  <Image
    source={require('../../../assets/episio-logo-app.png')}
    style={[
      styles.img,
      {
        width: size,
        height: size,
        borderRadius: Math.max(6, size * 0.18),
      },
      style,
    ]}
    resizeMode="cover"
  />
);

const styles = StyleSheet.create({
  img: {
    backgroundColor: 'transparent',
  },
});

export default LogoBadge;
