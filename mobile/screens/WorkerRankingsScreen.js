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
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, goldGradient } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import GoldAvatar from '../components/ui/GoldAvatar';

const PAD = Colors.screenPad;
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
  Gold:     { color: Colors.gold, icon: 'trophy' },
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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!myRank) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Rankings</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trophy-outline" size={52} color={Colors.textDim} />
          <Text style={{ color: Colors.textDim, fontSize: 15, marginTop: 14 }}>Complete your first job to appear in rankings</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tc = TIER_CONFIG[myRank.tier] || TIER_CONFIG.Silver;
  const percentile = myRank.totalWorkers > 0
    ? Math.round(((myRank.totalWorkers - myRank.rank) / myRank.totalWorkers) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Rankings</Text>
        <View style={styles.regionPill}>
          <Ionicons name="location-outline" size={13} color={Colors.textDim} />
          <Text style={styles.regionText}>{myRank.region}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        <LinearGradient
          colors={[Colors.navyCard, Colors.navySoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.myCard}
        >
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
              <Text style={[styles.statVal, { color: Colors.gold }]}>{myRank.score}</Text>
              <Text style={styles.statLabel}>Score</Text>
            </View>
          </View>
        </LinearGradient>

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
                      color={worker.rank === 1 ? Colors.gold : worker.rank === 2 ? '#C0C0C0' : '#CD7F32'}
                    />
                  : <Text style={styles.workerRank}>#{worker.rank}</Text>
                }
              </View>
              <GoldAvatar name={worker.name} size={36} />
              <View style={styles.workerInfo}>
                <Text style={[styles.workerName, worker.isMe && { color: Colors.gold }]}>
                  {worker.name}{worker.isMe ? ' (You)' : ''}
                </Text>
                <View style={styles.workerStatsRow}>
                  <Ionicons name="star" size={12} color={Colors.gold} />
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
          <Ionicons name="bulb-outline" size={18} color={Colors.gold} />
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
  safe:         { flex: 1, backgroundColor: Colors.navy },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 14, gap: 12 },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.white },
  regionPill:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.navyCard, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.navyLine },
  regionText:   { fontSize: 12, color: Colors.textDim },
  myCard:       { marginHorizontal: PAD, borderRadius: Colors.cardRadius, padding: 20, borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)' },
  myCardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  myCardCategory:{ fontSize: 12, color: Colors.textDim, marginBottom: 4 },
  myRankNum:    { fontSize: 44, fontWeight: '800', color: Colors.gold },
  myRankOf:     { fontSize: 13, color: Colors.textDim },
  tierBadge:    { alignItems: 'center', gap: 4 },
  tierName:     { fontSize: 13, fontWeight: '700' },
  rankBar:      { height: 6, backgroundColor: Colors.navyLine, borderRadius: 3, marginTop: 16, overflow: 'hidden' },
  rankBarFill:  { height: '100%', backgroundColor: Colors.gold, borderRadius: 3 },
  rankBarLabel: { fontSize: 12, color: Colors.textDim, marginTop: 6 },
  statsRow:     { flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderTopColor: Colors.navyLine, paddingTop: 16 },
  stat:         { flex: 1, alignItems: 'center' },
  statVal:      { fontSize: 18, fontWeight: '700', color: Colors.white },
  statLabel:    { fontSize: 11, color: Colors.textDim, marginTop: 3 },
  statDiv:      { width: 1, backgroundColor: Colors.navyLine },
  scoreCard:    { backgroundColor: Colors.navyCard, marginHorizontal: PAD, marginTop: 14, borderRadius: Colors.cardRadius, padding: 16, borderWidth: 1, borderColor: Colors.navyLine },
  scoreTitle:   { fontSize: 13, fontWeight: '700', color: Colors.white, marginBottom: 12 },
  scoreRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  scoreDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold },
  scoreItem:    { fontSize: 13, color: Colors.textDim },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.white, marginHorizontal: PAD, marginTop: 20, marginBottom: 10 },
  workerRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: PAD, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.navyLine },
  workerRowMe:  { backgroundColor: 'rgba(212,160,23,0.07)' },
  workerRankBox:{ width: 36, alignItems: 'center', justifyContent: 'center' },
  workerRank:   { fontSize: 14, fontWeight: '700', color: Colors.textDim, textAlign: 'center' },
  workerInfo:   { flex: 1 },
  workerName:   { fontSize: 15, fontWeight: '600', color: Colors.white },
  workerStatsRow:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  workerStats:  { fontSize: 12, color: Colors.textDim },
  workerScore:  { fontSize: 16, fontWeight: '700', textAlign: 'right' },
  workerTierRow:{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, justifyContent: 'flex-end' },
  workerTier:   { fontSize: 11 },
  tipsCard:     { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(212,160,23,0.08)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.2)', borderRadius: Colors.cardRadius, padding: 16, marginHorizontal: PAD, marginTop: 16 },
  tipsTitle:    { fontSize: 13, fontWeight: '700', color: Colors.gold, marginBottom: 4 },
  tipsBody:     { fontSize: 13, color: Colors.textDim, lineHeight: 20 },
});
