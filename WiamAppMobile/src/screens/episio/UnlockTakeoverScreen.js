/**
 * Exact layout: WiamEpisio-Unlock-Takeover.html
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft, Coins, Bookmark, List, Share2, Crown,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import episodesApi from '../../api/episodes';
import studioEpisioApi from '../../api/studioEpisio';
import useAuthStore from '../../store/useAuthStore';

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
    synopsis,
  } = route.params || {};
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1a1030', '#0d0d24', '#000']} style={StyleSheet.absoluteFill} />

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
        <TouchableOpacity style={styles.unlockBtn} onPress={unlock} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={COLORS.navy} />
          ) : (
            <>
              <Coins size={15} color={COLORS.navy} fill={COLORS.navy} />
              <Text style={styles.unlockText}>Unlock Now — {unlockPrice} coins</Text>
            </>
          )}
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
          onPress={() => Share.share({ message: seriesTitle || 'WiamEpisio' }).catch(() => {})}
        >
          <View style={styles.railIcon}><Share2 size={19} color="#fff" /></View>
          <Text style={styles.railLabel}>Share</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.bottomInfo, { bottom: 78 + insets.bottom }]}>
        <Text style={styles.seriesTitle} numberOfLines={1}>{seriesTitle || 'Series'}</Text>
        <Text style={styles.epCaption} numberOfLines={2}>
          {synopsis || 'Unlock this episode to keep watching the story.'}
        </Text>
      </View>

      <View style={[styles.bottombar, { paddingBottom: Math.max(insets.bottom, 10), height: 60 + insets.bottom }]}>
        <TouchableOpacity
          style={styles.memberPill}
          onPress={() => navigation.navigate('Member')}
        >
          <Crown size={14} color={COLORS.gold} fill={COLORS.gold} />
          <Text style={styles.memberText}>Join Membership</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate(isAuthenticated ? 'BuyCoins' : 'Login')}>
          <Text style={styles.downloadText}>
            {isAuthenticated ? 'Need coins?' : 'Sign in'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute', left: 0, right: 0, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 3, opacity: 0.9,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  epIndicator: { fontSize: 12.5, color: '#fff', fontFamily: FONTS.semi },
  centerBlock: {
    position: 'absolute', top: '42%', left: 0, right: 0,
    alignItems: 'center', paddingHorizontal: 30, zIndex: 3,
  },
  message: {
    fontSize: 15, color: '#fff', fontFamily: FONTS.semi, lineHeight: 22,
    textAlign: 'center', marginBottom: 22,
  },
  error: { color: '#EF4444', marginBottom: 12, fontFamily: FONTS.medium, fontSize: 13, textAlign: 'center' },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 40, paddingVertical: 15, borderRadius: 16, backgroundColor: COLORS.gold,
  },
  unlockText: { fontSize: 14.5, fontFamily: FONTS.extraBold, color: COLORS.navy },
  actionRail: {
    position: 'absolute', right: 12, alignItems: 'center', gap: 20, zIndex: 3, opacity: 0.85,
  },
  railItem: { alignItems: 'center', gap: 4 },
  railIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  railLabel: { fontSize: 10, color: '#fff', fontFamily: FONTS.semi },
  bottomInfo: { position: 'absolute', left: 18, right: 80, zIndex: 3 },
  seriesTitle: { fontSize: 14, fontFamily: FONTS.bold, color: '#fff', marginBottom: 4 },
  epCaption: { fontSize: 11.5, color: '#C9C9DE', lineHeight: 16, fontFamily: FONTS.regular },
  bottombar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(8,8,26,0.85)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 12,
  },
  memberPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberText: { fontSize: 12.5, color: COLORS.gold, fontFamily: FONTS.bold },
  downloadText: { fontSize: 12.5, color: '#7D7D97', fontFamily: FONTS.semi },
});

export default UnlockTakeoverScreen;
