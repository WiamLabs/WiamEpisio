// © 2026 WiamApp. Powered by WiamLabs
// screens/BusinessDashboardScreen.js — Part 13 lightweight Business Hub

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import VerifiedBadge from '../components/VerifiedBadge';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, goldGradient } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const PAD = Colors.screenPad;

const QUICK_ACTIONS = [
  {
    icon: 'megaphone-outline',
    title: 'Post to Spotlight',
    sub: 'Promote your business in the feed',
    onPress: (nav) => nav.navigate('SpotlightManager'),
  },
  {
    icon: 'search-outline',
    title: 'Hire a Worker',
    sub: 'Book directly from the marketplace',
    onPress: (nav) => nav.navigate('CustomerApp'),
  },
  {
    icon: 'calendar-outline',
    title: 'Active Bookings',
    sub: 'Workers currently on jobs',
    onPress: (nav) => nav.navigate('BizJobs'),
  },
  {
    icon: 'people-outline',
    title: 'My Team',
    sub: 'Manage business team members',
    onPress: (nav) => nav.navigate('BizTeam'),
  },
];

export default function BusinessDashboardScreen({ navigation }) {
  const { user } = useAuth();

  const [stats,      setStats]      = useState({ activeJobs: 0, teamSize: 0, monthlySpend: 0, completedJobs: 0 });
  const [bizProfile, setBizProfile] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        { data: allBookings },
        { count: teamSize },
        { data: bizData },
      ] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, status, agreed_price, created_at')
          .eq('business_id', user.id)
          .gte('created_at', monthStart),
        supabase
          .from('business_team_members')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', user.id)
          .eq('status', 'active'),
        supabase
          .from('business_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const bookings   = allBookings || [];
      const active     = bookings.filter(b => ['accepted', 'in_progress'].includes(b.status)).length;
      const completed  = bookings.filter(b => b.status === 'completed').length;
      const monthSpend = bookings
        .filter(b => b.status === 'completed')
        .reduce((s, b) => s + parseFloat(b.agreed_price || 0), 0);

      setStats({
        activeJobs:    active,
        teamSize:      teamSize || 0,
        monthlySpend:  monthSpend,
        completedJobs: completed,
      });
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

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Business Hub</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadDashboard(); }}
            tintColor={Colors.gold}
          />
        }
      >
        <LinearGradient
          colors={[Colors.navyCard, Colors.navySoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.businessCard}
        >
          <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bizAvatar}>
            <Text style={s.bizAvatarText}>{companyName.slice(0, 2).toUpperCase()}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <View style={s.bizNameRow}>
              <Text style={s.bizName} numberOfLines={1}>{companyName}</Text>
              {isGoldVerified ? <VerifiedBadge color="gold" size={14} /> : null}
            </View>
            <Text style={s.bizSub}>
              {isGoldVerified ? 'Gold Verified Business' : 'Business Account'}
            </Text>
          </View>
        </LinearGradient>

        <Text style={s.sectionLabel}>Quick Actions</Text>
        <View style={s.quickGrid}>
          {QUICK_ACTIONS.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={s.qaTile}
              onPress={() => item.onPress(navigation)}
              activeOpacity={0.85}
            >
              <View style={s.qaIcon}>
                <Ionicons name={item.icon} size={18} color={Colors.gold} />
              </View>
              <Text style={s.qaTitle}>{item.title}</Text>
              <Text style={s.qaSub}>
                {item.title === 'Active Bookings'
                  ? `${stats.activeJobs} worker${stats.activeJobs !== 1 ? 's' : ''} currently on jobs`
                  : item.sub}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionLabel}>This Month</Text>
        <View style={s.miniStats}>
          <View style={s.miniStat}>
            <Text style={s.miniStatValue}>{stats.completedJobs}</Text>
            <Text style={s.miniStatLabel}>Workers Hired</Text>
          </View>
          <View style={s.miniStat}>
            <Text style={s.miniStatValue}>{stats.teamSize}</Text>
            <Text style={s.miniStatLabel}>Team Members</Text>
          </View>
          <View style={s.miniStat}>
            <Text style={s.miniStatValue}>GHS {Math.round(stats.monthlySpend)}</Text>
            <Text style={s.miniStatLabel}>Spent</Text>
          </View>
        </View>

        <View style={s.webCard}>
          <View style={s.webIcon}>
            <Ionicons name="globe-outline" size={20} color={Colors.gold} />
          </View>
          <Text style={s.webTitle}>Full Business Dashboard</Text>
          <Text style={s.webSub}>
            Team management, bulk bookings, and advanced analytics are available on the WiamApp business portal.
          </Text>
          <TouchableOpacity
            style={s.webBtnWrap}
            onPress={() => navigation.navigate('WebView', { url: 'https://wiamapp.com/business', title: 'Business Portal' })}
            activeOpacity={0.85}
          >
            <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.webBtn}>
              <Text style={s.webBtnText}>Open wiamapp.com/business</Text>
              <Ionicons name="open-outline" size={14} color={Colors.navy} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={s.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.navy },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingBottom: 14 },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { color: Colors.white, fontSize: 17, fontWeight: '700' },

  businessCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 20, borderWidth: 1, borderColor: Colors.navyLine,
    marginBottom: 20,
  },
  bizAvatar:     { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bizAvatarText: { color: Colors.navy, fontWeight: '800', fontSize: 18 },
  bizNameRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bizName:       { fontSize: 14.5, fontWeight: '700', color: Colors.white, flexShrink: 1 },
  bizSub:        { fontSize: 11, color: Colors.textFaint, marginTop: 2 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.6,
    color: Colors.textFaint, textTransform: 'uppercase',
    marginBottom: 12, marginLeft: 4,
  },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  qaTile: {
    width: '48%', backgroundColor: Colors.navyCard, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.navyLine, padding: 16, gap: 10,
  },
  qaIcon: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(212,160,23,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  qaTitle: { fontSize: 13, fontWeight: '700', color: Colors.white },
  qaSub:   { fontSize: 10.5, color: Colors.textFaint, lineHeight: 15 },

  miniStats: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  miniStat: {
    flex: 1, backgroundColor: Colors.navyCard, borderWidth: 1, borderColor: Colors.navyLine,
    borderRadius: 16, padding: 13, alignItems: 'center',
  },
  miniStatValue: { fontSize: 16, fontWeight: '700', color: Colors.white },
  miniStatLabel: { fontSize: 10, color: Colors.textFaint, marginTop: 4, textAlign: 'center' },

  webCard: {
    borderRadius: 20, padding: 18, alignItems: 'center',
    backgroundColor: 'rgba(212,160,23,0.06)', borderWidth: 1.5, borderColor: Colors.gold,
  },
  webIcon: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: 'rgba(212,160,23,0.14)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  webTitle: { fontSize: 13.5, fontWeight: '700', color: Colors.white, marginBottom: 6 },
  webSub: {
    fontSize: 11.5, color: Colors.textDim, lineHeight: 18,
    textAlign: 'center', marginBottom: 14,
  },
  webBtnWrap: { alignSelf: 'stretch' },
  webBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, paddingHorizontal: 22, borderRadius: 14,
  },
  webBtnText: { color: Colors.navy, fontSize: 12.5, fontWeight: '700' },

  copyright: { textAlign: 'center', fontSize: 10, color: '#3A3A56', paddingTop: 18 },
});
