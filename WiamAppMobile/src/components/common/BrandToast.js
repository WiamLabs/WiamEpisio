import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Easing } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

/** Lightweight bottom toast that fades in/out — no system Alerts. */
const BrandToast = ({ message, duration = 2400, onClear }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!message) return;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 12,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClear && onClear();
      });
    }, duration);

    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <View style={styles.wrap}>
        <Animated.View
          style={[
            styles.toast,
            { opacity, transform: [{ translateY }] },
          ]}
        >
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 36,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  toast: {
    maxWidth: '92%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(20, 20, 40, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  text: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default BrandToast;
