/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Target, BookOpen, UserPlus, Coins } from 'lucide-react-native';
import PostOnboardingShell from '../../components/auth/PostOnboardingShell';
import useAuthStore from '../../store/useAuthStore';
import walletApi from '../../api/wallet';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const TaskItem = ({ Icon, title, body, done }) => (
  <View style={[styles.taskRow, done && styles.taskRowDone]}>
    <View style={[styles.taskIcon, done && styles.taskIconDone]}>
      <Icon size={16} color={done ? COLORS.success : COLORS.secondary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>{title}</Text>
      <Text style={styles.taskBody}>{body}</Text>
    </View>
  </View>
);

const PostOnboardingMissionScreen = ({ navigation }) => {
  const { clearPostOnboarding } = useAuthStore();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [reward, setReward] = useState(10);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await walletApi.getFirstMissionStatus();
        if (cancelled) return;
        setStatus(s || {});
        if (s?.claimed) setClaimed(true);
        if (s?.eligible && !s?.claimed) {
          // Auto-claim if already eligible (rare, but possible)
          try {
            const claim = await walletApi.claimFirstMissionReward();
            if (claim?.ok) {
              setClaimed(true);
              setReward(Number(claim.coins) || 10);
            }
          } catch {}
        }
      } catch {
        if (!cancelled) setStatus({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = () => {
    clearPostOnboarding();
  };

  return (
    <PostOnboardingShell
      step={4}
      eyebrow="Your first mission"
      title={claimed ? 'Mission ready' : 'A quick way to earn 10 coins'}
      subtitle={
        claimed
          ? 'You will earn ten coins automatically once you read a chapter and follow a creator.'
          : 'Complete two simple steps and we will drop ten coins into your wallet.'
      }
      primaryLabel="Start reading"
      onPrimary={finish}
      onSecondary={finish}
      secondaryLabel="Maybe later"
      icon={
        <View style={styles.targetWrap}>
          <Target size={42} color={COLORS.secondary} strokeWidth={2.2} />
        </View>
      }
    >
      {loading ? (
        <ActivityIndicator color={COLORS.secondary} style={{ marginTop: SPACING.lg }} />
      ) : (
        <View style={styles.tasks}>
          <TaskItem
            Icon={BookOpen}
            title="Read at least one chapter"
            body="Pick any story and read for a few minutes."
            done={!!status?.has_read_chapter}
          />
          <TaskItem
            Icon={UserPlus}
            title="Follow at least one creator"
            body="Tap follow on any author you enjoy."
            done={!!status?.has_followed_creator}
          />
        </View>
      )}

      <View style={styles.rewardCard}>
        <Coins size={20} color={COLORS.secondary} />
        <Text style={styles.rewardText}>
          {claimed
            ? `Reward unlocked: +${reward} coins added to your wallet.`
            : `Reward: +${reward} coins on completion.`}
        </Text>
      </View>
    </PostOnboardingShell>
  );
};

const styles = StyleSheet.create({
  targetWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.5)',
    backgroundColor: 'rgba(212, 168, 67, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tasks: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  taskRowDone: {
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
  },
  taskIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(212, 168, 67, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskIconDone: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  taskTitle: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  taskTitleDone: {
    color: COLORS.success,
  },
  taskBody: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(212, 168, 67, 0.1)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.3)',
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  rewardText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default PostOnboardingMissionScreen;
