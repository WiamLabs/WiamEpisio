/**
 * Style: WiamEpisio-Splash-Returning.html
 * Returning user splash · auto navigate Main after 1.2s
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '../../constants/theme';
import LogoBadge from '../../components/episio/LogoBadge';
import useAuthStore from '../../store/useAuthStore';

const SplashReturningScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const spin = useRef(new Animated.Value(0)).current;

  const firstName = user?.first_name || user?.username || 'there';
  const initial = (firstName[0] || 'W').toUpperCase();
  const resumeSeries = user?.continue_series_title || "The Chief's Daughter";

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    const t = setTimeout(() => {
      navigation.replace('Main');
    }, 1200);
    return () => clearTimeout(t);
  }, [navigation, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.glowBg} />

      <View style={styles.wrap}>
        <LogoBadge size={88} />
        <Text style={styles.wordmark}>
          Wiam<Text style={{ color: COLORS.gold }}>Episio</Text>
        </Text>

        <View style={styles.welcomeCard}>
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.welcomeAvatar}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </LinearGradient>
          <Text style={styles.welcomeText}>
            Welcome back, <Text style={styles.welcomeBold}>{firstName}</Text>
          </Text>
        </View>

        <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
      </View>

      <Text style={[styles.resumeHint, { bottom: Math.max(insets.bottom, 50) }]}>
        Picking up where you left off in <Text style={styles.resumeBold}>{resumeSeries}</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  glowBg: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: 'rgba(212,160,23,0.18)',
  },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: {
    fontSize: 22,
    fontFamily: FONTS.extraBold,
    color: '#fff',
    marginTop: 20,
    marginBottom: 30,
    letterSpacing: -0.4,
  },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: COLORS.navyCard,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginBottom: 34,
  },
  welcomeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 13 },
  welcomeText: { fontSize: 12, color: '#E7E7F2', fontFamily: FONTS.semi },
  welcomeBold: { color: COLORS.gold, fontFamily: FONTS.bold },
  spinner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: 'rgba(212,160,23,0.2)',
    borderTopColor: COLORS.gold,
  },
  resumeHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textFaint,
    fontFamily: FONTS.regular,
  },
  resumeBold: { color: COLORS.textDim, fontFamily: FONTS.semi },
});

export default SplashReturningScreen;
