/**
 * Exact layout: WiamEpisio-Unlock-Takeover.html
 * Unlock with coins, VIP, or watch ad for +10 coins (capped).
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft, Coins, Bookmark, List, Share2, Play,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import episodesApi from '../../api/episodes';
import studioEpisioApi from '../../api/studioEpisio';
import walletApi from '../../api/wallet';
import useAuthStore from '../../store/useAuthStore';
import { useRewardedAd } from '../../components/ads/AdRewarded';

const UnlockTakeoverScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const {
    episodeId,
    seriesId,
    unlockPrice = 10,
    episodeNumber,
    seriesTitle,
  } = route.params || {};
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [busy, setBusy] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [error, setError] = useState(null);
  const { showRewardedAd, isReady, dailyRemaining } = useRewardedAd(seriesId || null);

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  const unlock = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await episodesApi.unlockEpisode(episodeId);
      navigation.replace('Player', { episodeId, seriesId });
    } catch (e) {
      if (e?.needCoins) {
        navigation.navigate('BuyCoins');
        return;
      }
      setError(typeof e === 'string' ? e : (e?.message || 'Unlock failed'));
    } finally {
      setBusy(false);
    }
  };

  const watchAd = async () => {
    if (!isAuthenticated) {
      navigation.navigate('LoginRequiredSheet', {
        title: 'Sign up to earn coins',
        message: 'Watch an ad for free coins after you create a free account.',
        returnTo: 'UnlockTakeover',
        returnParams: route.params,
      });
      return;
    }
    if (Platform.OS === 'web' || !isReady) {
      Alert.alert(
        'Ads',
        'Rewarded ads are available in a production install of WiamEpisio.',
      );
      return;
    }
    setAdBusy(true);
    setError(null);
    try {
      const shown = await showRewardedAd(async () => {
        try {
          const res = await walletApi.claimAdCoins();
          if (!res?.ok) {
            setError(res?.error || 'Could not credit coins');
            return;
          }
          try {
            await episodesApi.unlockEpisode(episodeId);
            navigation.replace('Player', { episodeId, seriesId });
          } catch (e) {
            if (e?.needCoins) {
              Alert.alert('Coins added', `${res.coins || 10} coins added. Top up if you still need more.`);
              navigation.navigate('BuyCoins');
            } else {
              setError(e?.message || 'Unlock failed after ad');
            }
          }
        } catch (e) {
          setError(typeof e === 'string' ? e : (e?.message || 'Could not credit coins'));
        }
      });
      if (!shown) {
        Alert.alert('Ads', 'Could not show an ad right now. Try again later.');
      }
    } finally {
      setAdBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.navy, '#0d0d24', '#000']} style={StyleSheet.absoluteFill} />

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={close}>
          <ChevronLeft size={16} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.epIndicator}>
          {episodeNumber ? `EP ${episodeNumber}` : 'EP'}
        </Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.centerBlock}>
        <Text style={styles.message}>
          {"This episode requires unlocking\nbefore you can watch."}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.unlockBtn} onPress={unlock} disabled={busy} activeOpacity={0.9}>
          {busy ? (
            <ActivityIndicator color={COLORS.navy} />
          ) : (
            <>
              <Coins size={15} color={COLORS.navy} fill={COLORS.navy} />
              <Text style={styles.unlockText}>Unlock Now — {unlockPrice} coins</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.adBtn}
          onPress={watchAd}
          disabled={adBusy || busy}
          activeOpacity={0.9}
        >
          {adBusy ? (
            <ActivityIndicator color={COLORS.gold} />
          ) : (
            <>
              <Play size={15} color={COLORS.gold} fill={COLORS.gold} />
              <Text style={styles.adText}>Watch ad to continue · +10 coins</Text>
            </>
          )}
        </TouchableOpacity>
        {typeof dailyRemaining === 'number' && dailyRemaining < 3 ? (
          <Text style={styles.adLeft}>
            {dailyRemaining} ad reward{dailyRemaining === 1 ? '' : 's'} left today
          </Text>
        ) : null}

        <TouchableOpacity
          style={styles.vipHint}
          onPress={() => navigation.navigate('MembershipOfferModal', {
            price: 'From ₵35',
            discountLabel: 'VIP unlocks all',
          })}
        >
          <Text style={styles.vipHintText}>Or join VIP — watch without coins</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('BuyCoins')} style={{ marginTop: 10 }}>
          <Text style={styles.buyLink}>Buy coins</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.actionRail, { bottom: 170 + insets.bottom }]}>
        <TouchableOpacity
          style={styles.railItem}
          onPress={async () => {
            if (!isAuthenticated) {
              navigation.navigate('Login');
              return;
            }
            if (!seriesId) return;
            try {
              await studioEpisioApi.remind(seriesId);
              Alert.alert('Saved', 'Added to My List reminders.');
            } catch (e) {
              Alert.alert('My List', e?.message || 'Could not save');
            }
          }}
        >
          <View style={styles.railIcon}><Bookmark size={19} color="#fff" /></View>
          <Text style={styles.railLabel}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railItem} onPress={() => navigation.navigate('SeriesDetail', { seriesId })}>
          <View style={styles.railIcon}><List size={19} color="#fff" /></View>
          <Text style={styles.railLabel}>Episodes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.railItem}
          onPress={() => Share.share({
            message: `Watch ${seriesTitle || 'this series'} on WiamEpisio`,
          }).catch(() => {})}
        >
          <View style={styles.railIcon}><Share2 size={19} color="#fff" /></View>
          <Text style={styles.railLabel}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    position: 'absolute', left: 16, right: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', zIndex: 2,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  epIndicator: { color: '#fff', fontFamily: FONTS.bold, fontSize: 13 },
  centerBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  message: {
    color: '#fff', fontFamily: FONTS.semi, fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 22,
  },
  error: { color: COLORS.error, marginBottom: 12, textAlign: 'center', fontFamily: FONTS.medium },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.gold,
    paddingHorizontal: 22, paddingVertical: 14, borderRadius: 16, minWidth: 240, justifyContent: 'center',
  },
  unlockText: { fontFamily: FONTS.bold, color: COLORS.navy, fontSize: 14.5 },
  adBtn: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.gold, paddingHorizontal: 18, paddingVertical: 13,
    borderRadius: 16, minWidth: 240, justifyContent: 'center',
  },
  adText: { fontFamily: FONTS.bold, color: COLORS.gold, fontSize: 13.5 },
  adLeft: { marginTop: 8, fontSize: 11, color: COLORS.textFaint, fontFamily: FONTS.regular },
  vipHint: { marginTop: 16 },
  vipHintText: { color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 12.5 },
  buyLink: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 13 },
  actionRail: { position: 'absolute', right: 14, gap: 16 },
  railItem: { alignItems: 'center', gap: 4 },
  railIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  railLabel: { color: '#fff', fontSize: 10, fontFamily: FONTS.semi },
});

export default UnlockTakeoverScreen;
