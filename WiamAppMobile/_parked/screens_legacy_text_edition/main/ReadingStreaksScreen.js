/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import apiClient from '../../api/client';
import { ChevronLeft, Flame, Trophy, Calendar, Zap } from 'lucide-react-native';

const ReadingStreaksScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await apiClient.get('/reading-streaks');
      setData(res.data);
    } catch {
      setData({ current_streak: 0, longest_streak: 0, total_days: 0, this_week: [] });
    }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  const onRefresh = () => { setRefreshing(true); fetch(); };

  const streak = data?.current_streak || 0;
  const longest = data?.longest_streak || 0;
  const total = data?.total_days || 0;
  const week = data?.this_week || [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Reading Streaks</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.secondary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
        >
          {/* Current Streak */}
          <View style={s.heroCard}>
            <Flame size={48} color="#e74c3c" />
            <Text style={s.heroNum}>{streak}</Text>
            <Text style={s.heroLabel}>Day Streak</Text>
            <Text style={s.heroSub}>Keep reading daily to maintain your streak!</Text>
          </View>

          {/* Stats Row */}
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Trophy size={20} color={COLORS.secondary} />
              <Text style={s.statNum}>{longest}</Text>
              <Text style={s.statLabel}>Longest</Text>
            </View>
            <View style={s.stat}>
              <Calendar size={20} color="#60a5fa" />
              <Text style={s.statNum}>{total}</Text>
              <Text style={s.statLabel}>Total Days</Text>
            </View>
            <View style={s.stat}>
              <Zap size={20} color="#fbbf24" />
              <Text style={s.statNum}>{streak > 0 ? '≡ƒöÑ' : 'ΓÇö'}</Text>
              <Text style={s.statLabel}>Status</Text>
            </View>
          </View>

          {/* This Week */}
          <Text style={s.secTitle}>This Week</Text>
          <View style={s.weekRow}>
            {days.map((d, i) => {
              const active = week[i] === true || week[i] === 1;
              return (
                <View key={d} style={[s.dayCircle, active && s.dayActive]}>
                  <Text style={[s.dayText, active && s.dayTextActive]}>{d[0]}</Text>
                </View>
              );
            })}
          </View>

          {/* Motivation */}
          <View style={s.tipCard}>
            <Flame size={18} color="#e74c3c" />
            <Text style={s.tipText}>
              {streak >= 7
                ? 'Amazing! You\'re on fire! Keep this streak alive!'
                : streak >= 3
                ? 'Great progress! A few more days and you\'ll hit a week!'
                : 'Start reading today to build your streak!'}
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  heroCard: { alignItems: 'center', paddingVertical: 32, backgroundColor: 'rgba(231,76,60,0.06)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(231,76,60,0.15)', marginBottom: 20 },
  heroNum: { fontSize: 56, fontWeight: '900', color: '#e74c3c', marginTop: 8 },
  heroLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  heroSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 6 },
  statNum: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textMuted },
  secTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  dayActive: { backgroundColor: 'rgba(231,76,60,0.2)', borderColor: '#e74c3c' },
  dayText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  dayTextActive: { color: '#e74c3c' },
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: 'rgba(231,76,60,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(231,76,60,0.1)' },
  tipText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
});

export default ReadingStreaksScreen;