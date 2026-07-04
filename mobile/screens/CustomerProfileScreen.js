// © 2026 WiamApp. Powered by WiamLabs
// screens/CustomerProfileScreen.js
// Customer profile — edit info, verification status, bookings summary, settings
// Backend: GET /api/auth/me, PUT /api/users/profile

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, Image, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const BG      = '#FFFFFF';
const NAVY    = '#0D0D2B';
const GOLD    = '#D4A017';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const BORDER  = '#EBEBEB';
const MUTED   = '#888899';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

const MENU_SECTIONS = [
  {
    title: 'Account',
    items: [
      { icon: 'person-outline',           label: 'Edit Profile',         screen: 'CustomerEditProfile' },
      { icon: 'shield-checkmark-outline', label: 'Identity Verification',screen: 'CustomerVerifyIntro' },
      { icon: 'settings-outline',         label: 'Settings',             screen: 'CustomerSettings' },
      { icon: 'notifications-outline',    label: 'Notifications',        screen: 'Notifications' },
      { icon: 'lock-closed-outline',      label: 'Change Password',      screen: 'ForgotPassword' },
    ],
  },
  {
    title: 'Bookings',
    items: [
      { icon: 'calendar-outline',         label: 'My Bookings',          screen: 'Bookings' },
      { icon: 'star-outline',             label: 'My Reviews',           screen: 'MyReviews' },
      { icon: 'heart-outline',            label: 'Saved Workers',        screen: null, comingSoon: true },
    ],
  },
  {
    title: 'Safety',
    items: [
      { icon: 'alert-circle-outline',     label: 'Safety Settings',      screen: 'CustomerSafety' },
    ],
  },
  {
    title: 'More',
    items: [
      { icon: 'help-circle-outline',      label: 'Help Center',          screen: null, external: 'https://wiamapp.com/help' },
      { icon: 'document-text-outline',    label: 'Terms of Service',     screen: null, external: 'https://wiamapp.com/terms' },
      { icon: 'shield-outline',           label: 'Privacy Policy',       screen: null, external: 'https://wiamapp.com/privacy' },
      { icon: 'log-out-outline',          label: 'Sign Out',             screen: 'Logout', danger: true },
    ],
  },
];

export default function CustomerProfileScreen({ navigation }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({ bookings: 0, reviews: 0 });
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      if (!user?.id) { setLoading(false); return; }
      try {
        const [{ count: bookingsCount }, { count: reviewsCount }] = await Promise.all([
          supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_id', user.id),
          supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('customer_id', user.id),
        ]);
        setStats({ bookings: bookingsCount || 0, reviews: reviewsCount || 0 });
      } catch (e) {
        console.warn('CustomerProfile stats error:', e.message);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [user?.id]);

  const handleMenu = (item) => {
    if (item.comingSoon) {
      Alert.alert('Coming Soon', `${item.label} isn't available yet — we're working on it.`);
      return;
    }
    if (item.external) {
      Linking.openURL(item.external);
      return;
    }
    if (item.screen === 'Logout') {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await supabase.auth.signOut();
            } catch (e) {
              console.warn('Sign out error:', e.message);
            } finally {
              setSigningOut(false);
              navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
            }
          },
        },
      ]);
      return;
    }
    if (item.screen) navigation.navigate(item.screen);
  };

  const verificationStatus = user?.customer_verification_status || 'unverified';
  const verificationConfig = {
    unverified: { label: 'Not Verified',   color: MUTED,      icon: 'shield-outline' },
    pending:    { label: 'Under Review',   color: '#F59E0B',  icon: 'time-outline' },
    verified:   { label: 'Identity Confirmed', color: '#22C55E',  icon: 'shield-checkmark-outline' },
    suspended:  { label: 'Suspended',      color: '#EF4444',  icon: 'ban-outline' },
  };
  const vc = verificationConfig[verificationStatus];

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <ActivityIndicator color={GOLD} style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={s.header}>
        <Text style={s.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={22} color={NAVY} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatarWrap}>
            {user?.avatar_url
              ? <Image source={{ uri: user.avatar_url }} style={s.avatar} />
              : <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInitial}>{user?.full_name?.[0]?.toUpperCase() || 'U'}</Text>
                </View>
            }
            <TouchableOpacity style={s.editAvatarBtn}>
              <Ionicons name="camera-outline" size={14} color={NAVY} />
            </TouchableOpacity>
          </View>

          <Text style={s.userName}>{user?.full_name || 'Customer'}</Text>
          <Text style={s.userEmail}>{user?.email}</Text>
          <Text style={s.userLocation}>
            <Ionicons name="location-outline" size={12} color={MUTED} /> {user?.city}, {user?.country || 'Ghana'}
          </Text>

          {/* Verification badge */}
          <TouchableOpacity
            style={[s.verifyBadge, { borderColor: vc.color + '40', backgroundColor: vc.color + '10' }]}
            onPress={() => verificationStatus !== 'verified' && navigation.navigate('CustomerVerifyIntro')}
          >
            <Ionicons name={vc.icon} size={13} color={vc.color} />
            <Text style={[s.verifyBadgeText, { color: vc.color }]}>{vc.label}</Text>
            {verificationStatus !== 'verified' && (
              <Ionicons name="chevron-forward" size={12} color={vc.color} />
            )}
          </TouchableOpacity>
        </View>

        {/* Quick stats */}
        <View style={s.statsRow}>
          {[
            { label: 'Bookings', value: stats.bookings },
            { label: 'Reviews Left', value: stats.reviews },
          ].map((stat, i) => (
            <View key={i} style={[s.statItem, i > 0 && s.statItemBorder]}>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu sections */}
        {MENU_SECTIONS.map((section, si) => (
          <View key={si} style={s.menuSection}>
            <Text style={s.menuSectionTitle}>{section.title}</Text>
            <View style={s.menuCard}>
              {section.items.map((item, ii) => (
                <TouchableOpacity
                  key={ii}
                  style={[s.menuItem, ii > 0 && s.menuItemBorder]}
                  onPress={() => handleMenu(item)}
                  activeOpacity={0.7}
                >
                  <View style={[s.menuIcon, item.danger && s.menuIconDanger]}>
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={item.danger ? '#EF4444' : GOLD}
                    />
                  </View>
                  <Text style={[s.menuLabel, item.danger && s.menuLabelDanger]}>
                    {item.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color="#CCC" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={s.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F5F5F8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: BG, borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  headerTitle: { color: NAVY, fontSize: 22, fontWeight: '700' },

  profileCard: {
    backgroundColor: BG, marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, padding: 20, alignItems: 'center',
    borderWidth: 0.5, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatarWrap:    { position: 'relative', marginBottom: 12 },
  avatar:        { width: 80, height: 80, borderRadius: 22 },
  avatarFallback:{ backgroundColor: GOLD_BG, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: GOLD, fontSize: 30, fontWeight: '700' },
  editAvatarBtn: {
    position: 'absolute', bottom: -2, right: -2,
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: GOLD, borderWidth: 2, borderColor: BG,
    alignItems: 'center', justifyContent: 'center',
  },
  userName:     { color: NAVY, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  userEmail:    { color: MUTED, fontSize: 13, marginBottom: 4 },
  userLocation: { color: MUTED, fontSize: 12, marginBottom: 12 },
  verifyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 0.5, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  verifyBadgeText: { fontSize: 12, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row', backgroundColor: BG,
    marginHorizontal: 16, marginTop: 10, borderRadius: 14,
    borderWidth: 0.5, borderColor: BORDER, overflow: 'hidden',
  },
  statItem:       { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statItemBorder: { borderLeftWidth: 0.5, borderLeftColor: BORDER },
  statValue:      { color: NAVY, fontSize: 20, fontWeight: '700', marginBottom: 3 },
  statLabel:      { color: MUTED, fontSize: 11 },

  menuSection:      { marginHorizontal: 16, marginTop: 16 },
  menuSectionTitle: { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  menuCard: {
    backgroundColor: BG, borderRadius: 14,
    borderWidth: 0.5, borderColor: BORDER, overflow: 'hidden',
  },
  menuItem:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuItemBorder: { borderTopWidth: 0.5, borderTopColor: BORDER },
  menuIcon:       { width: 36, height: 36, borderRadius: 10, backgroundColor: GOLD_BG, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  menuIconDanger: { backgroundColor: 'rgba(239,68,68,0.08)' },
  menuLabel:      { color: NAVY, fontSize: 14, fontWeight: '500', flex: 1 },
  menuLabelDanger:{ color: '#EF4444' },

  copyright: { color: MUTED, fontSize: 11, textAlign: 'center', marginTop: 20 },
});
