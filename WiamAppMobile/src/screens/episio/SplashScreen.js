import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { COLORS, FONTS } from '../../constants/theme';
import useAuthStore from '../../store/useAuthStore';
import { nextSignupGate } from '../../utils/authMembership';

/** Splash uses the transparent / black-plate logo on brand navy. */
const SplashScreen = ({ navigation }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  const load = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.4)).current;
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1300, useNativeDriver: true }),
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

    if (isLoading) return undefined;

    const t = setTimeout(() => {
      if (token && user) {
        const gate = nextSignupGate(user);
        if (gate === 'VerifyMethod') {
          navigation.replace('VerifyMethod', {
            fromRegister: true,
            email: user.email,
            dateOfBirth: user.date_of_birth,
            sticky: true,
          });
          return;
        }
        if (gate === 'AgeGate') {
          navigation.replace('AgeGate', {
            fromRegister: true,
            dateOfBirth: user.date_of_birth,
            sticky: true,
          });
          return;
        }
      }
      navigation.replace('Main');
    }, 1600);
    return () => clearTimeout(t);
  }, [navigation, pulse, load, pop, isLoading, token, user]);

  const loadX = load.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 200],
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <Animated.View style={{ transform: [{ scale: pop }, { scale: pulse }], zIndex: 1 }}>
        <Image
          source={require('../../../assets/episio-logo-splash.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      <Text style={styles.wordmark}>
        Wiam<Text style={{ color: COLORS.gold }}>Episio</Text>
      </Text>
      <Text style={styles.tagline}>African Vertical Drama</Text>

      <View style={styles.loader}>
        <Animated.View style={[styles.loaderFill, { transform: [{ translateX: loadX }] }]} />
      </View>

      <Text style={styles.footer}>© 2026 WiamEpisio</Text>
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
  logo: {
    width: 220,
    height: 220,
  },
  wordmark: {
    marginTop: 22,
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
