// © 2026 WiamApp. Powered by WiamLabs
// screens/BusinessDashboardScreen.js — PRODUCTION real Supabase data

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VerifiedBadge from '../components/VerifiedBadge';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const NAVY  = Colors.navyDeep;
const NAVY2 = Colors.navyMid;
const GOLD  = Colors.gold;
const WHITE = Colors.white;
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER= 'rgba(255,255,255,0.09)';

export default function BusinessDashboardScreen({ navigation }) {
  const { user } = useAuth();

  const [stats,      setStats]      = useState({ activeJobs: 0, teamSize: 0, monthlySpend: 0, pendingJobs: 0, completedJobs: 0 });
  const [recentJobs, setRecentJobs] = useState([]);
  const [bizProfile, setBizProfile] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const now         = new Date();
      const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Run all queries in parallel
      const [
        { data: allBookings },
        { count: teamSize },
        { data: recentData },
        { data: bizData },
      ] = await Promise.all([
        // All bookings for this business this month
        supabase
          .from('bookings')
          .select('id, status, agreed_price, description, scheduled_date, created_at, worker_profiles(users(full_name)), categories(name)')
          .eq('business_id', user.id)
          .gte('created_at', monthStart),

        // Team member count
        supabase
          .from('business_team_members')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', user.id)
          .eq('status', 'active'),

        // 5 most recent bookings
        supabase
          .from('bookings')
          .select('id, status, description, agreed_price, scheduled_date, worker_profiles(users(full_name)), categories(name)')
          .eq('business_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),

        // Company profile — real name and Gold verification status,
        // never fetched before, which is why the greeting fell back
        // to the owner's personal name and the badge always showed.
        supabase
          .from('business_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const bookings     = allBookings || [];
      const active       = bookings.filter(b => ['accepted', 'in_progress'].includes(b.status)).length;
      const pending      = bookings.filter(b => b.status === 'pending').length;
      const completed    = bookings.filter(b => b.status === 'completed').length;
      const monthSpend   = bookings
        .filter(b => b.status === 'completed')
        .reduce((s, b) => s + parseFloat(b.agreed_price || 0), 0);

      setStats({
        activeJobs:   active,
        teamSize:     teamSize || 0,
        monthlySpend: monthSpend,
        pendingJobs:  pending,
        completedJobs: completed,
      });
      setRecentJobs(recentData || []);
      setBizProfile(bizData || null);
    } catch (e) {
      console.warn('BusinessDashboard error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadDashboard(); }, [user?.id]));

  const companyName    = bizProfile?.company_name || user?.full_name || 'Your Business';
  const isGoldVerified = bizProfile?.business_verified_gold || false;
  const hour        = new Date().getHours();
  const greeting    = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const STATUS_COLOR = {
    pending:     { color: Colors.warning, label: 'Pending' },
    accepted:    { color: '#3B82F6',      label: 'Confirmed' },
    in_progress: { color: GOLD,           label: 'In Progress' },
    completed:   { color: Colors.success, label: 'Completed' },
    cancelled:   { color: Colors.error,   label: 'Cancelled' },
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={GOLD} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} tintColor={GOLD} />}
      >

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greeting}</Text>
            <Text style={s.bizName} numberOfLines={1}>{companyName}</Text>
            {isGoldVerified && (
              <View style={s.verifiedBadge}>
                <VerifiedBadge color="gold" size={12} />
                <Text style={s.verifiedText}>Gold Verified</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={s.avatarBtn}
            onPress={() => navigation.navigate('BizProfile')}
          >
            <View style={s.avatar}>
              <Text style={s.avatarInitial}>{companyName[0]?.toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          {[
            { label: 'Active Jobs',  value: stats.activeJobs,   icon: 'construct-outline',    color: '#3B82F6' },
            { label: 'Team Members', value: stats.teamSize,      icon: 'people-outline',       color: Colors.success },
            { label: 'This Month',   value: `GHS ${Math.round(stats.monthlySpend)}`, icon: 'cash-outline', color: GOLD },
            { label: 'Pending',      value: stats.pendingJobs,  icon: 'time-outline',         color: Colors.warning },
          ].map((item, i) => (
            <View key={i} style={s.statCard}>
              <View style={[s.statIconBox, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={[s.statVal, { color: item.color }]}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick actions */}
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.quickActions}>
          {[
            { icon: 'add-circle-outline', label: 'Book Worker',  color: GOLD,           onPress: () => navigation.navigate('CustomerApp') },
            { icon: 'people-outline',     label: 'My Team',      color: '#3B82F6',      onPress: () => navigation.navigate('BizTeam') },
            { icon: 'briefcase-outline',  label: 'Bookings',     color: Colors.success, onPress: () => navigation.navigate('BizJobs') },
            { icon: 'person-outline',     label: 'Profile',      color: '#9B59B6',      onPress: () => navigation.navigate('BizProfile') },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={s.quickAction} onPress={item.onPress}>
              <View style={[s.quickIcon, { backgroundColor: `${item.color}18` }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={s.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent bookings */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Recent Bookings</Text>
          <TouchableOpacity onPress={() => navigation.navigate('BizJobs')}>
            <Text style={s.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {recentJobs.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="briefcase-outline" size={36} color={MUTED} />
            <Text style={s.emptyText}>No bookings yet</Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => navigation.navigate('CustomerApp')}
            >
              <Text style={s.emptyBtnText}>Book Your First Worker</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recentJobs.map(job => {
            const sc = STATUS_COLOR[job.status] || STATUS_COLOR.pending;
            return (
              <View key={job.id} style={s.jobCard}>
                <View style={s.jobLeft}>
                  <View style={s.jobIcon}>
                    <Ionicons name="construct-outline" size={18} color={GOLD} />
                  </View>
                  <View style={s.jobInfo}>
                    <Text style={s.jobDesc} numberOfLines={1}>{job.description}</Text>
                    <View style={s.jobWorkerRow}>
                      <Ionicons name="person-outline" size={11} color={MUTED} />
                      <Text style={s.jobWorker}>
                        {job.worker_profiles?.users?.full_name || 'Unassigned'}
                      </Text>
                    </View>
                    <Text style={s.jobDate}>
                      {new Date(job.scheduled_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })} ·{' '}
                      {new Date(job.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={s.jobPrice}>GHS {parseFloat(job.agreed_price || 0).toFixed(0)}</Text>
                  <View style={[s.statusPill, { backgroundColor: `${sc.color}18` }]}>
                    <Text style={[s.statusText, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* Summary tip */}
        {stats.completedJobs > 0 && (
          <View style={s.tipCard}>
            <Ionicons name="trending-up-outline" size={18} color={GOLD} />
            <Text style={s.tipText}>
              Your team completed <Text style={{ color: GOLD, fontWeight: '700' }}>{stats.completedJobs} job{stats.completedJobs !== 1 ? 's' : ''}</Text> this month, spending <Text style={{ color: GOLD, fontWeight: '700' }}>GHS {Math.round(stats.monthlySpend)}</Text> in total.
            </Text>
          </View>
        )}

        <Text style={s.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: NAVY },
  header:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  greeting:      { fontSize: 14, color: MUTED, marginBottom: 4 },
  bizName:       { fontSize: 22, fontWeight: '800', color: WHITE, marginBottom: 6 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(212,160,23,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.3)' },
  verifiedText:  { fontSize: 11, color: GOLD, fontWeight: '500' },
  avatarBtn:     { marginLeft: 10 },
  avatar:        { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(212,160,23,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: GOLD },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: GOLD },
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  statCard:      { width: '47%', backgroundColor: NAVY2, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER },
  statIconBox:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statVal:       { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  statLabel:     { fontSize: 12, color: MUTED },
  sectionRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: WHITE, paddingHorizontal: 20, marginBottom: 12 },
  seeAll:        { fontSize: 13, color: GOLD, fontWeight: '600', paddingHorizontal: 20 },
  quickActions:  { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 24 },
  quickAction:   { flex: 1, backgroundColor: NAVY2, borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: BORDER },
  quickIcon:     { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickLabel:    { fontSize: 12, color: MUTED, textAlign: 'center' },
  emptyCard:     { backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 14, padding: 30, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: BORDER, marginBottom: 14 },
  emptyText:     { fontSize: 15, color: MUTED, fontWeight: '500' },
  emptyBtn:      { backgroundColor: GOLD, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText:  { color: NAVY, fontWeight: '700', fontSize: 13 },
  jobCard:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  jobLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  jobIcon:       { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(212,160,23,0.1)', alignItems: 'center', justifyContent: 'center' },
  jobInfo:       { flex: 1 },
  jobDesc:       { fontSize: 14, fontWeight: '700', color: WHITE },
  jobWorkerRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  jobWorker:     { fontSize: 12, color: MUTED },
  jobDate:       { fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 },
  jobPrice:      { fontSize: 14, fontWeight: '700', color: GOLD },
  statusPill:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:    { fontSize: 11, fontWeight: '600' },
  tipCard:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(212,160,23,0.07)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.2)', borderRadius: 14, padding: 14, marginHorizontal: 20, marginTop: 6, marginBottom: 14 },
  tipText:       { flex: 1, fontSize: 13, color: MUTED, lineHeight: 20 },
  copyright:     { textAlign: 'center', color: 'rgba(212,160,23,0.25)', fontSize: 10, marginTop: 10 },
});
