/**
 * AdRewarded — Google AdMob rewarded ad hook.
 *
 * Usage:
 *   const { showRewardedAd, isReady } = useRewardedAd(bookId);
 *   // Call showRewardedAd(onReward) when user taps "Watch ad to unlock"
 *
 * Rules:
 *   - 100% user-initiated (user must tap a button)
 *   - Max 3 per day (persisted to AsyncStorage)
 *   - Grants 1 free chapter unlock on completion
 *   - Premium users never see this
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuthStore from '../../store/useAuthStore';
import { shouldShowAds, AD_UNIT_IDS, REWARDED_DAILY_LIMIT } from '../../services/adConfig';

let RewardedAd, RewardedAdEventType;
try {
  const mobileAds = require('react-native-google-mobile-ads');
  RewardedAd = mobileAds.RewardedAd;
  RewardedAdEventType = mobileAds.RewardedAdEventType;
} catch (e) {
  RewardedAd = null;
}

const DAILY_COUNT_KEY = '@wiamapp_rewarded_ad_count';
const DAILY_DATE_KEY = '@wiamapp_rewarded_ad_date';

/**
 * Hook that manages rewarded ad loading and display.
 * @param {number|null} bookId - Content ID for revenue attribution
 * @returns {{ showRewardedAd: (onReward: () => void) => Promise<boolean>, isReady: boolean, dailyRemaining: number }}
 */
export function useRewardedAd(bookId = null) {
  const user = useAuthStore((s) => s.user);
  const [isReady, setIsReady] = useState(false);
  const [dailyRemaining, setDailyRemaining] = useState(REWARDED_DAILY_LIMIT);
  const adRef = useRef(null);
  const onRewardRef = useRef(null);

  const canShow = shouldShowAds(user) && Platform.OS !== 'web' && !!RewardedAd;

  // Check daily count on mount
  useEffect(() => {
    checkDailyCount();
  }, []);

  // Load ad
  useEffect(() => {
    if (!canShow) return;

    const ad = RewardedAd.createForAdRequest(AD_UNIT_IDS.REWARDED, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setIsReady(true);
    });

    const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      // User watched the full ad — grant reward
      if (onRewardRef.current) {
        onRewardRef.current();
        onRewardRef.current = null;
      }
      incrementDailyCount();
      logImpression('rewarded', 'reader', bookId);
    });

    const unsubClosed = ad.addAdEventListener(RewardedAdEventType.CLOSED, () => {
      setIsReady(false);
      // Reload for next use
      ad.load();
    });

    const unsubError = ad.addAdEventListener(RewardedAdEventType.ERROR, (error) => {
      if (__DEV__) console.log('[AdRewarded] error:', error);
      setIsReady(false);
      setTimeout(() => { try { ad.load(); } catch {} }, 60000);
    });

    adRef.current = ad;
    ad.load();

    return () => {
      unsubLoaded();
      unsubEarned();
      unsubClosed();
      unsubError();
    };
  }, [canShow]);

  async function checkDailyCount() {
    try {
      const storedDate = await AsyncStorage.getItem(DAILY_DATE_KEY);
      const today = new Date().toDateString();
      if (storedDate !== today) {
        // New day — reset count
        await AsyncStorage.setItem(DAILY_DATE_KEY, today);
        await AsyncStorage.setItem(DAILY_COUNT_KEY, '0');
        setDailyRemaining(REWARDED_DAILY_LIMIT);
      } else {
        const count = parseInt(await AsyncStorage.getItem(DAILY_COUNT_KEY) || '0', 10);
        setDailyRemaining(Math.max(0, REWARDED_DAILY_LIMIT - count));
      }
    } catch {}
  }

  async function incrementDailyCount() {
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem(DAILY_DATE_KEY, today);
      const count = parseInt(await AsyncStorage.getItem(DAILY_COUNT_KEY) || '0', 10);
      const newCount = count + 1;
      await AsyncStorage.setItem(DAILY_COUNT_KEY, String(newCount));
      setDailyRemaining(Math.max(0, REWARDED_DAILY_LIMIT - newCount));
    } catch {}
  }

  /**
   * Show a rewarded ad. User must explicitly trigger this.
   * @param {() => void} onReward - Called when user earns the reward
   * @returns {Promise<boolean>} Whether the ad was shown
   */
  const showRewardedAd = useCallback(async (onReward) => {
    if (!canShow || !isReady || !adRef.current) return false;
    if (dailyRemaining <= 0) return false;

    onRewardRef.current = onReward;

    try {
      await adRef.current.show();
      return true;
    } catch (e) {
      if (__DEV__) console.log('[AdRewarded] show error:', e);
      return false;
    }
  }, [canShow, isReady, dailyRemaining]);

  return { showRewardedAd, isReady, dailyRemaining };
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

export default useRewardedAd;
