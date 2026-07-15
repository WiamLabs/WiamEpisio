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

const PAD = Colors.screenPad;

const PREF_KEYS = [
  'notif_booking_updates',
  'notif_chat_messages',
  'notif_promotions',
  'notif_spotlight_trusted',
  'language',
  'currency_display',
];

function SectionTitle({ title }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

function MenuRow({ icon, label, sub, onPress, danger, right }) {
  return (
    <TouchableOpacity style={s.menuRow} onPress={onPress} disabled={!onPress && !right} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[s.menuIcon, danger && s.menuIconDanger]}>
        <Ionicons name={icon} size={17} color={danger ? Colors.error : Colors.gold} />
      </View>
      <View style={s.menuText}>
        <Text style={[s.menuTitle, danger && s.menuTitleDanger]}>{label}</Text>
        {sub ? <Text style={s.menuSub}>{sub}</Text> : null}
      </View>
      {right || (onPress ? <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} /> : null)}
    </TouchableOpacity>
  );
}

export default function CustomerSettingsScreen({ navigation }) {
  const { user } = useAuth();

  const [notifBookings, setNotifBookings] = useState(true);
  const [notifChat, setNotifChat] = useState(true);
  const [notifPromos, setNotifPromos] = useState(false);
  const [notifSpotlight, setNotifSpotlight] = useState(true);
  const [language, setLanguage] = useState('English');
  const [currency, setCurrency] = useState('GHS');

  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

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
        const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));

        if (map.notif_booking_updates !== undefined) setNotifBookings(map.notif_booking_updates === 'true');
        if (map.notif_chat_messages !== undefined) setNotifChat(map.notif_chat_messages === 'true');
        if (map.notif_promotions !== undefined) setNotifPromos(map.notif_promotions === 'true');
        if (map.notif_spotlight_trusted !== undefined) setNotifSpotlight(map.notif_spotlight_trusted === 'true');
        if (map.language !== undefined) setLanguage(map.language);
        if (map.currency_display !== undefined) setCurrency(map.currency_display);
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
      { text: 'Twi', onPress: () => { setLanguage('Twi'); savePref('language', 'Twi'); } },
      { text: 'Français', onPress: () => { setLanguage('Français'); savePref('language', 'Français'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePickCurrency = () => {
    Alert.alert('Display Currency', 'Bookings are always processed securely — this only changes how prices are shown to you.', [
      { text: 'GHS — Cedi', onPress: () => { setCurrency('GHS'); savePref('currency_display', 'GHS'); } },
      { text: 'USD — Dollar', onPress: () => { setCurrency('USD'); savePref('currency_display', 'USD'); } },
      { text: 'NGN — Naira', onPress: () => { setCurrency('NGN'); savePref('currency_display', 'NGN'); } },
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
          } catch {
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
            Alert.alert('Are you absolutely sure?', 'Confirming will delete your account now.', [
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
                  } catch {
                    Alert.alert('Error', 'Could not delete account. Try again or contact support.');
                  }
                },
              },
            ]);
          },
        },
      ],
    );
  };

  const handleDataExport = () => {
    Alert.alert(
      'Export Your Data',
      `We will email a copy of your bookings, reviews, and account data to ${user?.email || 'your registered email'} within 48 hours.`,
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
              const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
              const { data: { session } } = await supabase.auth.getSession();
              await fetch(`${BACKEND}/api/auth/data-export-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
              }).catch(() => {});
              Alert.alert('Requested', 'You will receive your data by email within 48 hours.');
            } catch {
              Alert.alert('Error', 'Could not submit your request. Try again.');
            }
          },
        },
      ],
    );
  };

  const switchProps = (value, onChange) => ({
    value,
    onValueChange: onChange,
    trackColor: { false: Colors.navyLine, true: Colors.gold },
    thumbColor: Colors.white,
  });

  if (loadingPrefs) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={Colors.gold} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <SectionTitle title="NOTIFICATIONS" />
        <View style={s.menuGroup}>
          <MenuRow icon="calendar-outline" label="Booking Updates" sub="Accepted, started, completed"
            right={<Switch {...switchProps(notifBookings, toggleAndSave(setNotifBookings, 'notif_booking_updates'))} />}
          />
          <View style={s.divider} />
          <MenuRow icon="chatbubble-outline" label="Chat Messages" sub="New messages from workers"
            right={<Switch {...switchProps(notifChat, toggleAndSave(setNotifChat, 'notif_chat_messages'))} />}
          />
          <View style={s.divider} />
          <MenuRow icon="ribbon-outline" label="Spotlight from Trusted Workers" sub="New posts from workers you trust"
            right={<Switch {...switchProps(notifSpotlight, toggleAndSave(setNotifSpotlight, 'notif_spotlight_trusted'))} />}
          />
          <View style={s.divider} />
          <MenuRow icon="megaphone-outline" label="Promotions & Marketing" sub="Occasional offers and updates"
            right={<Switch {...switchProps(notifPromos, toggleAndSave(setNotifPromos, 'notif_promotions'))} />}
          />
        </View>

        <SectionTitle title="PREFERENCES" />
        <View style={s.menuGroup}>
          <MenuRow icon="language-outline" label="Language" sub={language} onPress={handlePickLanguage} />
          <View style={s.divider} />
          <MenuRow icon="cash-outline" label="Display Currency" sub={currency} onPress={handlePickCurrency} />
        </View>

        <SectionTitle title="PRIVACY" />
        <View style={s.menuGroup}>
          <MenuRow icon="ban-outline" label="Blocked Workers" sub="Workers you've blocked from contacting you" onPress={() => navigation.navigate('BlockedUsers')} />
          <View style={s.divider} />
          <MenuRow icon="download-outline" label="Export My Data" sub="Get a copy of your bookings & account data" onPress={handleDataExport} />
        </View>

        <SectionTitle title="REWARDS" />
        <View style={s.menuGroup}>
          <MenuRow icon="gift-outline" label="Invite & Earn" sub="Share your code, earn reward credit" onPress={() => navigation.navigate('Referral')} />
        </View>

        <SectionTitle title="SUPPORT" />
        <View style={s.menuGroup}>
          <MenuRow icon="help-circle-outline" label="Help Centre" onPress={() => navigation.navigate('WebView', { url: 'https://wiamapp.com/help', title: 'Help Centre' })} />
          <View style={s.divider} />
          <MenuRow icon="chatbox-outline" label="Contact Support" onPress={() => Alert.alert('Support', 'Email: support@wiamapp.com\nWhatsApp: +233 XX XXX XXXX')} />
          <View style={s.divider} />
          <MenuRow icon="document-text-outline" label="Terms of Service" onPress={() => navigation.navigate('WebView', { url: 'https://wiamapp.com/terms', title: 'Terms of Service' })} />
          <View style={s.divider} />
          <MenuRow icon="shield-outline" label="Privacy Policy" onPress={() => navigation.navigate('WebView', { url: 'https://wiamapp.com/privacy', title: 'Privacy Policy' })} />
        </View>

        <SectionTitle title="ACCOUNT" />
        <View style={s.menuGroup}>
          <MenuRow
            icon="log-out-outline"
            label={signingOut ? 'Signing out...' : 'Sign Out'}
            onPress={signingOut ? null : handleSignOut}
            right={signingOut ? <ActivityIndicator color={Colors.gold} size="small" /> : undefined}
          />
        </View>

        <View style={[s.menuGroup, { marginTop: 10 }]}>
          <MenuRow icon="trash-outline" label="Delete Account" danger onPress={handleDeleteAccount} />
        </View>

        <Text style={s.footerCopy}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navy },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: PAD, paddingBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.navyCard, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },
  scroll: { paddingHorizontal: PAD, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: Colors.textFaint,
    textTransform: 'uppercase', marginTop: 20, marginBottom: 10, marginLeft: 4,
  },
  menuGroup: {
    borderRadius: 20, backgroundColor: Colors.navyCard,
    borderWidth: 1, borderColor: Colors.navyLine, overflow: 'hidden',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, paddingHorizontal: 16 },
  menuIcon: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(212,160,23,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconDanger: { backgroundColor: 'rgba(239,68,68,0.1)' },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 13.5, fontWeight: '500', color: Colors.white },
  menuTitleDanger: { color: Colors.error },
  menuSub: { fontSize: 11, color: Colors.textFaint, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.navyLine, marginLeft: 65 },
  footerCopy: { textAlign: 'center', fontSize: 10, color: '#3A3A56', marginTop: 24 },
});
