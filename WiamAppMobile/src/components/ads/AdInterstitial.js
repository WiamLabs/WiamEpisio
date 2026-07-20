/**
 * AdInterstitial — Google AdMob interstitial ad hook.
 *
 * Usage:
 *   const { showInterstitial, isReady } = useInterstitialAd(bookId);
 *   // Call showInterstitial() between chapter transitions
 *
 * Rules:
 *   - Max 1 per 4 minutes (INTERSTITIAL_COOLDOWN_SEC)
 *   - Only between chapters, every 3rd chapter
 *   - Skip first 2 chapters of any book
 *   - Premium users never see interstitials
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import useAuthStore from '../../store/useAuthStore';
import {
  shouldShowAds,
  AD_UNIT_IDS,
  INTERSTITIAL_COOLDOWN_SEC,
  INTERSTITIAL_EVERY_N_CHAPTERS,
  INTERSTITIAL_SKIP_FIRST_CHAPTERS,
} from '../../services/adConfig';

let InterstitialAd, AdEventType;
try {
  const mobileAds = require('react-native-google-mobile-ads');
  InterstitialAd = mobileAds.InterstitialAd;
  AdEventType = mobileAds.AdEventType;
} catch (e) {
  InterstitialAd = null;
}

/**
 * Hook that manages interstitial ad loading, frequency capping, and display.
 * @param {number|null} bookId - Content ID for revenue attribution
 * @returns {{ showInterstitial: (chapterNum: number) => boolean, isReady: boolean }}
 */
export function useInterstitialAd(bookId = null) {
  const user = useAuthStore((s) => s.user);
  const [isReady, setIsReady] = useState(false);
  const adRef = useRef(null);
  const lastShownRef = useRef(0);
  const chaptersShownRef = useRef(0);

  const canShow = shouldShowAds(user) && Platform.OS !== 'web' && !!InterstitialAd;

  // Load ad
  useEffect(() => {
    if (!canShow) return;

    const ad = InterstitialAd.createForAdRequest(AD_UNIT_IDS.INTERSTITIAL, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      setIsReady(true);
    });

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setIsReady(false);
      // Reload for next use
      ad.load();
    });

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      if (__DEV__) console.log('[AdInterstitial] error:', error);
      setIsReady(false);
      // Retry after 60s
      setTimeout(() => { try { ad.load(); } catch {} }, 60000);
    });

    adRef.current = ad;
    ad.load();

    return () => {
      unsubLoaded();
      unsubClosed();
      unsubError();
    };
  }, [canShow]);

  /**
   * Attempt to show an interstitial ad.
   * Respects frequency caps and chapter rules.
   * @param {number} chapterNum - Current chapter number (1-based)
   * @returns {boolean} Whether the ad was shown
   */
  const showInterstitial = useCallback((chapterNum) => {
    if (!canShow || !isReady || !adRef.current) return false;

    // Rule: Skip first N chapters
    if (chapterNum <= INTERSTITIAL_SKIP_FIRST_CHAPTERS) return false;

    // Rule: Only every Nth chapter
    chaptersShownRef.current += 1;
    if (chaptersShownRef.current % INTERSTITIAL_EVERY_N_CHAPTERS !== 0) return false;

    // Rule: Cooldown period
    const now = Date.now();
    const elapsed = (now - lastShownRef.current) / 1000;
    if (lastShownRef.current > 0 && elapsed < INTERSTITIAL_COOLDOWN_SEC) return false;

    // Show the ad
    try {
      adRef.current.show();
      lastShownRef.current = now;
      logImpression('interstitial', 'reader', bookId);
      return true;
    } catch (e) {
      if (__DEV__) console.log('[AdInterstitial] show error:', e);
      return false;
    }
  }, [canShow, isReady, bookId]);

  return { showInterstitial, isReady };
}

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

export default useInterstitialAd;
