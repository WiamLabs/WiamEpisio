/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';

const PreparingScreen = ({ onComplete }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(onComplete, 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <Text style={styles.quote}>"Every story is a journey waiting to be traveled."</Text>
        <View style={styles.line} />
        <Text style={styles.brand}>WiamApp</Text>
        <ActivityIndicator color="#d4a843" size="large" style={{ marginTop: 40 }} />
        <Text style={styles.status}>Finding dramas for you...</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08081a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  quote: {
    color: '#e8e6e3',
    fontSize: 22,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
    lineHeight: 32,
  },
  line: {
    width: 40,
    height: 1,
    backgroundColor: '#d4a843',
    marginVertical: 20,
  },
  brand: {
    color: '#d4a843',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  status: {
    color: '#7D7D97',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 16,
  },
});

export default PreparingScreen;
