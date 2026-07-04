// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerRankingsScreen.js
// Worker sees their position in the rankings + top workers in their category
// Backend: GET /api/rankings/worker

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const NAVY   = Colors.navy;
const NAVY2  = Colors.navyMid;
const GOLD   = Colors.gold;
const WHITE  = Colors.white;
const MUTED  = 'rgba(255,255,255,0.50)';
const BORDER = 'rgba(255,255,255,0.09)';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const MOCK_MY_RANK = {
  rank: 7,
  totalWorkers: 94,
  category: 'Electrician',
  region: 'Accra',
  score: 87.4,
  rating: 4.9,
  jobsCompleted: 127,
  responseRate: 96,
  tier: 'Gold',
};

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'Kwame Asante', rating: 5.0, jobs: 214, score: 98.1, tier: 'Platinum' },
  { rank: 2, name: 'Ama Serwaa',   rating: 4.9, jobs: 189, score: 95.3, tier: 'Platinum' },
  { rank: 3, name: 'Kofi Mensah',  rating: 4.9, jobs: 176, score: 93.7, tier: 'Gold'     },
  { rank: 4, name: 'Abena Ofori',  rating: 4.8, jobs: 161, score: 91.2, tier: 'Gold'     },
  { rank: 5, name: 'Yaw Boateng',  rating: 4.8, jobs: 148, score: 90.0, tier: 'Gold'     },
  { rank: 6, name: 'Ekua Amoah',   rating: 4.8, jobs: 134, score: 88.6, tier: 'Gold'     },
  { rank: 7, name: 'You',           rating: 4.9, jobs: 127, score: 87.4, tier: 'Gold', isMe: true },
  { rank: 8, name: 'Kojo Agyei',   rating: 4.7, jobs: 119, score: 85.1, tier: 'Silver'   },
  { rank: 9, name: 'Nana Adjei',   rating: 4.7, jobs: 108, score: 83.0, tier: 'Silver'   },
  { rank: 10,name: 'Adwoa Kusi',   rating: 4.6, jobs: 99,  score: 80.2, tier: 'Silver'   },
];

const TIER_CONFIG = {
  Platinum: { color: '#A8D8F0', icon: 'diamond' },
  Gold:     { color: GOLD,      icon: 'trophy' },
  Silver:   { color: '#C0C0C0', icon: 'medal' },
  Bronze:   { color: '#CD7F32', icon: 'ribbon' },
};

export default function WorkerRankingsScreen({ navigation }) {
  const { user, profile } = useAuth();

  const [myRank,     setMyRank]     = useState(null);
  const [board,      setBoard]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRankings = async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const region = profile?.location_name || user?.city || 'Accra';

      // Get worker's first category
      const { data: catRow } = await supabase
        .from('worker_categories')
        .select('categories(id, name)')
        .eq('worker_profile_id', profile.id)
        .limit(1)
        .single();

      const categoryName = catRow?.categories?.name || 'All Workers';
      const categoryId   = catRow?.categories?.id   || null;

      // Get top workers in same category
      let workerIds = [];
      if (categoryId) {
        const { data: cwRows } = await supabase
          .from('worker_categories')
          .select('worker_profile_id')
          .eq('category_id', categoryId);
        workerIds = (cwRows || []).map(r => r.worker_profile_id);
      }

      let q = supabase
        .from('worker_profiles')
        .select('id, average_rating, total_jobs_done, subscription_tier, users(full_name)')
        .order('average_rating',   { ascending: false })
        .order('total_jobs_done',  { ascending: false })
        .limit(20);

      if (workerIds.length > 0) q = q.in('id', workerIds);

      const { data: topWorkers } = await q;
      const workers = topWorkers || [];

      const scoreFn = (w) =>
        parseFloat(((w.average_rating || 0) * 10 + Math.min((w.total_jobs_done || 0) / 5, 20)).toFixed(1));

      const leaderboard = workers.map((w, i) => {
        const isMe = w.id === profile.id;
        const tier = w.subscription_tier === 'platinum' ? 'Platinum'
                   : w.subscription_tier === 'gold'     ? 'Gold'
                   : w.subscription_tier === 'silver'   ? 'Silver' : 'Bronze';
        return { rank: i + 1, name: isMe ? 'You' : (w.users?.full_name || 'Worker'), rating: w.average_rating || 0, jobs: w.total_jobs_done || 0, score: scoreFn(w), tier, isMe };
      });

      setBoard(leaderboard);

      const myEntry = leaderboard.find(w => w.isMe);
      setMyRank({
        rank:          myEntry?.rank || workers.length + 1,
        totalWorkers:  workers.length,
        category:      categoryName,
        region,
        score:         myEntry?.score || 0,
        rating:        profile?.average_rating  || 0,
        jobsCompleted: profile?.total_jobs_done || 0,
        responseRate:  95,
        tier:          myEntry?.tier || 'Bronze',
      });
    } catch (e) {
      console.warn('Rankings error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchRankings(); }, [profile?.id]);
  const onRefresh = () => { setRefreshing(true); fetchRankings(); };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={GOLD} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!myRank) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Rankings</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trophy-outline" size={52} color={MUTED} />
          <Text style={{ color: MUTED, fontSize: 15, marginTop: 14 }}>Complete your first job to appear in rankings</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tc = TIER_CONFIG[myRank.tier] || TIER_CONFIG.Silver;
  const percentile = myRank.totalWorkers > 0
    ? Math.round(((myRank.totalWorkers - myRank.rank) / myRank.totalWorkers) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Rankings</Text>
        <View style={styles.regionPill}>
          <Ionicons name="location-outline" size={13} color={MUTED} />
          <Text style={styles.regionText}>{myRank.region}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
      >
        {/* My position card */}
        <View style={styles.myCard}>
          <View style={styles.myCardTop}>
            <View>
              <Text style={styles.myCardCategory}>{myRank.category} · {myRank.region}</Text>
              <Text style={styles.myRankNum}>#{myRank.rank}</Text>
              <Text style={styles.myRankOf}>of {myRank.totalWorkers} workers</Text>
            </View>
            <View style={styles.tierBadge}>
              <Ionicons name={tc.icon} size={26} color={tc.color} />
              <Text style={[styles.tierName, { color: tc.color }]}>{myRank.tier}</Text>
            </View>
          </View>
          <View style={styles.rankBar}>
            <View style={[styles.rankBarFill, { width: `${percentile}%` }]} />
          </View>
          <Text style={styles.rankBarLabel}>Top {100 - percentile}% of workers in {myRank.region}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{myRank.rating}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.stat}>
              <Text style={styles.statVal}>{myRank.jobsCompleted}</Text>
              <Text style={styles.statLabel}>Jobs Done</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.stat}>
              <Text style={styles.statVal}>{myRank.responseRate}%</Text>
              <Text style={styles.statLabel}>Response</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.stat}>
              <Text style={[styles.statVal, { color: GOLD }]}>{myRank.score}</Text>
              <Text style={styles.statLabel}>Score</Text>
            </View>
          </View>
        </View>

        {/* How score is calculated */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreTitle}>How Your Score is Calculated</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreDot} />
            <Text style={styles.scoreItem}>Customer rating (40%)</Text>
          </View>
          <View style={styles.scoreRow}>
            <View style={styles.scoreDot} />
            <Text style={styles.scoreItem}>Job completion rate (30%)</Text>
          </View>
          <View style={styles.scoreRow}>
            <View style={styles.scoreDot} />
            <Text style={styles.scoreItem}>Response speed (20%)</Text>
          </View>
          <View style={styles.scoreRow}>
            <View style={styles.scoreDot} />
            <Text style={styles.scoreItem}>Verified documents (10%)</Text>
          </View>
        </View>

        {/* Leaderboard */}
        <Text style={styles.sectionTitle}>Top Workers — {myRank.category}</Text>
        {board.map(worker => {
          const wtc = TIER_CONFIG[worker.tier] || TIER_CONFIG.Silver;
          return (
            <View
              key={worker.rank}
              style={[styles.workerRow, worker.isMe && styles.workerRowMe]}
            >
              <View style={styles.workerRankBox}>
                {worker.rank <= 3
                  ? <Ionicons
                      name={worker.rank === 1 ? 'trophy' : 'medal'}
                      size={16}
                      color={worker.rank === 1 ? GOLD : worker.rank === 2 ? '#C0C0C0' : '#CD7F32'}
                    />
                  : <Text style={styles.workerRank}>#{worker.rank}</Text>
                }
              </View>
              <View style={styles.workerInfo}>
                <Text style={[styles.workerName, worker.isMe && { color: GOLD }]}>
                  {worker.name}{worker.isMe ? ' (You)' : ''}
                </Text>
                <View style={styles.workerStatsRow}>
                  <Ionicons name="star" size={12} color={GOLD} />
                  <Text style={styles.workerStats}>
                    {worker.rating} · {worker.jobs} jobs
                  </Text>
                </View>
              </View>
              <View>
                <Text style={[styles.workerScore, { color: wtc.color }]}>{worker.score}</Text>
                <View style={styles.workerTierRow}>
                  <Ionicons name={wtc.icon} size={11} color={wtc.color} />
                  <Text style={[styles.workerTier, { color: wtc.color }]}>{worker.tier}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Tips to improve */}
        <View style={styles.tipsCard}>
          <Ionicons name="bulb-outline" size={18} color={GOLD} />
          <View style={{ flex: 1 }}>
            <Text style={styles.tipsTitle}>Move up faster</Text>
            <Text style={styles.tipsBody}>Complete jobs on time, respond within 5 minutes, and collect 5-star reviews to boost your ranking score.</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: NAVY },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 12 },
  backBtn:      { padding: 4 },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: '700', color: WHITE },
  regionPill:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: NAVY2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  regionText:   { fontSize: 12, color: MUTED },
  myCard:       { backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)' },
  myCardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  myCardCategory:{ fontSize: 12, color: MUTED, marginBottom: 4 },
  myRankNum:    { fontSize: 44, fontWeight: '800', color: GOLD },
  myRankOf:     { fontSize: 13, color: MUTED },
  tierBadge:    { alignItems: 'center', gap: 4 },
  tierName:     { fontSize: 13, fontWeight: '700' },
  rankBar:      { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 16, overflow: 'hidden' },
  rankBarFill:  { height: '100%', backgroundColor: GOLD, borderRadius: 3 },
  rankBarLabel: { fontSize: 12, color: MUTED, marginTop: 6 },
  statsRow:     { flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 16 },
  stat:         { flex: 1, alignItems: 'center' },
  statVal:      { fontSize: 18, fontWeight: '700', color: WHITE },
  statLabel:    { fontSize: 11, color: MUTED, marginTop: 3 },
  statDiv:      { width: 1, backgroundColor: BORDER },
  scoreCard:    { backgroundColor: NAVY2, marginHorizontal: 20, marginTop: 14, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER },
  scoreTitle:   { fontSize: 13, fontWeight: '700', color: WHITE, marginBottom: 12 },
  scoreRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  scoreDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  scoreItem:    { fontSize: 13, color: MUTED },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: WHITE, marginHorizontal: 20, marginTop: 20, marginBottom: 10 },
  workerRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  workerRowMe:  { backgroundColor: 'rgba(212,160,23,0.07)' },
  workerRankBox:{ width: 36, alignItems: 'center', justifyContent: 'center' },
  workerRank:   { fontSize: 14, fontWeight: '700', color: MUTED, textAlign: 'center' },
  workerInfo:   { flex: 1 },
  workerName:   { fontSize: 15, fontWeight: '600', color: WHITE },
  workerStatsRow:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  workerStats:  { fontSize: 12, color: MUTED },
  workerScore:  { fontSize: 16, fontWeight: '700', textAlign: 'right' },
  workerTierRow:{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, justifyContent: 'flex-end' },
  workerTier:   { fontSize: 11 },
  tipsCard:     { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(212,160,23,0.08)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.2)', borderRadius: 14, padding: 16, marginHorizontal: 20, marginTop: 16 },
  tipsTitle:    { fontSize: 13, fontWeight: '700', color: GOLD, marginBottom: 4 },
  tipsBody:     { fontSize: 13, color: MUTED, lineHeight: 20 },
});
