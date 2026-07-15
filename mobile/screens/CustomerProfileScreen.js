// © 2026 WiamApp. Powered by WiamLabs
// screens/CustomerProfileScreen.js
// Customer profile — edit info, verification status, bookings summary, settings
// Backend: GET /api/auth/me, PUT /api/users/profile

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import GoldAvatar from '../components/ui/GoldAvatar';

const PAD = Colors.screenPad;

const MENU_SECTIONS = [
  {
    title: 'BOOKINGS & ACTIVITY',
    items: [
      { icon: 'calendar-outline', label: 'My Bookings', sub: null, screen: 'Bookings' },
      { icon: 'heart-outline', label: 'Saved Workers', screen: null, comingSoon: true },
      { icon: 'star-outline', label: "Reviews I've Given", screen: 'MyReviews' },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { icon: 'person-outline', label: 'Edit Profile', screen: 'CustomerEditProfile' },
      { icon: 'shield-checkmark-outline', label: 'Identity Verification', screen: 'CustomerVerifyIntro' },
      { icon: 'settings-outline', label: 'Settings', screen: 'CustomerSettings' },
      { icon: 'notifications-outline', label: 'Notifications', screen: 'Notifications' },
      { icon: 'shield-outline', label: 'Safety & SOS', screen: 'CustomerSafety' },
    ],
  },
  {
    title: 'MORE',
    items: [
      { icon: 'help-circle-outline', label: 'Help Center', screen: null, external: 'https://wiamapp.com/help' },
      { icon: 'document-text-outline', label: 'Terms of Service', screen: null, external: 'https://wiamapp.com/terms' },
      { icon: 'shield-outline', label: 'Privacy Policy', screen: null, external: 'https://wiamapp.com/privacy' },
    ],
  },
];

function MenuRow({ icon, label, sub, onPress, danger }) {
  return (
    <TouchableOpacity style={s.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.menuIcon, danger && s.menuIconDanger]}>
        <Ionicons name={icon} size={17} color={danger ? Colors.error : Colors.gold} />
      </View>
      <View style={s.menuText}>
        <Text style={[s.menuTitle, danger && { color: Colors.error }]}>{label}</Text>
        {sub ? <Text style={s.menuSub}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} />
    </TouchableOpacity>
  );
}

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
    if (item.screen) navigation.navigate(item.screen);
  };

  const handleSignOut = () => {
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
  };

  const verificationStatus = user?.customer_verification_status || 'unverified';
  const verificationConfig = {
    unverified: { label: 'Not Verified', color: Colors.textDim, icon: 'shield-outline' },
    pending: { label: 'Under Review', color: Colors.warning, icon: 'time-outline' },
    verified: { label: 'Identity Confirmed', color: Colors.success, icon: 'shield-checkmark-outline' },
    suspended: { label: 'Suspended', color: Colors.error, icon: 'ban-outline' },
  };
  const vc = verificationConfig[verificationStatus];

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const locationLine = [user?.city, user?.country || 'Ghana'].filter(Boolean).join(', ');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.pageTitle}>Profile</Text>

        <LinearGradient
          colors={[Colors.navyCard, Colors.navySoft]}
          style={s.profileHero}
        >
          <View style={s.avatarWrap}>
            <GoldAvatar name={user?.full_name} uri={user?.avatar_url} size={74} />
            <TouchableOpacity
              style={s.camBadge}
              onPress={() => navigation.navigate('CustomerEditProfile')}
            >
              <Ionicons name="camera" size={13} color={Colors.navy} />
            </TouchableOpacity>
          </View>

          <Text style={s.profileName}>{user?.full_name || 'Customer'}</Text>
          <Text style={s.profileRole}>
            {user?.email}{locationLine ? ` · ${locationLine}` : ''}
          </Text>

          <TouchableOpacity
            style={[s.verifyBadge, { borderColor: `${vc.color}40`, backgroundColor: `${vc.color}14` }]}
            onPress={() => verificationStatus !== 'verified' && navigation.navigate('CustomerVerifyIntro')}
          >
            <Ionicons name={vc.icon} size={13} color={vc.color} />
            <Text style={[s.verifyBadgeText, { color: vc.color }]}>{vc.label}</Text>
            {verificationStatus !== 'verified' && (
              <Ionicons name="chevron-forward" size={12} color={vc.color} />
            )}
          </TouchableOpacity>

          <View style={s.statRow}>
            {[
              { label: 'Bookings', value: stats.bookings },
              { label: 'Reviews', value: stats.reviews },
            ].map((stat, i) => (
              <View key={stat.label} style={[s.statCol, i > 0 && s.statColBorder]}>
                <Text style={s.statNum}>{stat.value}</Text>
                <Text style={s.statCap}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {MENU_SECTIONS.map((section) => (
          <View key={section.title}>
            <Text style={s.sectionLabel}>{section.title}</Text>
            <View style={s.menuGroup}>
              {section.items.map((item, ii) => (
                <View key={item.label}>
                  {ii > 0 ? <View style={s.menuDivider} /> : null}
                  <MenuRow
                    icon={item.icon}
                    label={item.label}
                    sub={item.sub || (item.screen === 'Bookings' && stats.bookings === 0 ? 'No bookings yet' : null)}
                    onPress={() => handleMenu(item)}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={s.signOutBtn} onPress={signingOut ? null : handleSignOut} disabled={signingOut}>
          {signingOut ? (
            <ActivityIndicator color={Colors.error} size="small" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={16} color={Colors.error} />
              <Text style={s.signOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={s.footerCopy}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  scroll: { paddingHorizontal: PAD, paddingBottom: 30 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: Colors.white, marginTop: 4, marginBottom: 18 },
  profileHero: {
    borderRadius: Colors.cardRadius, padding: 22, paddingHorizontal: 18,
    alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: Colors.navyLine,
  },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  camBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.gold, borderWidth: 3, borderColor: Colors.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  profileName: { fontSize: 18, fontWeight: '700', color: Colors.white },
  profileRole: { fontSize: 12.5, color: Colors.textDim, marginTop: 3, marginBottom: 10, textAlign: 'center' },
  verifyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 4,
  },
  verifyBadgeText: { fontSize: 12, fontWeight: '600' },
  statRow: {
    flexDirection: 'row', width: '100%', marginTop: 18,
    borderTopWidth: 1, borderTopColor: Colors.navyLine, paddingTop: 16,
  },
  statCol: { flex: 1, alignItems: 'center' },
  statColBorder: { borderLeftWidth: 1, borderLeftColor: Colors.navyLine },
  statNum: { fontSize: 16, fontWeight: '700', color: Colors.white },
  statCap: { fontSize: 10, color: Colors.textFaint, marginTop: 3 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: Colors.textFaint,
    textTransform: 'uppercase', marginTop: 22, marginBottom: 10, marginLeft: 4,
  },
  menuGroup: {
    borderRadius: 20, backgroundColor: Colors.navyCard,
    borderWidth: 1, borderColor: Colors.navyLine, overflow: 'hidden',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, paddingHorizontal: 16 },
  menuDivider: { height: 1, backgroundColor: Colors.navyLine, marginLeft: 65 },
  menuIcon: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(212,160,23,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconDanger: { backgroundColor: 'rgba(239,68,68,0.1)' },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 13.5, fontWeight: '500', color: Colors.white },
  menuSub: { fontSize: 11, color: Colors.textFaint, marginTop: 2 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 24, padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  signOutText: { color: Colors.error, fontSize: 13.5, fontWeight: '600' },
  footerCopy: { textAlign: 'center', fontSize: 10, color: '#3A3A56', marginTop: 18 },
});
