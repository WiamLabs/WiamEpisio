// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerDashboardScreen.js — Part 13 Worker Home

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, goldGradient } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { updateWorkerAvailability } from '../lib/api/workers';
import { getPendingBookings, getWorkerBookings } from '../lib/api/bookings';
import { getUnreadNotificationCount, subscribeToNotifications } from '../lib/api/notifications';
import { supabase } from '../lib/supabase';
import AppHeader from '../components/ui/AppHeader';
import SpotlightCard from '../components/ui/SpotlightCard';

export default function WorkerDashboardScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [available, setAvailable] = useState(profile?.is_available ?? true);
  const [stats, setStats] = useState({ total: 0, completed: 0, earnings: 0, rating: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [feed, setFeed] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const [pending, all] = await Promise.all([
        getPendingBookings(profile.id),
        getWorkerBookings(profile.id),
      ]);
      setPendingCount((pending || []).length);
      const completed = (all || []).filter((b) => b.status === 'completed');
      const totalEarnings = completed.reduce((sum, b) => sum + (parseFloat(b.agreed_price) || 0), 0);
      setStats({
        total: all?.length || 0,
        completed: completed.length,
        earnings: totalEarnings,
        rating: profile?.average_rating || 0,
      });

      const { data: spotData } = await supabase
        .from('spotlight_posts')
        .select(`
          id, title, description, content, media_urls, category_id,
          worker_profile_id, worker_id, status, is_active,
          categories ( name ),
          worker_profiles (
            id, average_rating, total_jobs_done, city, verified_badge, is_verified,
            users ( full_name, avatar_url, city )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(15);

      const spots = (spotData || [])
        .filter((p) => p.status === 'approved' || p.is_active === true)
        .map((post) => {
          const wp = post.worker_profiles;
          const skill = post.categories?.name || 'Professional';
          const city = wp?.users?.city || wp?.city || '';
          return {
            key: `spot-${post.id}`,
            workerId: wp?.id || post.worker_profile_id || post.worker_id,
            name: wp?.users?.full_name || 'Worker',
            roleLine: [skill, city].filter(Boolean).join(' · '),
            rating: wp?.average_rating,
            tag: skill,
            caption: post.description || post.content || post.title || '',
            jobsCount: wp?.total_jobs_done ?? null,
            mediaUrl: Array.isArray(post.media_urls) ? post.media_urls[0] : null,
            avatarUrl: wp?.users?.avatar_url,
            verified: !!(wp?.verified_badge || wp?.is_verified),
          };
        });
      setFeed(spots);

      if (user?.id) setUnread(await getUnreadNotificationCount(user.id));
    } catch (e) {
      console.warn('WorkerHome load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [profile?.id]));

  useEffect(() => {
    if (!user?.id) return undefined;
    const sub = subscribeToNotifications(user.id, () => setUnread((p) => p + 1));
    return () => sub.unsubscribe();
  }, [user?.id]);

  const toggleAvailability = async () => {
    if (!profile?.id || toggling) return;
    const next = !available;
    setToggling(true);
    try {
      await updateWorkerAvailability(profile.id, next);
      setAvailable(next);
    } catch {
      Alert.alert('Error', 'Could not update availability. Try again.');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <View style={styles.topFixed}>
        <AppHeader
          showSearch={false}
          unread={unread}
          onNotifications={() => navigation.navigate('WorkerNotifications')}
          rightExtra={
            pendingCount > 0 ? (
              <TouchableOpacity
                style={styles.pendingBtn}
                onPress={() => navigation.navigate('Jobs')}
              >
                <Text style={styles.pendingBtnText}>{pendingCount} new</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.gold}
          />
        }
      >
        {/* Availability — gold hero card */}
        <LinearGradient
          colors={goldGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.availCard}
        >
          <View style={styles.availGlow} />
          <View style={styles.availLeft}>
            <View style={[styles.availDot, !available && styles.availDotOff]} />
            <View>
              <Text style={styles.availTitle}>
                {available ? "You're available" : "You're offline"}
              </Text>
              <Text style={styles.availSub}>
                {available ? 'Ready to receive job requests' : 'Job requests are paused'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.switch, !available && styles.switchOff]}
            onPress={toggleAvailability}
            disabled={toggling}
            activeOpacity={0.9}
          >
            <View style={[styles.switchDot, available && styles.switchDotOn]} />
          </TouchableOpacity>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {[
            { icon: 'briefcase-outline', value: String(stats.total), label: 'Total Jobs' },
            { icon: 'checkmark-circle-outline', value: String(stats.completed), label: 'Completed' },
            { icon: 'wallet-outline', value: `GHS ${Math.round(stats.earnings)}`, label: 'Earnings' },
            { icon: 'star', value: stats.rating ? String(stats.rating) : 'New', label: 'Rating', filled: true },
          ].map((s) => (
            <View key={s.label} style={styles.statBox}>
              <Ionicons
                name={s.icon}
                size={16}
                color={s.filled ? Colors.gold : Colors.gold}
              />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {profile && (profile.profile_completion_percent ?? 0) < 100 ? (
          <TouchableOpacity
            style={styles.checklist}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.85}
          >
            <View style={styles.checklistTop}>
              <Text style={styles.checklistTitle}>Finish your profile</Text>
              <Text style={styles.checklistPct}>{profile.profile_completion_percent ?? 0}%</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${profile.profile_completion_percent ?? 0}%` }]} />
            </View>
            <Text style={styles.checklistSub}>Complete profiles get booked more.</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Spotlight</Text>
          <Text style={styles.seeAll} onPress={() => navigation.navigate('SpotlightManager')}>
            See all
          </Text>
        </View>

        {feed.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your feed is quiet</Text>
            <Text style={styles.emptySub}>Post to Spotlight to show your best work to customers.</Text>
            <TouchableOpacity
              style={styles.postBtn}
              onPress={() => navigation.navigate('SpotlightManager')}
            >
              <Text style={styles.postBtnText}>Create Spotlight</Text>
            </TouchableOpacity>
          </View>
        ) : (
          feed.map((item) => (
            <SpotlightCard
              key={item.key}
              name={item.name}
              roleLine={item.roleLine}
              rating={item.rating}
              tag={item.tag}
              caption={item.caption}
              jobsCount={item.jobsCount}
              mediaUrl={item.mediaUrl}
              avatarUrl={item.avatarUrl}
              verified={item.verified}
              hideBook
              onPressCard={() => item.workerId && navigation.navigate('WorkerProfile', { workerId: item.workerId })}
            />
          ))
        )}

        <Text style={styles.footer}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  topFixed: { paddingHorizontal: 20, paddingBottom: 8 },
  pendingBtn: {
    backgroundColor: Colors.navyCard,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  pendingBtnText: { color: Colors.gold, fontSize: 11, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 28 },
  availCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  availGlow: {
    position: 'absolute',
    right: -24,
    top: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: Colors.navy,
    opacity: 0.15,
  },
  availLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, zIndex: 1, flex: 1 },
  availDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0F3D1F' },
  availDotOff: { backgroundColor: '#5A1A1A' },
  availTitle: { fontSize: 15, fontWeight: '700', color: Colors.navy },
  availSub: { fontSize: 12, color: '#3A2E05', marginTop: 2 },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 999,
    backgroundColor: Colors.navy,
    justifyContent: 'center',
    paddingHorizontal: 3,
    zIndex: 1,
  },
  switchOff: { backgroundColor: 'rgba(8,8,26,0.25)' },
  switchDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
    marginLeft: 0,
  },
  switchDotOn: { marginLeft: 20 },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: Colors.navyCard,
    alignItems: 'center',
  },
  statValue: { fontSize: 14, fontWeight: '700', color: Colors.white, marginTop: 6 },
  statLabel: { fontSize: 9.5, color: '#75758F', marginTop: 4, textAlign: 'center' },
  checklist: {
    backgroundColor: Colors.navyCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.navyLine,
    padding: 14,
    marginBottom: 18,
  },
  checklistTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  checklistTitle: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  checklistPct: { color: Colors.gold, fontWeight: '700', fontSize: 13 },
  barBg: { height: 6, borderRadius: 999, backgroundColor: Colors.navySoft, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: Colors.gold },
  checklistSub: { color: Colors.textDim, fontSize: 12, marginTop: 8 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.white },
  seeAll: { fontSize: 11.5, color: Colors.gold, fontWeight: '500' },
  empty: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.navyLine,
    backgroundColor: Colors.navyCard,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { color: Colors.white, fontWeight: '700', fontSize: 15, marginBottom: 6 },
  emptySub: { color: Colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 14 },
  postBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  postBtnText: { color: Colors.navy, fontWeight: '700', fontSize: 13 },
  footer: { textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingVertical: 12 },
});
