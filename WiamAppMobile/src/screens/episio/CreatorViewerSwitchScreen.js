/**
 * WiamEpisio-Creator-Viewer-Switch.html — interstitial between Watcher ↔ Creator mood.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Clapperboard, Play } from 'lucide-react-native';
import useAuthStore from '../../store/useAuthStore';
import useAppModeStore from '../../store/useAppModeStore';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const HOLD_MS = 1400;

const CreatorViewerSwitchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setMode = useAppModeStore((s) => s.setMode);

  const direction = route.params?.direction === 'watcher' ? 'watcher' : 'creator';
  const toCreator = direction === 'creator';

  const accountName = user?.display_name
    || user?.username
    || user?.email
    || 'your account';
  const studioLabel = route.params?.studioName
    || user?.creator_name
    || user?.channel_name
    || user?.display_name
    || 'WiamStudio';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await setMode(toCreator ? 'creator' : 'watcher');
      await new Promise((r) => setTimeout(r, HOLD_MS));
      if (cancelled) return;
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        }),
      );
    })();
    return () => { cancelled = true; };
  }, [navigation, setMode, toCreator]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.glow} pointerEvents="none" />

      <View style={styles.icons}>
        {toCreator ? (
          <>
            <View style={[styles.iconCircle, styles.iconDim]}>
              <Play size={22} color={COLORS.textFaint} />
            </View>
            <Text style={styles.arrow}>→</Text>
            <LinearGradient
              colors={[COLORS.gold, COLORS.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <Clapperboard size={22} color={COLORS.navy} />
            </LinearGradient>
          </>
        ) : (
          <>
            <LinearGradient
              colors={[COLORS.gold, COLORS.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.iconCircle, { opacity: 0.55 }]}
            >
              <Clapperboard size={22} color={COLORS.navy} />
            </LinearGradient>
            <Text style={styles.arrow}>→</Text>
            <View style={[styles.iconCircle, styles.iconDim, { borderColor: COLORS.gold }]}>
              <Play size={22} color={COLORS.gold} />
            </View>
          </>
        )}
      </View>

      <Text style={styles.title}>
        {toCreator ? 'Switching to WiamStudio' : 'Switching to Watcher Mood'}
      </Text>
      <Text style={styles.sub}>
        {toCreator ? (
          <>
            Same account, creator mode. Your viewer profile stays exactly as you left it —{' '}
            <Text style={styles.em}>{studioLabel}</Text> is loading.
          </>
        ) : (
          <>
            Back to watching. Your Studio series stay saved —{' '}
            <Text style={styles.em}>{studioLabel}</Text> waits when you return.
          </>
        )}
      </Text>

      <ActivityIndicator color={COLORS.gold} style={{ marginTop: 28 }} />

      <View style={styles.chip}>
        <View style={styles.dot} />
        <Text style={styles.chipText}>Signed in as {accountName}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  glow: {
    position: 'absolute',
    top: 80,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(212,160,23,0.12)',
  },
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDim: {
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
  },
  arrow: {
    fontFamily: FONTS.extraBold,
    fontSize: 20,
    color: COLORS.textFaint,
  },
  title: {
    fontFamily: FONTS.extraBold,
    fontSize: 18,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textDim,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  em: {
    fontFamily: FONTS.semi,
    color: COLORS.gold,
  },
  chip: {
    position: 'absolute',
    bottom: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  chipText: {
    fontFamily: FONTS.semi,
    fontSize: 12,
    color: COLORS.textDim,
  },
});

export default CreatorViewerSwitchScreen;
