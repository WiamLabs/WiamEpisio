// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerDashboardScreen.js
// PRODUCTION — real Supabase data, real-time updates

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Switch,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { updateWorkerAvailability } from '../lib/api/workers';
import { getPendingBookings, getWorkerBookings } from '../lib/api/bookings';
import { getUnreadNotificationCount, subscribeToNotifications } from '../lib/api/notifications';

const NAVY  = Colors.navyDeep;
const NAVY2 = Colors.navyMid;
const GOLD  = Colors.gold;
const WHITE = Colors.white;
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER= 'rgba(255,255,255,0.09)';

export default function WorkerDashboardScreen({ navigation }) {
  const { user, profile } = useAuth();

  const [available,     setAvailable]     = useState(profile?.is_available ?? true);
  const [pendingJobs,   setPendingJobs]   = useState([]);
  const [activeJobs,    setActiveJobs]    = useState([]);
  const [stats,         setStats]         = useState({ total: 0, completed: 0, earnings: 0, rating: 0 });
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [togglingAvail, setTogglingAvail] = useState(false);

  const loadDashboard = async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      // 1. Pending requests
      const pending = await getPendingBookings(profile.id);
      setPendingJobs(pending || []);

      // 2. All bookings for stats
      const all = await getWorkerBookings(profile.id);
      const completed = (all || []).filter(b => b.status === 'completed');
      const active    = (all || []).filter(b => b.status === 'accepted' || b.status === 'in_progress');
      setActiveJobs(active);

      const totalEarnings = completed.reduce((sum, b) => sum + (parseFloat(b.agreed_price) || 0), 0);
      setStats({
        total:     all?.length || 0,
        completed: completed.length,
        earnings:  totalEarnings,
        rating:    profile?.average_rating || 0,
      });

      // 3. Unread notifications
      if (user?.id) {
        const count = await getUnreadNotificationCount(user.id);
        setUnreadCount(count);
      }
    } catch (e) {
      console.warn('Dashboard load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload whenever screen comes into focus
  useFocusEffect(useCallback(() => { loadDashboard(); }, [profile?.id]));

  // Real-time notification badge
  useEffect(() => {
    if (!user?.id) return;
    const sub = subscribeToNotifications(user.id, () => {
      setUnreadCount(prev => prev + 1);
    });
    return () => sub.unsubscribe();
  }, [user?.id]);

  const toggleAvailability = async (val) => {
    setTogglingAvail(true);
    try {
      await updateWorkerAvailability(profile.id, val);
      setAvailable(val);
    } catch (e) {
      Alert.alert('Error', 'Could not update availability. Try again.');
    } finally {
      setTogglingAvail(false);
    }
  };

  const firstName = user?.full_name?.split(' ')[0] || 'Worker';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={GOLD} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} tintColor={GOLD} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {firstName}</Text>
            <Text style={styles.subGreet}>
              {profile?.location_name || user?.city || 'Accra'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => navigation.navigate('WorkerNotifs')}
          >
            <Ionicons name="notifications-outline" size={22} color={WHITE} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Availability toggle */}
        <View style={styles.availCard}>
          <View style={styles.availLeft}>
            <View style={[styles.availDot, { backgroundColor: available ? Colors.success : Colors.error }]} />
            <View>
              <Text style={styles.availLabel}>{available ? "I'm Available" : "I'm Busy"}</Text>
              <Text style={styles.availSub}>
                {available ? 'You can receive new job requests' : 'New requests are paused'}
              </Text>
            </View>
          </View>
          {togglingAvail
            ? <ActivityIndicator color={GOLD} />
            : <Switch
                value={available}
                onValueChange={toggleAvailability}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: GOLD }}
                thumbColor={available ? NAVY : '#888'}
              />
          }
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total Jobs',  value: stats.total,                    icon: 'briefcase-outline' },
            { label: 'Completed',   value: stats.completed,                icon: 'checkmark-circle-outline' },
            { label: 'Earnings',    value: `GHS ${Math.round(stats.earnings)}`, icon: 'cash-outline', gold: true },
            { label: 'Rating',      value: stats.rating ? `${stats.rating}` : 'New', icon: 'star-outline', gold: true },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Ionicons name={s.icon} size={18} color={s.gold ? GOLD : MUTED} />
              <Text style={[styles.statVal, s.gold && { color: GOLD }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Profile completion checklist — incomplete profiles rank
            lower in search and get fewer bookings, so surface this
            until it's done */}
        {profile && (profile.profile_completion_percent ?? 0) < 100 && (
          <TouchableOpacity
            style={styles.checklistCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('WorkerProfileTab')}
          >
            <View style={styles.checklistHeader}>
              <Text style={styles.checklistTitle}>Finish your profile</Text>
              <Text style={styles.checklistPct}>{profile.profile_completion_percent ?? 0}%</Text>
            </View>
            <View style={styles.checklistBarBg}>
              <View style={[styles.checklistBarFill, { width: `${profile.profile_completion_percent ?? 0}%` }]} />
            </View>
            <Text style={styles.checklistSub}>
              Complete profiles get booked more. Add a bio, your rate, and portfolio photos.
            </Text>
          </TouchableOpacity>
        )}

        {/* Pending job requests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>New Requests</Text>
            {pendingJobs.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{pendingJobs.length}</Text>
              </View>
            )}
          </View>

          {pendingJobs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="hourglass-outline" size={32} color={MUTED} />
              <Text style={styles.emptyText}>No new requests right now</Text>
              <Text style={styles.emptySubText}>Stay available to receive job requests</Text>
            </View>
          ) : (
            pendingJobs.map(job => (
              <TouchableOpacity
                key={job.id}
                style={styles.jobCard}
                onPress={() => navigation.navigate('JobDetail', { job: {
                  id: job.id,
                  customerId: job.customer_id,
                  customer: job.users?.full_name || 'Customer',
                  phone:    job.users?.phone || '',
                  service:  job.description,
                  category: job.categories?.name || '',
                  location: job.location_address,
                  date:     new Date(job.scheduled_date).toDateString(),
                  time:     new Date(job.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  price:    `GHS ${job.agreed_price}`,
                  status:   job.status,
                  isEmergency: job.is_emergency || false,
                  postedAt: new Date(job.created_at).toLocaleString(),
                }})
                }
              >
                <View style={styles.jobTop}>
                  <View style={styles.customerAvatar}>
                    <Text style={styles.avatarInitial}>
                      {(job.users?.full_name || 'C')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.jobInfo}>
                    <Text style={styles.customerName}>{job.users?.full_name || 'Customer'}</Text>
                    <Text style={styles.jobService} numberOfLines={1}>{job.description}</Text>
                    <View style={styles.jobMeta}>
                      <Ionicons name="location-outline" size={12} color={MUTED} />
                      <Text style={styles.jobMetaText} numberOfLines={1}>{job.location_address}</Text>
                    </View>
                  </View>
                  <Text style={styles.jobPrice}>GHS {job.agreed_price}</Text>
                </View>
                <View style={styles.jobActions}>
                  <Text style={styles.jobTime}>
                    {new Date(job.scheduled_date).toLocaleDateString()} · {new Date(job.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <TouchableOpacity
                    style={styles.viewBtn}
                    onPress={() => navigation.navigate('JobDetail', { job: {
                      id: job.id, customer: job.users?.full_name, phone: job.users?.phone,
                      service: job.description, category: job.categories?.name,
                      location: job.location_address,
                      date: new Date(job.scheduled_date).toDateString(),
                      time: new Date(job.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      price: `GHS ${job.agreed_price}`, status: job.status,
                    }})}
                  >
                    <Text style={styles.viewBtnText}>View & Respond</Text>
                    <Ionicons name="arrow-forward" size={13} color={GOLD} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Active jobs */}
        {activeJobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Jobs</Text>
            {activeJobs.map(job => (
              <TouchableOpacity
                key={job.id}
                style={[styles.jobCard, { borderLeftWidth: 3, borderLeftColor: GOLD }]}
                onPress={() => navigation.navigate('JobDetail', { job: {
                  id: job.id, customer: job.users?.full_name, phone: job.users?.phone,
                  service: job.description, category: job.categories?.name,
                  location: job.location_address,
                  date: new Date(job.scheduled_date).toDateString(),
                  time: new Date(job.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  price: `GHS ${job.agreed_price}`, status: job.status,
                }})}
              >
                <View style={styles.jobTop}>
                  <View style={[styles.customerAvatar, { backgroundColor: 'rgba(212,160,23,0.2)' }]}>
                    <Text style={styles.avatarInitial}>{(job.users?.full_name || 'C')[0].toUpperCase()}</Text>
                  </View>
                  <View style={styles.jobInfo}>
                    <Text style={styles.customerName}>{job.users?.full_name}</Text>
                    <Text style={styles.jobService} numberOfLines={1}>{job.description}</Text>
                  </View>
                  <View style={styles.inProgressBadge}>
                    <Text style={styles.inProgressText}>
                      {job.status === 'in_progress' ? 'In Progress' : 'Confirmed'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Quick links */}
        <View style={styles.quickLinks}>
          {[
            { icon: 'calendar-outline',   label: 'Availability',  screen: 'AvailabilityCalendar' },
            { icon: 'trophy-outline',      label: 'Rankings',      screen: 'WorkerRankings' },
            { icon: 'cash-outline',        label: 'Earnings',      screen: 'Earnings' },
            { icon: 'images-outline',      label: 'Portfolio',     screen: 'PortfolioManager' },
            { icon: 'ribbon-outline',      label: 'Spotlight',     screen: 'SpotlightManager' },
            { icon: 'settings-outline',    label: 'Settings',      screen: 'WorkerSettings' },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.quickLink}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={styles.quickLinkIcon}>
                <Ionicons name={item.icon} size={22} color={GOLD} />
              </View>
              <Text style={styles.quickLinkLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: NAVY },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  greeting:         { fontSize: 20, fontWeight: '700', color: WHITE },
  subGreet:         { fontSize: 13, color: MUTED, marginTop: 2 },
  notifBtn:         { position: 'relative', width: 42, height: 42, borderRadius: 12, backgroundColor: NAVY2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER },
  badge:            { position: 'absolute', top: -4, right: -4, backgroundColor: Colors.error, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:        { fontSize: 10, color: WHITE, fontWeight: '700' },
  availCard:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  availLeft:        { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  availDot:         { width: 10, height: 10, borderRadius: 5 },
  availLabel:       { fontSize: 15, fontWeight: '700', color: WHITE },
  availSub:         { fontSize: 12, color: MUTED, marginTop: 2 },
  statsRow:         { flexDirection: 'row', marginHorizontal: 20, gap: 10, marginBottom: 20 },
  statCard:         { flex: 1, backgroundColor: NAVY2, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: BORDER },
  statVal:          { fontSize: 14, fontWeight: '800', color: WHITE },
  statLabel:        { fontSize: 10, color: MUTED, textAlign: 'center' },
  checklistCard: {
    backgroundColor: NAVY2, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)',
    padding: 16, marginHorizontal: 16, marginTop: 4, marginBottom: 4,
  },
  checklistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  checklistTitle: { color: WHITE, fontSize: 14, fontWeight: '700' },
  checklistPct: { color: GOLD, fontSize: 14, fontWeight: '800' },
  checklistBarBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  checklistBarFill: { height: 6, borderRadius: 3, backgroundColor: GOLD },
  checklistSub: { color: MUTED, fontSize: 11.5, marginTop: 8, lineHeight: 16 },
  section:          { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionTitle:     { fontSize: 16, fontWeight: '700', color: WHITE },
  countBadge:       { backgroundColor: Colors.error, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  countBadgeText:   { fontSize: 11, color: WHITE, fontWeight: '700' },
  emptyCard:        { backgroundColor: NAVY2, borderRadius: 14, padding: 28, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: BORDER },
  emptyText:        { fontSize: 15, color: MUTED, fontWeight: '600' },
  emptySubText:     { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
  jobCard:          { backgroundColor: NAVY2, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  jobTop:           { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  customerAvatar:   { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(212,160,23,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:    { fontSize: 16, fontWeight: '700', color: GOLD },
  jobInfo:          { flex: 1 },
  customerName:     { fontSize: 14, fontWeight: '700', color: WHITE },
  jobService:       { fontSize: 12, color: MUTED, marginTop: 2 },
  jobMeta:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  jobMetaText:      { fontSize: 11, color: MUTED },
  jobPrice:         { fontSize: 15, fontWeight: '700', color: GOLD },
  jobActions:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
  jobTime:          { fontSize: 12, color: MUTED },
  viewBtn:          { flexDirection: 'row', alignItems: 'center', gap: 5 },
  viewBtnText:      { fontSize: 13, color: GOLD, fontWeight: '600' },
  inProgressBadge:  { backgroundColor: 'rgba(212,160,23,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  inProgressText:   { fontSize: 12, color: GOLD, fontWeight: '600' },
  quickLinks:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  quickLink:        { width: '30%', backgroundColor: NAVY2, borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: BORDER },
  quickLinkIcon:    { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(212,160,23,0.1)', alignItems: 'center', justifyContent: 'center' },
  quickLinkLabel:   { fontSize: 12, color: MUTED, textAlign: 'center' },
  copyright:        { textAlign: 'center', color: 'rgba(212,160,23,0.3)', fontSize: 10, marginBottom: 10 },
});
