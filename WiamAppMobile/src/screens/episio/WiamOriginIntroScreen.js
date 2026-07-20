/**
 * WiamEpisio-Wiam-Origin-Intro.html — fullscreen Origin splash, auto-navigate.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Volume2 } from 'lucide-react-native';
import LogoBadge from '../../components/episio/LogoBadge';
import { COLORS, FONTS } from '../../constants/theme';

const HOLD_MS = 2500;

const WiamOriginIntroScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const t = setTimeout(() => {
      const next = route.params?.next;
      if (typeof next === 'string') {
        navigation.replace(next, route.params?.nextParams || {});
        return;
      }
      if (next && typeof next === 'object' && next.screen) {
        navigation.replace(next.screen, next.params || {});
        return;
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main', params: { screen: 'Home' } }],
      });
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [navigation, route.params]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={['rgba(212,160,23,0.18)', 'transparent', 'transparent']}
        style={styles.glow}
        pointerEvents="none"
      />
      <View style={styles.rays} pointerEvents="none">
        {[0, 45, 90, 135].map((deg) => (
          <View
            key={deg}
            style={[styles.ray, { transform: [{ rotate: `${deg}deg` }] }]}
          />
        ))}
      </View>

      <View style={styles.center}>
        <LogoBadge size={96} />
        <Text style={styles.wordmark}>WIAM ORIGIN</Text>
        <Text style={styles.tag}>An Original Series</Text>
      </View>

      <View style={styles.footer}>
        <Volume2 size={14} color={COLORS.textFaint} />
        <Text style={styles.sig}>Signature sound plays on load</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    top: 40,
    width: 420,
    height: 420,
    borderRadius: 210,
  },
  rays: {
    position: 'absolute',
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.2,
  },
  ray: {
    position: 'absolute',
    width: 2,
    height: 260,
    backgroundColor: COLORS.gold,
  },
  center: {
    alignItems: 'center',
    gap: 18,
  },
  wordmark: {
    fontFamily: FONTS.extraBold,
    fontSize: 22,
    color: COLORS.gold,
    letterSpacing: 6,
    marginTop: 8,
  },
  tag: {
    fontFamily: FONTS.semi,
    fontSize: 12,
    color: COLORS.textDim,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sig: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textFaint,
  },
});

export default WiamOriginIntroScreen;
