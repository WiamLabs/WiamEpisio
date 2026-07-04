// © 2026 WiamApp. Powered by WiamLabs
// screens/BusinessProfileScreen.js — PRODUCTION real Supabase data

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Alert, ActivityIndicator,
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

export default function BusinessProfileScreen({ navigation }) {
  const { user } = useAuth();

  const [bizProfile, setBizProfile] = useState(null);
  const [stats,      setStats]      = useState({ totalJobs: 0, totalSpend: 0, teamSize: 0 });
  const [loading,    setLoading]    = useState(true);

  const load = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      // Load business profile
      const { data: bp } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      setBizProfile(bp || null);

      // Load stats
      const [
        { data: bookings },
        { count: teamCount },
      ] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, status, agreed_price')
          .eq('business_id', user.id),
        supabase
          .from('business_team_members')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', user.id)
          .eq('status', 'active'),
      ]);

      const completed = (bookings || []).filter(b => b.status === 'completed');
      const totalSpend = completed.reduce((s, b) => s + parseFloat(b.agreed_price || 0), 0);

      setStats({
        totalJobs:  (bookings || []).length,
        totalSpend,
        teamSize:   teamCount || 0,
      });
    } catch (e) {
      console.warn('BusinessProfile load error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [user?.id]));

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try { await supabase.auth.signOut(); } catch {}
          navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
        },
      },
    ]);
  };

  const companyName = bizProfile?.company_name || user?.full_name || 'Your Business';
  const planLabel   = bizProfile?.plan
    ? bizProfile.plan.charAt(0).toUpperCase() + bizProfile.plan.slice(1) + ' Plan'
    : 'Free Plan';
  // Gold checkmark is manually approved by WiamLabs staff after
  // document review (Section 8B) — never the identity-check field.
  const isGoldVerified = bizProfile?.business_verified_gold || false;

  const menuItems = [
    {
      icon: 'analytics-outline',
      label: 'Analytics',
      sub: `${stats.totalJobs} total jobs · GHS ${Math.round(stats.totalSpend)} spent`,
      onPress: () => navigation.navigate('BizJobs'),
    },
    {
      icon: 'people-outline',
      label: 'My Team',
      sub: `${stats.teamSize} active team member${stats.teamSize !== 1 ? 's' : ''}`,
      onPress: () => navigation.navigate('BizTeam'),
    },
    {
      icon: 'card-outline',
      label: 'Billing & Plan',
      sub: planLabel,
      onPress: () => navigation.navigate('BusinessApplication'),
    },
    {
      icon: 'desktop-outline',
      label: 'Web Dashboard',
      sub: 'wiamapp.com/business',
      onPress: () => Alert.alert('Web Dashboard', 'Visit wiamapp.com/business on your laptop to manage your full business account.'),
    },
    {
      icon: 'shield-checkmark-outline',
      label: 'Verification Status',
      sub: isGoldVerified ? 'Gold Verified' : 'Pending Review',
      onPress: () => Alert.alert(
        isGoldVerified ? 'Gold Verified' : 'Pending Review',
        isGoldVerified
          ? 'Your business is Gold Verified. The badge shows on your profile and bookings.'
          : 'Our team is reviewing your business documents. You will be notified once approved — this usually takes 24-48 hours.'
      ),
    },
    {
      icon: 'help-circle-outline',
      label: 'Help & Support',
      sub: 'support@wiamapp.com',
      onPress: () => Alert.alert('Support', 'Email: support@wiamapp.com'),
    },
  ];

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
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile header */}
        <View style={s.header}>
          <View style={s.avatarBox}>
            <Text style={s.avatarText}>{companyName[0]?.toUpperCase()}</Text>
          </View>
          <Text style={s.bizName}>{companyName}</Text>
          {isGoldVerified && (
            <View style={s.verifiedBadge}>
              <VerifiedBadge color="gold" size={13} />
              <Text style={s.verifiedText}>Gold Verified</Text>
            </View>
          )}
          <Text style={s.planText}>{planLabel}</Text>
          {bizProfile?.industry ? (
            <Text style={s.industryText}>{bizProfile.industry}</Text>
          ) : null}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statVal}>{stats.totalJobs}</Text>
            <Text style={s.statLabel}>Total Jobs</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: GOLD }]}>GHS {Math.round(stats.totalSpend)}</Text>
            <Text style={s.statLabel}>Total Spent</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: Colors.success }]}>{stats.teamSize}</Text>
            <Text style={s.statLabel}>Team Members</Text>
          </View>
        </View>

        {/* Menu */}
        <View style={s.menu}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[s.menuRow, i === menuItems.length - 1 && { borderBottomWidth: 0 }]}
              onPress={item.onPress}
            >
              <View style={s.menuIcon}>
                <Ionicons name={item.icon} size={18} color={GOLD} />
              </View>
              <View style={s.menuText}>
                <Text style={s.menuLabel}>{item.label}</Text>
                {item.sub ? <Text style={s.menuSub}>{item.sub}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={MUTED} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={s.copy}>© 2026 WiamApp · Powered by WiamLabs</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: NAVY },
  header:        { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  avatarBox:     { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(212,160,23,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: GOLD, marginBottom: 14 },
  avatarText:    { fontSize: 32, fontWeight: '800', color: GOLD },
  bizName:       { fontSize: 22, fontWeight: '800', color: WHITE, textAlign: 'center', marginBottom: 8 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(212,160,23,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 0.5, borderColor: 'rgba(212,160,23,0.3)', marginBottom: 6 },
  verifiedText:  { fontSize: 12, color: GOLD, fontWeight: '500' },
  planText:      { fontSize: 14, color: MUTED, marginBottom: 4 },
  industryText:  { fontSize: 13, color: 'rgba(255,255,255,0.3)' },
  statsRow:      { flexDirection: 'row', backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 16, paddingVertical: 16, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  stat:          { flex: 1, alignItems: 'center' },
  statVal:       { fontSize: 18, fontWeight: '800', color: WHITE, marginBottom: 3 },
  statLabel:     { fontSize: 11, color: MUTED },
  statDiv:       { width: 1, backgroundColor: BORDER, marginVertical: 4 },
  menu:          { backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: BORDER, marginBottom: 14 },
  menuRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, gap: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  menuIcon:      { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(212,160,23,0.1)', alignItems: 'center', justifyContent: 'center' },
  menuText:      { flex: 1 },
  menuLabel:     { fontSize: 15, color: WHITE, fontWeight: '500' },
  menuSub:       { fontSize: 12, color: MUTED, marginTop: 2 },
  signOutBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 14, paddingVertical: 14, marginBottom: 16 },
  signOutText:   { fontSize: 15, color: Colors.error, fontWeight: '600' },
  copy:          { color: 'rgba(212,160,23,0.25)', fontSize: 10, textAlign: 'center' },
});
