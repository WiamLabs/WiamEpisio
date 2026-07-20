/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

/**
 * Shared visual shell for post-onboarding pages so every one of them feels like
 * the same WiamApp brand experience: gold accent glow, Playfair title, gold CTA,
 * subtle "Skip" link in the corner.
 */
const PostOnboardingShell = ({
  step,
  totalSteps = 4,
  eyebrow,
  title,
  subtitle,
  icon,
  children,
  primaryLabel,
  onPrimary,
  primaryLoading,
  secondaryLabel = 'Skip for now',
  onSecondary,
  footer,
}) => {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[
          'rgba(212, 168, 67, 0.18)',
          'rgba(114, 47, 55, 0.12)',
          COLORS.background,
        ]}
        style={styles.glow}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        <View style={styles.stepDots}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i + 1 === step ? styles.dotActive : null,
                i + 1 < step ? styles.dotDone : null,
              ]}
            />
          ))}
        </View>
        {onSecondary ? (
          <TouchableOpacity onPress={onSecondary} hitSlop={10}>
            <Text style={styles.skip}>{secondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>

      <View style={styles.footer}>
        {footer}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={onPrimary}
          disabled={!!primaryLoading}
          activeOpacity={0.9}
        >
          {primaryLoading ? (
            <ActivityIndicator color={COLORS.black} />
          ) : (
            <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  stepDots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotActive: { backgroundColor: COLORS.secondary, width: 28 },
  dotDone: { backgroundColor: 'rgba(212,168,67,0.5)' },
  skip: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    flexGrow: 1,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  eyebrow: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.display,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  primaryBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: COLORS.black,
    fontWeight: '700',
    fontSize: 15,
  },
});

export default PostOnboardingShell;
