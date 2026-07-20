/**
 * WiamEpisio-Creator-Viewer-Switch.html — interstitial → StudioHome.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Clapperboard, Play } from 'lucide-react-native';
import useAuthStore from '../../store/useAuthStore';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const HOLD_MS = 1500;

const CreatorViewerSwitchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const accountName = user?.display_name
    || user?.username
    || user?.email
    || 'your account';
  const studioLabel = route.params?.studioName
    || user?.creator_name
    || user?.channel_name
    || 'WiamStudio';

  useEffect(() => {
    const t = setTimeout(() => {
      const target = route.params?.target || 'StudioHome';
      try {
        navigation.replace(target, route.params?.targetParams || {});
      } catch {
        navigation.navigate(target, route.params?.targetParams || {});
      }
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [navigation, route.params]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.glow} pointerEvents="none" />

      <View style={styles.icons}>
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
      </View>

      <Text style={styles.title}>Switching to WiamStudio</Text>
      <Text style={styles.sub}>
        Same account, creator mode. Your viewer profile stays exactly as you left it —{' '}
        <Text style={styles.em}>{studioLabel}</Text> is loading.
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
