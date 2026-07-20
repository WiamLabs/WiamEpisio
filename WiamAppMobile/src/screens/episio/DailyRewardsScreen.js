/**
 * WiamEpisio-Daily-Rewards.html — streak hero + 7-day grid + claim.
 * API: GET /rewards/status, POST /rewards/daily
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { X, Flame, Check, Info } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import apiClient from '../../api/client';
import useAuthStore from '../../store/useAuthStore';

const DEFAULT_AMOUNTS = [5, 5, 10, 10, 15, 15, 20];
const GREEN = '#3BB273';

function resolveDayAmounts(status) {
  const fromApi = status?.day_amounts
    || status?.daily_amounts
    || status?.reward_days
    || status?.days;
  if (Array.isArray(fromApi) && fromApi.length >= 7) {
    return fromApi.slice(0, 7).map((d) => (
      typeof d === 'number' ? d : Number(d?.coins ?? d?.amount ?? d?.reward ?? 0)
    ));
  }
  const base = Number(status?.daily_base_coins);
  if (base > 0) {
    return DEFAULT_AMOUNTS.map((a, i) => (i < 2 ? base : a));
  }
  return DEFAULT_AMOUNTS;
}

const DailyRewardsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.get('/rewards/status');
      setStatus(data);
      setError(null);
    } catch {
      setError('Could not load rewards');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const streak = Number(status?.daily_streak ?? 0);
  const canClaim = !!status?.can_claim_daily;
  const amounts = useMemo(() => resolveDayAmounts(status), [status]);
  const todayDay = canClaim ? Math.min(streak + 1, 7) : Math.min(Math.max(streak, 1), 7);
  const todayAmt = amounts[todayDay - 1] ?? 10;
  const grandBonus = status?.day30_bonus
    ?? status?.grand_prize
    ?? status?.streak_30_bonus
    ?? 500;

  const claim = async () => {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const { data } = await apiClient.post('/rewards/daily');
      setMsg(data?.message || `Claimed ${data?.coins || data?.amount || todayAmt} coins`);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.empty}>Sign in to claim daily rewards.</Text>
        <EpisioGoldButton
          label="Sign In"
          onPress={() => navigation.navigate('Login')}
          style={{ marginTop: 20, alignSelf: 'stretch', marginHorizontal: 40 }}
        />
        <TouchableOpacity style={styles.later} onPress={() => navigation.goBack()}>
          <Text style={styles.laterText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <X size={15} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Daily Rewards</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View style={styles.hero}>
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.streakBadge}>
              <Flame size={30} color={COLORS.navy} fill={COLORS.navy} />
            </LinearGradient>
            <Text style={styles.heroTitle}>{streak}-Day Streak</Text>
            <Text style={styles.heroSub}>
              {canClaim ? (
                <>Come back tomorrow for <Text style={styles.gold}>Day {Math.min(streak + 2, 7)}</Text> — don't break the streak!</>
              ) : (
                <>Come back tomorrow for <Text style={styles.gold}>Day {Math.min(streak + 1, 7)}</Text> — don't break the streak!</>
              )}
            </Text>
          </View>

          <View style={styles.grid}>
            {amounts.map((amt, i) => {
              const day = i + 1;
              const done = day <= streak;
              const today = canClaim && day === todayDay;
              return (
                <View
                  key={day}
                  style={[
                    styles.dayCard,
                    done && styles.dayDone,
                    today && styles.dayToday,
                  ]}
                >
                  <Text style={[
                    styles.dayNum,
                    done && styles.dayNumDone,
                    today && styles.dayNumToday,
                  ]}
                  >
                    DAY {day}
                  </Text>
                  <View style={[
                    styles.dayIcon,
                    done && styles.dayIconDone,
                    today && styles.dayIconToday,
                    !done && !today && styles.dayIconIdle,
                  ]}
                  >
                    {done ? (
                      <Check size={14} color={COLORS.navy} strokeWidth={3} />
                    ) : (
                      <Text style={{ fontSize: 14 }}>🎁</Text>
                    )}
                  </View>
                  <Text style={[styles.dayAmt, today && styles.dayAmtToday]}>+{amt}</Text>
                </View>
              );
            })}
            <View style={styles.dayBig}>
              <View>
                <Text style={[styles.dayNum, { marginBottom: 3 }]}>DAY 30 · GRAND PRIZE</Text>
                <Text style={[styles.dayAmt, { fontSize: 15 }]}>+{grandBonus} coins bonus</Text>
              </View>
              <Text style={{ fontSize: 26 }}>👑</Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {msg ? <Text style={styles.ok}>{msg}</Text> : null}

          <EpisioGoldButton
            label={
              canClaim
                ? `Claim Today's Reward — +${todayAmt} Coins`
                : 'Already claimed today'
            }
            onPress={claim}
            loading={busy}
            disabled={!canClaim}
            style={{ marginBottom: 16 }}
          />

          <View style={styles.missedNote}>
            <Info size={14} color={COLORS.textFaint} style={{ marginTop: 1 }} />
            <Text style={styles.missedText}>
              Miss a day and your streak resets to Day 1. Rewards refresh daily at midnight GMT.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  topbar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 4,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontSize: 18, fontFamily: FONTS.extraBold, color: '#fff' },
  hero: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24 },
  streakBadge: {
    width: 70, height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 16, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 4 },
  heroSub: {
    fontSize: 11.5, fontFamily: FONTS.regular, color: COLORS.textDim, textAlign: 'center',
  },
  gold: { color: COLORS.gold, fontFamily: FONTS.bold },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20,
  },
  dayCard: {
    width: '22.5%',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6,
    alignItems: 'center', backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  dayDone: {
    backgroundColor: 'rgba(59,178,115,0.1)', borderColor: 'rgba(59,178,115,0.35)',
  },
  dayToday: {
    backgroundColor: 'rgba(212,160,23,0.18)', borderColor: COLORS.gold,
  },
  dayNum: {
    fontSize: 9.5, fontFamily: FONTS.bold, color: COLORS.textFaint, marginBottom: 8,
  },
  dayNumDone: { color: GREEN },
  dayNumToday: { color: COLORS.gold },
  dayIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  dayIconIdle: { backgroundColor: COLORS.navySoft },
  dayIconDone: { backgroundColor: GREEN },
  dayIconToday: { backgroundColor: COLORS.gold },
  dayAmt: { fontSize: 11, fontFamily: FONTS.extraBold, color: '#fff' },
  dayAmtToday: { color: COLORS.gold },
  dayBig: {
    width: '100%', borderRadius: 14, padding: 16,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  missedNote: { flexDirection: 'row', gap: 9, paddingHorizontal: 2 },
  missedText: {
    flex: 1, fontSize: 11, color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 17,
  },
  error: { color: COLORS.error, marginBottom: 10, fontFamily: FONTS.medium, fontSize: 13 },
  ok: { color: COLORS.success, marginBottom: 10, fontFamily: FONTS.medium, fontSize: 13 },
  empty: { color: COLORS.textFaint, fontFamily: FONTS.medium, textAlign: 'center', fontSize: 14 },
  later: { marginTop: 14, padding: 8 },
  laterText: { color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 13 },
});

export default DailyRewardsScreen;
