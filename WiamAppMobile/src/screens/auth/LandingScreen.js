import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BookOpen,
  Sparkles,
  Coins,
  Mail,
} from 'lucide-react-native';
import CachedImage from '../../components/common/CachedImage';
import booksApi from '../../api/books';
import useAuthStore from '../../store/useAuthStore';
import { GoogleSignInSlot } from '../../services/googleAuth';
import BrandToast from '../../components/common/BrandToast';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const COVER_W = 92;
const COVER_H = 132;

const LandingScreen = ({ navigation }) => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [covers, setCovers] = useState([]);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
  };

  const onGoogleSuccess = async (data) => {
    if (data?.token) {
      await setAuth(data.user, data.token);
    }
  };
  const onGoogleError = (msg) => showToast(msg || 'Google sign-in failed.');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await booksApi.getBooks({ sort: 'latest', per_page: 18 });
        if (!mounted) return;
        const list = (res.books || []).filter((b) => !!b.cover_url);
        setCovers(list);
      } catch {
        if (mounted) setCovers([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const repeated = useMemo(() => [...covers, ...covers, ...covers], [covers]);

  // Marquee animation
  const scrollX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (covers.length === 0) return;
    const totalWidth = covers.length * (COVER_W + SPACING.sm);
    const loop = () => {
      scrollX.setValue(0);
      Animated.timing(scrollX, {
        toValue: -totalWidth,
        duration: covers.length * 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) loop();
      });
    };
    loop();
    return () => scrollX.stopAnimation();
  }, [covers.length]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>WiamApp</Text>
        </View>

        <View style={styles.heroWrap}>
          <Text style={styles.heroBadge}>Stories that move your soul</Text>
          <Text style={styles.heroTitle}>Read. Discover. Belong.</Text>
          <Text style={styles.heroSub}>
            Free stories from creators across Africa and beyond. New chapters every day.
          </Text>
        </View>

        {covers.length > 0 ? (
          <View style={styles.marqueeWrap} pointerEvents="none">
            <Animated.View
              style={[
                styles.marqueeRow,
                { transform: [{ translateX: scrollX }] },
              ]}
            >
              {repeated.map((b, idx) => (
                <CachedImage
                  key={`${b.id}-${idx}`}
                  source={{ uri: b.cover_url }}
                  style={styles.cover}
                />
              ))}
            </Animated.View>
            <LinearGradient
              colors={[COLORS.background, 'transparent', COLORS.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
          </View>
        ) : null}

        <View style={styles.continueCard}>
          <Text style={styles.cardTitle}>Welcome to WiamApp</Text>
          <Text style={styles.cardSub}>
            Sign in or create an account to start reading.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.9}
          >
            <Mail color={COLORS.black} size={18} />
            <Text style={styles.primaryBtnText}>Continue with email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.9}
          >
            <Text style={styles.outlineBtnText}>Create a new account</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <GoogleSignInSlot onSuccess={onGoogleSuccess} onError={onGoogleError}>
            {(google) => (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={google.start}
                activeOpacity={0.9}
                disabled={google.signing}
              >
                <View style={styles.googleG}>
                  <Text style={styles.googleGText}>G</Text>
                </View>
                {google.signing ? (
                  <ActivityIndicator color={COLORS.text} size="small" />
                ) : (
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                )}
                {!google.ready ? (
                  <View style={styles.soonPill}>
                    <Text style={styles.soonText}>Soon</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            )}
          </GoogleSignInSlot>

          <TouchableOpacity
            style={styles.socialBtn}
            onPress={() => showToast('Facebook sign-in is coming soon.')}
            activeOpacity={0.9}
          >
            <View style={[styles.socialMark, { backgroundColor: '#1877f2' }]}>
              <Text style={styles.socialMarkText}>f</Text>
            </View>
            <Text style={styles.socialBtnText}>Continue with Facebook</Text>
            <View style={styles.soonPill}>
              <Text style={styles.soonText}>Soon</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialBtn}
            onPress={() => showToast('Discord sign-in is coming soon.')}
            activeOpacity={0.9}
          >
            <View style={[styles.socialMark, { backgroundColor: '#5865F2' }]}>
              <Text style={styles.socialMarkText}>d</Text>
            </View>
            <Text style={styles.socialBtnText}>Continue with Discord</Text>
            <View style={styles.soonPill}>
              <Text style={styles.soonText}>Soon</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.featureRow}>
          <View style={styles.featurePill}>
            <BookOpen size={14} color={COLORS.secondary} />
            <Text style={styles.featurePillText}>Free stories</Text>
          </View>
          <View style={styles.featurePill}>
            <Sparkles size={14} color={COLORS.secondary} />
            <Text style={styles.featurePillText}>WiamElite picks</Text>
          </View>
          <View style={styles.featurePill}>
            <Coins size={14} color={COLORS.secondary} />
            <Text style={styles.featurePillText}>Earn as a creator</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>WiamApp</Text>
          <View style={styles.footerLinks}>
            <Text
              style={styles.footerLink}
              onPress={() => Linking.openURL('https://wiamapp.com/about')}
            >
              About
            </Text>
            <Text
              style={styles.footerLink}
              onPress={() => Linking.openURL('https://wiamapp.com/careers')}
            >
              Careers
            </Text>
            <Text
              style={styles.footerLink}
              onPress={() => Linking.openURL('https://wiamapp.com/privacy')}
            >
              Privacy
            </Text>
            <Text
              style={styles.footerLink}
              onPress={() => Linking.openURL('https://wiamapp.com/terms')}
            >
              Terms
            </Text>
            <Text
              style={styles.footerLink}
              onPress={() => Linking.openURL('https://wiamapp.com/help')}
            >
              Help
            </Text>
          </View>
          <Text style={styles.footerCopy}>
            © 2026 WiamApp · Powered by WiamLabs
          </Text>
        </View>
      </ScrollView>
      <BrandToast message={toast} onClear={() => setToast('')} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  brandRow: {
    alignItems: 'center',
    paddingTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  wordmark: {
    color: COLORS.secondary,
    fontFamily: FONTS.display,
    fontSize: 28,
    letterSpacing: 1,
  },
  heroWrap: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  heroBadge: {
    color: COLORS.secondary,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: FONTS.display,
    textAlign: 'center',
  },
  heroSub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: SPACING.sm,
  },
  marqueeWrap: {
    marginVertical: SPACING.lg,
    height: COVER_H,
    overflow: 'hidden',
  },
  marqueeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  cover: {
    width: COVER_W,
    height: COVER_H,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  continueCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.25)',
    padding: SPACING.lg,
    marginTop: SPACING.sm,
  },
  cardTitle: {
    color: COLORS.text,
    fontFamily: FONTS.display,
    fontSize: 22,
    textAlign: 'center',
  },
  cardSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
  },
  primaryBtnText: {
    color: COLORS.black,
    fontWeight: '700',
    fontSize: 15,
  },
  outlineBtn: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.5)',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  outlineBtnText: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  socialBtnText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
    marginLeft: 12,
  },
  googleG: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleGText: {
    color: '#4285F4',
    fontWeight: '900',
    fontSize: 14,
  },
  socialMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialMarkText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 14,
  },
  soonPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  soonText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featurePillText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    marginTop: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.lg,
    alignItems: 'center',
  },
  footerBrand: {
    color: COLORS.secondary,
    fontFamily: FONTS.display,
    fontSize: 18,
    marginBottom: SPACING.sm,
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  footerLink: {
    color: COLORS.textMuted,
    fontSize: 12,
    paddingHorizontal: 4,
  },
  footerCopy: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
});

export default LandingScreen;
