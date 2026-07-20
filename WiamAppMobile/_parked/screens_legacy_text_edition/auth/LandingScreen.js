/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * Landing / auth entry — watch-first (no novel marketing).
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Clapperboard, Coins, Mail } from 'lucide-react-native';
import useAuthStore from '../../store/useAuthStore';
import { GoogleSignInSlot } from '../../services/googleAuth';
import BrandToast from '../../components/common/BrandToast';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const LandingScreen = ({ navigation }) => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [toast, setToast] = useState('');

  const onGoogleSuccess = async (data) => {
    if (data?.token) await setAuth(data.user, data.token);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.wordmark}>WiamApp</Text>

        <View style={styles.hero}>
          <LinearGradient
            colors={[COLORS.gold, COLORS.goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroIcon}
          >
            <Clapperboard size={28} color={COLORS.navy} />
          </LinearGradient>
          <Text style={styles.heroTitle}>Watch. Binge. Belong.</Text>
          <Text style={styles.heroSub}>
            Short dramas from African creators. Episodes 1–5 free. Unlock more with WiamCoins.
          </Text>
        </View>

        <View style={styles.pills}>
          <View style={styles.pill}>
            <Clapperboard size={14} color={COLORS.gold} />
            <Text style={styles.pillText}>Vertical episodes</Text>
          </View>
          <View style={styles.pill}>
            <Coins size={14} color={COLORS.gold} />
            <Text style={styles.pillText}>Free first 5</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primary}
          onPress={() => navigation.getParent()?.goBack?.() || navigation.navigate('Register')}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={[COLORS.gold, COLORS.goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryGrad}
          >
            <Text style={styles.primaryText}>Sign up · get coins</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondary}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Mail size={16} color={COLORS.text} />
          <Text style={styles.secondaryText}>Sign in with email</Text>
        </TouchableOpacity>

        <GoogleSignInSlot
          onSuccess={onGoogleSuccess}
          onError={(msg) => setToast(msg || 'Google sign-in failed.')}
        />

        <TouchableOpacity
          style={styles.guest}
          onPress={() => navigation.getParent()?.goBack?.()}
        >
          <Text style={styles.guestText}>Continue watching as guest</Text>
        </TouchableOpacity>
      </ScrollView>
      <BrandToast message={toast} onHide={() => setToast('')} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.md, flexGrow: 1 },
  wordmark: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
  hero: { alignItems: 'center', marginBottom: SPACING.lg },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textDim,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  pills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: SPACING.xl,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
  },
  pillText: { fontFamily: FONTS.semi, fontSize: 12, color: COLORS.text },
  primary: { borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 12 },
  primaryGrad: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: RADIUS.full,
  },
  primaryText: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.navy },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    marginBottom: 12,
  },
  secondaryText: { fontFamily: FONTS.semi, fontSize: 14, color: COLORS.text },
  guest: { alignItems: 'center', marginTop: SPACING.lg, padding: 12 },
  guestText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textDim },
});

export default LandingScreen;
