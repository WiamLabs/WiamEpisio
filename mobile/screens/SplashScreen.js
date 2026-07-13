// © 2026 WiamApp. Powered by WiamLabs
// screens/SplashScreen.js
// Real logo with bounce jump animation + gold loading bar

import React, { useEffect, useRef } from 'react';
import {
  View, Text, Animated, StyleSheet,
  Dimensions, StatusBar,
} from 'react-native';
import { Colors } from '../constants/colors';
import BrandLogo from '../components/BrandLogo';

const { width } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const logoY       = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.7)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const barWidth    = useRef(new Animated.Value(0)).current;
  const barOpacity  = useRef(new Animated.Value(0)).current;

  // Continuous bounce loop
  const startBounce = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoY, {
          toValue: -18,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(logoY, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(logoY, {
          toValue: -10,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(logoY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  useEffect(() => {
    // Step 1 — Logo fades + scales in
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Step 2 — Start bounce
      startBounce();

      // Step 3 — Text fades in
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Step 4 — Loading bar fills
      Animated.timing(barOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();

      Animated.timing(barWidth, {
        toValue: width * 0.55,
        duration: 2000,
        useNativeDriver: false,
      }).start(() => {
        // Step 5 — Navigate to Landing
        setTimeout(() => {
          navigation.replace('Landing');
        }, 300);
      });
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navyDeep} />

      {/* Bouncing logo */}
      <Animated.View style={[
        styles.logoWrap,
        {
          opacity: logoOpacity,
          transform: [
            { scale: logoScale },
            { translateY: logoY },
          ],
        },
      ]}>
        <BrandLogo size="xl" style={{ marginBottom: 0 }} />
      </Animated.View>

      {/* App name + tagline */}
      <Animated.View style={[styles.textWrap, { opacity: textOpacity }]}>
        <Text style={styles.appName}>WiamApp</Text>
        <Text style={styles.tagline}>Africa's Trusted Service Marketplace</Text>
        <Text style={styles.poweredBy}>POWERED BY WIAMLABS</Text>
      </Animated.View>

      {/* Gold loading bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[
          styles.barFill,
          { width: barWidth, opacity: barOpacity },
        ]} />
      </View>

      {/* Copyright */}
      <Text style={styles.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navyDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },

  logoWrap: {
    marginBottom: 32,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
  logo: {
    width: 140,
    height: 140,
  },

  textWrap: {
    alignItems: 'center',
    marginBottom: 50,
  },
  appName: {
    color: Colors.white,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  tagline: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    letterSpacing: 0.3,
    marginBottom: 10,
    textAlign: 'center',
  },
  poweredBy: {
    color: Colors.gold,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '600',
  },

  barTrack: {
    width: width * 0.55,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'absolute',
    bottom: 90,
  },
  barFill: {
    height: 3,
    backgroundColor: Colors.gold,
    borderRadius: 2,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },

  copyright: {
    position: 'absolute',
    bottom: 30,
    color: 'rgba(212,160,23,0.3)',
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
