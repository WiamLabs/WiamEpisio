/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PenLine, TrendingUp, Coins, Users } from 'lucide-react-native';
import PostOnboardingShell from '../../components/auth/PostOnboardingShell';
import useAuthStore from '../../store/useAuthStore';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const StatCard = ({ value, label }) => (
  <View style={styles.statCard}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const PostOnboardingCreatorScreen = ({ navigation }) => {
  const { user } = useAuthStore();
  const goNext = () => navigation.replace('PostOnboardingMission');
  const apply = () => {
    navigation.replace('PostOnboardingMission');
    setTimeout(() => navigation.navigate('Apply'), 60);
  };

  // If they already are a creator, skip this entirely
  useEffect(() => {
    if (user?.is_creator) {
      goNext();
    }
  }, [user?.is_creator]);

  if (user?.is_creator) return null;

  return (
    <PostOnboardingShell
      step={3}
      eyebrow="Become a creator"
      title="Have a story to share?"
      subtitle="Turn your imagination into a published novel and grow a community of readers."
      primaryLabel="Apply to write"
      onPrimary={apply}
      onSecondary={goNext}
      icon={
        <View style={styles.penWrap}>
          <PenLine size={40} color={COLORS.secondary} strokeWidth={2.2} />
        </View>
      }
    >
      <View style={styles.row}>
        <StatCard value="Free" label="To start writing" />
        <StatCard value="∞" label="Chapters allowed" />
        <StatCard value="100%" label="You own your story" />
      </View>

      <View style={styles.benefitsCard}>
        <View style={styles.benefitRow}>
          <Users size={18} color={COLORS.secondary} />
          <Text style={styles.benefitText}>
            Build a real audience that follows your every chapter.
          </Text>
        </View>
        <View style={styles.benefitRow}>
          <Coins size={18} color={COLORS.secondary} />
          <Text style={styles.benefitText}>
            Earn coins from premium chapters, tips, and reader subscriptions.
          </Text>
        </View>
        <View style={styles.benefitRow}>
          <TrendingUp size={18} color={COLORS.secondary} />
          <Text style={styles.benefitText}>
            Get featured on Discover when your story takes off.
          </Text>
        </View>
      </View>
    </PostOnboardingShell>
  );
};

const styles = StyleSheet.create({
  penWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.5)',
    backgroundColor: 'rgba(114, 47, 55, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.secondary,
    fontFamily: FONTS.display,
    fontSize: 22,
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  benefitsCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  benefitText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
});

export default PostOnboardingCreatorScreen;
