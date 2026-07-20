import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { COLORS, FONTS } from '../../constants/theme';
import LogoBadge from '../../components/episio/LogoBadge';

const SplashScreen = ({ navigation }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  const load = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 1300, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1300, useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.timing(load, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ).start();

    const t = setTimeout(() => {
      navigation.replace('Main');
    }, 1600);
    return () => clearTimeout(t);
  }, [navigation, pulse, load, pop]);

  const loadX = load.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 200],
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(212,160,23,0.08)', 'transparent', 'rgba(212,160,23,0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.film, { left: 0 }]} />
      <View style={[styles.film, { right: 0 }]} />

      <Animated.View style={[styles.glow, { transform: [{ scale: pulse }] }]} />

      <Animated.View style={{ transform: [{ scale: pop }], zIndex: 1 }}>
        <LogoBadge size={100} />
      </Animated.View>
      <Text style={styles.wordmark}>
        Wiam<Text style={{ color: COLORS.gold }}>Episio</Text>
      </Text>
      <Text style={styles.tagline}>African Vertical Drama</Text>

      <View style={styles.loader}>
        <Animated.View style={[styles.loaderFill, { transform: [{ translateX: loadX }] }]} />
      </View>

      <Text style={styles.footer}>© 2026 WiamEpisio · Powered by WiamLabs</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  film: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  glow: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(212,160,23,0.14)',
  },
  wordmark: {
    marginTop: 24,
    fontSize: 28,
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.5,
    zIndex: 1,
  },
  tagline: {
    marginTop: 8,
    fontSize: 12.5,
    fontFamily: FONTS.medium,
    color: '#8B8BA3',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    zIndex: 1,
  },
  loader: {
    marginTop: 44,
    width: 150,
    height: 3,
    backgroundColor: COLORS.navyLine,
    borderRadius: 999,
    overflow: 'hidden',
    zIndex: 1,
  },
  loaderFill: {
    height: '100%',
    width: '35%',
    borderRadius: 999,
    backgroundColor: COLORS.gold,
  },
  footer: {
    position: 'absolute',
    bottom: 34,
    fontSize: 10,
    color: '#3A3A56',
    fontFamily: FONTS.regular,
  },
});

export default SplashScreen;
