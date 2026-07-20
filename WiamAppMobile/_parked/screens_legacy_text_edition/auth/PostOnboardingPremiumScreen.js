/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Crown, Lock, Sparkles, Headphones } from 'lucide-react-native';
import PostOnboardingShell from '../../components/auth/PostOnboardingShell';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const Perk = ({ Icon, title, body }) => (
  <View style={styles.perkRow}>
    <View style={styles.perkIcon}>
      <Icon size={18} color={COLORS.secondary} />
    </View>
    <View style={styles.perkText}>
      <Text style={styles.perkTitle}>{title}</Text>
      <Text style={styles.perkBody}>{body}</Text>
    </View>
  </View>
);

const PostOnboardingPremiumScreen = ({ navigation }) => {
  const goNext = () => navigation.replace('PostOnboardingCreator');
  const openPremium = () => {
    navigation.replace('PostOnboardingCreator');
    setTimeout(() => navigation.navigate('PremiumScreen'), 60);
  };

  return (
    <PostOnboardingShell
      step={2}
      eyebrow="Try WiamPremium"
      title="Read deeper. Read everywhere."
      subtitle="A calm, ad-free reading experience with early chapters and exclusive perks."
      primaryLabel="See Premium"
      onPrimary={openPremium}
      onSecondary={goNext}
      icon={
        <View style={styles.crownWrap}>
          <Crown size={42} color={COLORS.secondary} strokeWidth={2.2} />
        </View>
      }
    >
      <View style={styles.perksCard}>
        <Perk
          Icon={Lock}
          title="Unlock locked chapters"
          body="No more cliffhangers. Continue any story without waiting."
        />
        <Perk
          Icon={Sparkles}
          title="Early access drops"
          body="Read brand-new chapters days before everyone else."
        />
        <Perk
          Icon={Headphones}
          title="Quiet, ad-free reading"
          body="Stay inside the story — no banners, no interruptions."
        />
      </View>

      <Text style={styles.note}>
        You can start a free trial now or come back to it any time from your profile.
      </Text>
    </PostOnboardingShell>
  );
};

const styles = StyleSheet.create({
  crownWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.5)',
    backgroundColor: 'rgba(212, 168, 67, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  perksCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  perkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 168, 67, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  perkText: { flex: 1 },
  perkTitle: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 15,
  },
  perkBody: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  note: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
    lineHeight: 18,
  },
});

export default PostOnboardingPremiumScreen;
