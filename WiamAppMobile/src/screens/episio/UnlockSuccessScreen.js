/**
 * WiamEpisio-Unlock-Success.html — toast-style unlock confirmation over dimmed player.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Check, Play } from 'lucide-react-native';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';

const UnlockSuccessScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const {
    episodeId,
    seriesId,
    episodeNumber,
    seriesTitle,
    episodeCaption,
    coinsSpent,
    coinsLeft,
    autoResume = true,
  } = route.params || {};

  const continueWatching = () => {
    if (episodeId) {
      navigation.replace('Player', { episodeId, seriesId });
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main');
  };

  useEffect(() => {
    if (!autoResume || !episodeId) return undefined;
    const t = setTimeout(() => {
      navigation.replace('Player', { episodeId, seriesId });
    }, 2200);
    return () => clearTimeout(t);
  }, [autoResume, episodeId, seriesId, navigation]);

  const spent = coinsSpent != null ? Number(coinsSpent) : null;
  const left = coinsLeft != null ? Number(coinsLeft) : null;
  const toastSub = [
    spent != null && !Number.isNaN(spent) ? `${spent} coins spent` : null,
    left != null && !Number.isNaN(left) ? `${left} coins left` : null,
  ].filter(Boolean).join(' · ') || 'Your episode is ready to watch';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.videoBg} pointerEvents="none" />

      <View style={styles.toast}>
        <View style={styles.toastIcon}>
          <Check size={14} color={COLORS.navy} strokeWidth={3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.toastTitle}>Episode unlocked</Text>
          <Text style={styles.toastSub}>{toastSub}</Text>
        </View>
      </View>

      <View style={styles.centerBlock}>
        <TouchableOpacity style={styles.playRing} onPress={continueWatching} activeOpacity={0.9}>
          <Play size={24} color={COLORS.navy} fill={COLORS.navy} />
        </TouchableOpacity>
        <Text style={styles.resumeText}>Resuming playback…</Text>
        <Text style={styles.resumeSub}>
          {episodeNumber != null
            ? `EP ${episodeNumber} starts in a moment`
            : 'Your episode starts in a moment'}
        </Text>
      </View>

      <View style={styles.bottomInfo}>
        {seriesTitle ? <Text style={styles.seriesTitle}>{seriesTitle}</Text> : null}
        {episodeCaption ? (
          <Text style={styles.epCaption} numberOfLines={2}>{episodeCaption}</Text>
        ) : (
          <Text style={styles.epCaption}>
            {episodeNumber != null
              ? `Episode ${episodeNumber} is unlocked and ready.`
              : 'Continue watching from where you left off.'}
          </Text>
        )}
        <EpisioGoldButton
          label="Continue"
          onPress={continueWatching}
          style={{ marginTop: 18 }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 20,
  },
  videoBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d0d24',
    opacity: 0.85,
  },
  toast: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(18,18,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(59,178,115,0.35)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 72,
    maxWidth: 320,
    zIndex: 5,
  },
  toastIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3BB273',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12.5,
    color: '#fff',
  },
  toastSub: {
    fontFamily: FONTS.regular,
    fontSize: 10.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(212,160,23,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  resumeText: {
    fontFamily: FONTS.semi,
    fontSize: 12.5,
    color: '#fff',
  },
  resumeSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  bottomInfo: {
    paddingBottom: 8,
  },
  seriesTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  epCaption: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

export default UnlockSuccessScreen;
