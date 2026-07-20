import React from 'react';
import { Image } from 'expo-image';

/**
 * Drop-in replacement for RN Image that uses expo-image for:
 * - Aggressive disk + memory caching
 * - Smooth cross-fade transition (no long placeholder flash)
 * - Better performance for remote images
 */
const CachedImage = ({ source, style, ...rest }) => {
  const uri = typeof source === 'object' && source.uri ? source.uri : null;

  if (!uri) {
    // Local asset — pass through as-is
    return <Image source={source} style={style} {...rest} />;
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      cachePolicy="disk"
      transition={200}
      contentFit="cover"
      recyclingKey={uri}
      {...rest}
    />
  );
};

export default CachedImage;
