/**
 * AdBanner — Adaptive Google AdMob banner ad component.
 *
 * Auto-hides for premium users. Includes a subtle "Remove Ads" link
 * that navigates to the Premium subscription screen.
 *
 * Props:
 *   placement  - 'home' | 'browse' | 'book_detail' | 'reader' | 'comments' | 'studio'
 *   bookId     - (optional) content ID for creator revenue attribution
 *   navigation - React Navigation prop (for "Remove Ads" link)
 *   compact    - (optional) smaller banner variant
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';
import { shouldShowAds, AD_UNIT_IDS, getAttribution } from '../../services/adConfig';

let BannerAd, BannerAdSize, TestIds;
try {
  const mobileAds = require('react-native-google-mobile-ads');
  BannerAd = mobileAds.BannerAd;
  BannerAdSize = mobileAds.BannerAdSize;
  TestIds = mobileAds.TestIds;
} catch (e) {
  // react-native-google-mobile-ads not available (web / Expo Go)
  BannerAd = null;
}

const AdBanner = ({ placement = 'home', bookId = null, navigation, compact = false }) => {
  const user = useAuthStore((s) => s.user);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  // Don't render ads for premium users or on web
  if (!shouldShowAds(user) || Platform.OS === 'web' || !BannerAd) {
    return null;
  }

  const attribution = getAttribution(placement, bookId);

  const handleAdLoaded = () => {
    setAdLoaded(true);
    // Log impression to backend
    logImpression('banner', placement, bookId);
  };

  const handleAdError = (error) => {
    setAdError(true);
    if (__DEV__) console.log('[AdBanner] error:', error);
  };

  const handleRemoveAds = () => {
    if (navigation) {
      navigation.navigate('PremiumScreen');
    }
  };

  if (adError) return null;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[styles.adWrapper, !adLoaded && styles.adPlaceholder]}>
        <BannerAd
          unitId={AD_UNIT_IDS.BANNER}
          size={compact ? BannerAdSize.BANNER : BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={handleAdLoaded}
          onAdFailedToLoad={handleAdError}
        />
      </View>
      {adLoaded && (
        <TouchableOpacity style={styles.removeAdsBtn} onPress={handleRemoveAds}>
          <Text style={styles.removeAdsText}>Remove Ads — Try Premium</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Fire-and-forget impression log to backend.
 */
function logImpression(adType, placement, bookId) {
  try {
    const { default: apiClient } = require('../../api/client');
    apiClient.post('/ads/impression', {
      ad_type: adType,
      placement,
      book_id: bookId || null,
    }).catch(() => {});
  } catch {}
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,168,67,0.08)',
  },
  containerCompact: {
    paddingVertical: 4,
    marginVertical: 4,
  },
  adWrapper: {
    overflow: 'hidden',
    borderRadius: RADIUS.sm,
  },
  adPlaceholder: {
    minHeight: 50,
    minWidth: 320,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: RADIUS.sm,
  },
  removeAdsBtn: {
    marginTop: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
  },
  removeAdsText: {
    fontSize: 10,
    color: COLORS.secondary,
    fontWeight: '600',
    opacity: 0.7,
  },
});

export default AdBanner;
