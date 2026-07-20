import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Coins, Sparkles } from 'lucide-react-native';
import PostOnboardingShell from '../../components/auth/PostOnboardingShell';
import useAuthStore from '../../store/useAuthStore';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const WelcomeBonusScreen = ({ navigation }) => {
  const { onboardingWelcomeCoins } = useAuthStore();
  const coins = Number(onboardingWelcomeCoins) || 50;

  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const next = () => navigation.replace('PostOnboardingPremium');

  return (
    <PostOnboardingShell
      step={1}
      eyebrow="Welcome to WiamApp"
      title="Your reading journey starts here"
      subtitle="A small gift to help you discover the stories you'll love."
      primaryLabel="Continue"
      onPrimary={next}
      onSecondary={next}
      icon={
        <Animated.View style={[styles.coinBadge, { transform: [{ scale }], opacity }]}>
          <View style={styles.coinInner}>
            <Coins size={36} color={COLORS.black} strokeWidth={2.5} />
          </View>
          <View style={styles.sparkle}>
            <Sparkles size={18} color={COLORS.secondary} />
          </View>
        </Animated.View>
      }
    >
      <Animated.View style={[styles.amountWrap, { opacity }]}>
        <Text style={styles.amount}>+{coins}</Text>
        <Text style={styles.amountLabel}>coins added to your wallet</Text>
      </Animated.View>

      <View style={styles.factCard}>
        <Text style={styles.factTitle}>What you can do with coins</Text>
        <Text style={styles.factLine}>• Unlock premium chapters</Text>
        <Text style={styles.factLine}>• Send tips to creators you love</Text>
        <Text style={styles.factLine}>• Earn more by reading every day</Text>
      </View>
    </PostOnboardingShell>
  );
};

const styles = StyleSheet.create({
  coinBadge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  coinInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkle: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.background,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  amountWrap: {
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  amount: {
    color: COLORS.secondary,
    fontFamily: FONTS.display,
    fontSize: 56,
    lineHeight: 60,
  },
  amountLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  factCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  factTitle: {
    color: COLORS.text,
    fontFamily: FONTS.displaySemi,
    fontSize: 16,
    marginBottom: 10,
  },
  factLine: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
});

export default WelcomeBonusScreen;
