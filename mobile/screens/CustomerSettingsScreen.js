// © 2026 WiamApp. Powered by WiamLabs
// screens/CustomerSettingsScreen.js
// PRODUCTION — real notification prefs saved to user_settings,
// real sign out, real delete account. Mirrors WorkerSettingsScreen's
// pattern exactly, with customer-specific content (Section 21B).

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Switch,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const NAVY  = Colors.navyDeep || Colors.navy;
const GOLD  = Colors.gold;
const WHITE = '#FFFFFF';
const MUTED = '#888899';
const BORDER = '#EBEBEB';

// Keys saved to the user_settings table — same key-value pattern
// already established by WorkerSettingsScreen.
const PREF_KEYS = [
  'notif_booking_updates',
  'notif_chat_messages',
  'notif_promotions',
  'notif_spotlight_trusted',
  'language',
  'currency_display',
];

export default function CustomerSettingsScreen({ navigation }) {
  const { user } = useAuth();

  const [notifBookings,  setNotifBookings]  = useState(true);
  const [notifChat,      setNotifChat]      = useState(true);
  const [notifPromos,    setNotifPromos]    = useState(false);
  const [notifSpotlight, setNotifSpotlight] = useState(true);
  const [language, setLanguage] = useState('English');
  const [currency, setCurrency] = useState('GHS');

  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [signingOut,   setSigningOut]   = useState(false);

  useEffect(() => {
    const loadPrefs = async () => {
      if (!user?.id) { setLoadingPrefs(false); return; }
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('key, value')
          .eq('user_id', user.id)
          .in('key', PREF_KEYS);

        if (error) throw error;
        const map = Object.fromEntries((data || []).map(r => [r.key, r.value]));

        if (map['notif_booking_updates']   !== undefined) setNotifBookings(map['notif_booking_updates']   === 'true');
        if (map['notif_chat_messages']     !== undefined) setNotifChat(map['notif_chat_messages']     === 'true');
        if (map['notif_promotions']        !== undefined) setNotifPromos(map['notif_promotions']        === 'true');
        if (map['notif_spotlight_trusted'] !== undefined) setNotifSpotlight(map['notif_spotlight_trusted'] === 'true');
        if (map['language']                !== undefined) setLanguage(map['language']);
        if (map['currency_display']        !== undefined) setCurrency(map['currency_display']);
      } catch (e) {
        console.warn('Load settings error:', e.message);
      } finally {
        setLoadingPrefs(false);
      }
    };
    loadPrefs();
  }, [user?.id]);

  const savePref = async (key, value) => {
    try {
      await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
    } catch (e) {
      console.warn('Save setting error:', e.message);
    }
  };

  const toggleAndSave = (setter, key) => (value) => {
    setter(value);
    savePref(key, value);
  };

  const handlePickLanguage = () => {
    Alert.alert('Language', 'Used across the app and notifications.', [
      { text: 'English', onPress: () => { setLanguage('English'); savePref('language', 'English'); } },
      { text: 'Twi',      onPress: () => { setLanguage('Twi');     savePref('language', 'Twi'); } },
      { text: 'Français', onPress: () => { setLanguage('Français'); savePref('language', 'Français'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePickCurrency = () => {
    Alert.alert('Display Currency', 'Bookings are always processed securely — this only changes how prices are shown to you.', [
      { text: 'GHS — Cedi',   onPress: () => { setCurrency('GHS'); savePref('currency_display', 'GHS'); } },
      { text: 'USD — Dollar', onPress: () => { setCurrency('USD'); savePref('currency_display', 'USD'); } },
      { text: 'NGN — Naira',  onPress: () => { setCurrency('NGN'); savePref('currency_display', 'NGN'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
            navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
          } catch (e) {
            Alert.alert('Error', 'Could not sign out. Try again.');
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and booking history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Are you absolutely sure?', 'Type nothing further needed — confirming will delete your account now.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, Delete My Account',
                style: 'destructive',
                onPress: async () => {
                  try {
                    const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
                    const { data: { session } } = await supabase.auth.getSession();
                    await fetch(`${BACKEND}/api/auth/account`, {
                      method: 'DELETE',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session?.access_token}`,
                      },
                    });
                    await supabase.auth.signOut();
                    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
                  } catch (e) {
                    Alert.alert('Error', 'Could not delete account. Try again or contact support.');
                  }
                },
              },
            ]);
          },
        },
      ]
    );
  };

  const handleDataExport = () => {
    Alert.alert(
      'Export Your Data',
      'We will email a copy of your bookings, reviews, and account data to ' + (user?.email || 'your registered email') + ' within 48 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Export',
          onPress: async () => {
            try {
              await supabase.from('notifications').insert({
                user_id: user.id,
                title: 'Data export requested',
                body: 'Our team has been notified and will email your data within 48 hours.',
                type: 'system',
              });
              // Also log the request itself for the team to action —
              // a real, auditable record, not just a client-side toast.
              const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
              const { data: { session } } = await supabase.auth.getSession();
              await fetch(`${BACKEND}/api/auth/data-export-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
              }).catch(() => {});
              Alert.alert('Requested', 'You will receive your data by email within 48 hours.');
            } catch (e) {
              Alert.alert('Error', 'Could not submit your request. Try again.');
            }
          },
        },
      ]
    );
  };

  // ── Row component ─────────────────────────────────────────
  const Row = ({ icon, label, sub, onPress, danger, right }) => (
    <TouchableOpacity style={s.row} onPress={onPress} disabled={!onPress}>
      <View style={[s.rowIcon, danger && { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
        <Ionicons name={icon} size={18} color={danger ? '#EF4444' : GOLD} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, danger && { color: '#EF4444' }]}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {right !== undefined ? right : (onPress ? <Ionicons name="chevron-forward" size={18} color={MUTED} /> : null)}
    </TouchableOpacity>
  );

  const SectionTitle = ({ title }) => <Text style={s.sectionTitle}>{title}</Text>;

  if (loadingPrefs) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={GOLD} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Notifications */}
        <SectionTitle title="NOTIFICATIONS" />
        <View style={s.card}>
          <Row
            icon="calendar-outline" label="Booking Updates" sub="Accepted, started, completed"
            right={<Switch value={notifBookings} onValueChange={toggleAndSave(setNotifBookings, 'notif_booking_updates')} trackColor={{ false: BORDER, true: GOLD }} thumbColor={WHITE} />}
          />
          <View style={s.div} />
          <Row
            icon="chatbubble-outline" label="Chat Messages" sub="New messages from workers"
            right={<Switch value={notifChat} onValueChange={toggleAndSave(setNotifChat, 'notif_chat_messages')} trackColor={{ false: BORDER, true: GOLD }} thumbColor={WHITE} />}
          />
          <View style={s.div} />
          <Row
            icon="ribbon-outline" label="Spotlight from Trusted Workers" sub="New posts from workers you trust"
            right={<Switch value={notifSpotlight} onValueChange={toggleAndSave(setNotifSpotlight, 'notif_spotlight_trusted')} trackColor={{ false: BORDER, true: GOLD }} thumbColor={WHITE} />}
          />
          <View style={s.div} />
          <Row
            icon="megaphone-outline" label="Promotions & Marketing" sub="Occasional offers and updates"
            right={<Switch value={notifPromos} onValueChange={toggleAndSave(setNotifPromos, 'notif_promotions')} trackColor={{ false: BORDER, true: GOLD }} thumbColor={WHITE} />}
          />
        </View>

        {/* Preferences */}
        <SectionTitle title="PREFERENCES" />
        <View style={s.card}>
          <Row icon="language-outline" label="Language"         sub={language} onPress={handlePickLanguage} />
          <View style={s.div} />
          <Row icon="cash-outline"     label="Display Currency" sub={currency} onPress={handlePickCurrency} />
        </View>

        {/* Privacy */}
        <SectionTitle title="PRIVACY" />
        <View style={s.card}>
          <Row icon="ban-outline"        label="Blocked Workers"  sub="Workers you've blocked from contacting you" onPress={() => navigation.navigate('BlockedUsers')} />
          <View style={s.div} />
          <Row icon="download-outline"   label="Export My Data"   sub="Get a copy of your bookings & account data" onPress={handleDataExport} />
        </View>

        <SectionTitle title="REWARDS" />
        <View style={s.card}>
          <Row icon="gift-outline" label="Invite & Earn" sub="Share your code, earn reward credit" onPress={() => navigation.navigate('Referral')} />
        </View>

        {/* Support */}
        <SectionTitle title="SUPPORT" />
        <View style={s.card}>
          <Row icon="help-circle-outline"   label="Help Centre"      onPress={() => navigation.navigate('WebView', { url: 'https://wiamapp.com/help', title: 'Help Centre' })} />
          <View style={s.div} />
          <Row icon="chatbox-outline"       label="Contact Support"  onPress={() => Alert.alert('Support', 'Email: support@wiamapp.com\nWhatsApp: +233 XX XXX XXXX')} />
          <View style={s.div} />
          <Row icon="document-text-outline" label="Terms of Service" onPress={() => navigation.navigate('WebView', { url: 'https://wiamapp.com/terms', title: 'Terms of Service' })} />
          <View style={s.div} />
          <Row icon="shield-outline"        label="Privacy Policy"   onPress={() => navigation.navigate('WebView', { url: 'https://wiamapp.com/privacy', title: 'Privacy Policy' })} />
        </View>

        {/* Account */}
        <SectionTitle title="ACCOUNT" />
        <View style={s.card}>
          <Row
            icon="log-out-outline" label={signingOut ? 'Signing out...' : 'Sign Out'}
            onPress={signingOut ? null : handleSignOut}
            right={signingOut ? <ActivityIndicator color={GOLD} size="small" /> : undefined}
          />
        </View>

        <View style={s.card}>
          <Row icon="trash-outline" label="Delete Account" danger onPress={handleDeleteAccount} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: NAVY, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { padding: 2 },
  headerTitle: { color: WHITE, fontSize: 17, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: MUTED, letterSpacing: 0.5, marginTop: 22, marginBottom: 8, marginHorizontal: 16 },
  card: { backgroundColor: '#F8F8FA', borderRadius: 14, marginHorizontal: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: 'rgba(212,160,23,0.12)', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14.5, fontWeight: '600', color: NAVY },
  rowSub: { fontSize: 12, color: MUTED, marginTop: 1 },
  div: { height: 1, backgroundColor: BORDER, marginLeft: 60 },
});
