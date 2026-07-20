/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * WelcomeCreatorScreen — full-screen tour the moment a reader becomes a creator.
 *
 * The previous flow left newly-approved creators staring at an unchanged drawer
 * with no signal that anything had unlocked. Workstream J of the
 * deep_tracking_and_home_fix plan fixes that with three pieces:
 *
 *   1. This screen, navigated to immediately after the tiny gate succeeds AND
 *      from the typed `creator_welcome` push so backfilled legacy creators
 *      land here too.
 *   2. A persistent creator badge in the drawer + profile header (handled by
 *      `CustomDrawerContent` and `ProfileScreen` updates in the same push).
 *   3. The Studio drawer entry the moment role flips to creator — no app
 *      restart required (existing logic, kept stable).
 *
 * Animations are hand-rolled with Reanimated (already in deps); no new
 * packages added so EAS builds stay slim.
 */
import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  Sparkles,
  PenSquare,
  Wallet,
  Users,
  ChevronRight,
  X,
  CheckCircle2,
} from 'lucide-react-native';

import useAuthStore from '../../store/useAuthStore';

const { width: SCREEN_W } = Dimensions.get('window');

const SPARKLE_COUNT = 18;

function buildSparkles() {
  const out = [];
  for (let i = 0; i < SPARKLE_COUNT; i += 1) {
    out.push({
      id: i,
      x: Math.random() * SCREEN_W,
      y: 40 + Math.random() * 220,
      size: 4 + Math.random() * 8,
      delay: Math.floor(Math.random() * 1400),
      duration: 1600 + Math.floor(Math.random() * 1400),
      opacity: 0.4 + Math.random() * 0.55,
    });
  }
  return out;
}

function Sparkle({ x, y, size, delay, duration, opacity }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [duration, progress]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + progress.value * opacity,
    transform: [{ scale: 0.6 + progress.value * 0.6 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sparkle,
        animatedStyle,
        { left: x, top: y, width: size, height: size, borderRadius: size / 2, opacity: 0 },
      ]}
    />
  );
}

const FEATURES = [
  {
    Icon: PenSquare,
    title: 'WiamStudio is unlocked',
    body: 'Write chapters, manage drafts, and publish to readers in one tap.',
  },
  {
    Icon: Users,
    title: 'Build your following',
    body: 'Every reader who follows you sees your new chapters first.',
  },
  {
    Icon: Wallet,
    title: 'Earnings are live',
    body: 'Tips, ad share, and premium chapters all flow into your wallet.',
  },
];

export default function WelcomeCreatorScreen({ navigation, route }) {
  const user = useAuthStore((s) => s.user);
  const sparklesRef = useRef(buildSparkles());

  const penName = useMemo(() => {
    return (
      route?.params?.penName ||
      user?.creator_pen_name ||
      user?.pen_name ||
      user?.first_name ||
      'Creator'
    );
  }, [route?.params?.penName, user]);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const goStudio = () => {
    Haptics.selectionAsync().catch(() => {});
    navigation.replace('Studio');
  };

  const goProfile = () => {
    Haptics.selectionAsync().catch(() => {});
    navigation.replace('Main', { screen: 'Profile' });
  };

  const dismiss = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Main');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={['#0e0a25', '#1a1140', '#08081a']}
        style={StyleSheet.absoluteFill}
      />

      {sparklesRef.current.map((s) => (
        <Sparkle key={s.id} {...s} />
      ))}

      <View style={styles.topRow}>
        <TouchableOpacity onPress={dismiss} style={styles.closeBtn} hitSlop={12}>
          <X size={22} color="#e8e6e3" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(420)} style={styles.heroIconWrap}>
          <LinearGradient
            colors={['#d4a843', '#b8860b']}
            style={styles.heroIconBg}
          >
            <Sparkles size={36} color="#000" />
          </LinearGradient>
        </Animated.View>

        <Animated.Text entering={FadeInUp.duration(520).delay(120)} style={styles.eyebrow}>
          You're in.
        </Animated.Text>
        <Animated.Text entering={FadeInUp.duration(520).delay(180)} style={styles.heroTitle}>
          Welcome, {penName}.
        </Animated.Text>
        <Animated.Text entering={FadeInUp.duration(520).delay(240)} style={styles.heroSubtitle}>
          You are now a WiamApp Creator. Three new tools just appeared in your account — here's what they do.
        </Animated.Text>

        <View style={styles.featureList}>
          {FEATURES.map(({ Icon, title, body }, idx) => (
            <Animated.View
              key={title}
              entering={FadeInDown.duration(460).delay(340 + idx * 110)}
              style={styles.featureCard}
            >
              <View style={styles.featureIconWrap}>
                <Icon size={20} color="#d4a843" />
              </View>
              <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureCopy}>{body}</Text>
              </View>
              <CheckCircle2 size={20} color="#4ade80" />
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInDown.duration(500).delay(720)}>
          <TouchableOpacity onPress={goStudio} activeOpacity={0.9}>
            <LinearGradient colors={['#d4a843', '#b8860b']} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Open WiamStudio</Text>
              <ChevronRight size={20} color="#000" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(800)}>
          <TouchableOpacity onPress={goProfile} style={styles.secondaryBtn} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>See my creator profile</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.Text entering={FadeInDown.duration(500).delay(880)} style={styles.footnote}>
          Tip: pull down on the Home screen to refresh your follower count once readers find you.
        </Animated.Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08081a' },

  sparkle: {
    position: 'absolute',
    backgroundColor: '#d4a843',
    shadowColor: '#d4a843',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scroll: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 56,
  },

  heroIconWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  heroIconBg: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d4a843',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },

  eyebrow: {
    color: '#d4a843',
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 1.4,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    textAlign: 'center',
    fontFamily: 'PlayfairDisplay_700Bold',
    fontWeight: '700',
    marginBottom: 12,
  },
  heroSubtitle: {
    color: '#cfcfd8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 28,
  },

  featureList: { gap: 12, marginBottom: 28 },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.18)',
    borderRadius: 16,
    padding: 14,
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(212,168,67,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureBody: { flex: 1 },
  featureTitle: { color: '#e8e6e3', fontSize: 14.5, fontWeight: '700', marginBottom: 3 },
  featureCopy: { color: '#9a9aa8', fontSize: 12.5, lineHeight: 18 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 28,
    shadowColor: '#d4a843',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  secondaryBtn: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryBtnText: { color: '#e8e6e3', fontSize: 15, fontWeight: '600' },

  footnote: {
    color: '#6e6e78',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 22,
    lineHeight: 18,
  },
});
