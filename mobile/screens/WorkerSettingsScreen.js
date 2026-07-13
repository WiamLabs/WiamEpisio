// © 2026 WiamApp. Powered by WiamLabs
// screens/WorkerSettingsScreen.js
// PRODUCTION — real sign out via supabase.auth.signOut(), notification prefs saved to DB

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Switch,
  Alert, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const NAVY  = Colors.navyDeep;
const NAVY2 = Colors.navyMid;
const GOLD  = Colors.gold;
const WHITE = Colors.white;
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER= 'rgba(255,255,255,0.09)';

// Keys we save to the user_settings table
const NOTIF_KEYS = {
  newJobs:   'notif_new_jobs',
  payments:  'notif_payments',
  reviews:   'notif_reviews',
  marketing: 'notif_marketing',
};

export default function WorkerSettingsScreen({ navigation }) {
  const { user, profile } = useAuth();

  // Notification toggles
  const [notifNewJobs,   setNotifNewJobs]   = useState(true);
  const [notifPayments,  setNotifPayments]  = useState(true);
  const [notifReviews,   setNotifReviews]   = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);

  // Privacy
  const [showPhone,    setShowPhone]    = useState(false);
  const [showFullName, setShowFullName] = useState(true);

  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [signingOut,   setSigningOut]   = useState(false);
  const [nextBillingDate, setNextBillingDate] = useState(null);
  const [billingSource, setBillingSource] = useState('app');
  const [language, setLanguage] = useState('English');
  const [currency, setCurrency] = useState('GHS');

  // worker_profiles has no expiry field — that information lives on
  // the real subscriptions table (migration 028), which is the
  // single source of truth for billing dates.
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('subscriptions')
      .select('next_billing_date, billing_source')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        setNextBillingDate(data?.next_billing_date || null);
        setBillingSource(data?.billing_source || 'app');
      })
      .catch(() => {});
  }, [user?.id]);

  // Open billing management — Section 5C. In-app purchases are
  // managed by Apple/Google directly (App Store policy requires
  // this); website purchases open the real billing portal here.
  const handleOpenBilling = () => {
    if (billingSource === 'web') {
      navigation.navigate('WebView', { url: 'https://wiamapp.com/billing', title: 'Billing & Invoices' });
    } else {
      Linking.openURL(
        Platform.OS === 'ios'
          ? 'itms-apps://apps.apple.com/account/subscriptions'
          : 'https://play.google.com/store/account/subscriptions'
      );
    }
  };

  // ── Load saved preferences from DB on mount ───────────────
  useEffect(() => {
    if (!user?.id) { setLoadingPrefs(false); return; }
    loadPreferences();
  }, [user?.id]);

  const loadPreferences = async () => {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('key, value')
        .eq('user_id', user.id);

      if (data) {
        const map = Object.fromEntries(data.map(r => [r.key, r.value]));
        if (map[NOTIF_KEYS.newJobs]   !== undefined) setNotifNewJobs(map[NOTIF_KEYS.newJobs]   === 'true');
        if (map[NOTIF_KEYS.payments]  !== undefined) setNotifPayments(map[NOTIF_KEYS.payments]  === 'true');
        if (map[NOTIF_KEYS.reviews]   !== undefined) setNotifReviews(map[NOTIF_KEYS.reviews]   === 'true');
        if (map[NOTIF_KEYS.marketing] !== undefined) setNotifMarketing(map[NOTIF_KEYS.marketing] === 'true');
        if (map['privacy_show_phone']     !== undefined) setShowPhone(map['privacy_show_phone']     === 'true');
        if (map['privacy_show_full_name'] !== undefined) setShowFullName(map['privacy_show_full_name'] === 'true');
        if (map['language']               !== undefined) setLanguage(map['language']);
        if (map['currency_display']       !== undefined) setCurrency(map['currency_display']);
      }
    } catch (e) {
      console.warn('Load prefs error:', e.message);
    } finally {
      setLoadingPrefs(false);
    }
  };

  // ── Save a single preference to DB ───────────────────────
  const savePref = async (key, value) => {
    if (!user?.id) return;
    try {
      await supabase
        .from('user_settings')
        .upsert(
          { user_id: user.id, key, value: String(value) },
          { onConflict: 'user_id,key' }
        );
    } catch (e) {
      console.warn('Save pref error:', e.message);
    }
  };

  // Toggle helpers — update state AND save to DB immediately
  const toggle = (setter, key, val) => {
    setter(val);
    savePref(key, val);
  };

  // ── Real sign out ─────────────────────────────────────────
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await supabase.auth.signOut();  // ✅ Real Supabase sign out
          } catch (e) {
            console.warn('Sign out error:', e.message);
          } finally {
            setSigningOut(false);
            // ✅ Navigate to Landing (not Onboarding)
            navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
          }
        },
      },
    ]);
  };

  // ── Delete account ────────────────────────────────────────
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account, all your jobs, earnings history, and verification. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Last warning',
              'All your data will be gone forever. Are you absolutely sure?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
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
                      Alert.alert('Error', 'Could not delete account. Contact support@wiamapp.com');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
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
    Alert.alert('Display Currency', 'Money is always processed securely — this only changes how prices are shown to you.', [
      { text: 'GHS — Cedi',   onPress: () => { setCurrency('GHS'); savePref('currency_display', 'GHS'); } },
      { text: 'USD — Dollar', onPress: () => { setCurrency('USD'); savePref('currency_display', 'USD'); } },
      { text: 'NGN — Naira',  onPress: () => { setCurrency('NGN'); savePref('currency_display', 'NGN'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Row component ─────────────────────────────────────────
  const Row = ({ icon, iconBg, label, sub, onPress, right, danger }) => (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      disabled={!onPress && !right}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[s.rowIcon, { backgroundColor: iconBg || 'rgba(212,160,23,0.1)' }]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.error : GOLD} />
      </View>
      <View style={s.rowText}>
        <Text style={[s.rowLabel, danger && { color: Colors.error }]}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {right
        ? right
        : onPress
          ? <Ionicons name="chevron-forward" size={16} color={MUTED} />
          : null
      }
    </TouchableOpacity>
  );

  const SectionTitle = ({ title }) => (
    <Text style={s.sectionTitle}>{title}</Text>
  );

  if (loadingPrefs) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={GOLD} style={{ marginTop: 80 }} />
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

        {/* Account info card */}
        <View style={s.accountCard}>
          <View style={s.accountAvatar}>
            <Text style={s.accountAvatarText}>
              {(user?.full_name || 'W')[0].toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={s.accountName}>{user?.full_name || 'Worker'}</Text>
            <Text style={s.accountEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Subscription */}
        <SectionTitle title="SUBSCRIPTION" />
        <View style={s.card}>
          <View style={s.subRow}>
            <View>
              <Text style={s.subPlan}>
                {profile?.subscription_tier
                  ? profile.subscription_tier.charAt(0).toUpperCase() + profile.subscription_tier.slice(1) + ' Plan'
                  : 'Free Plan'}
              </Text>
              <Text style={s.subExpiry}>
                {nextBillingDate
                  ? `Renews ${new Date(nextBillingDate).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'Upgrade to get more visibility'}
              </Text>
            </View>
            {profile?.subscription_tier && profile.subscription_tier !== 'free' ? (
              <View style={s.activePill}>
                <Text style={s.activePillText}>Active</Text>
              </View>
            ) : null}
          </View>
          {profile?.subscription_tier && profile.subscription_tier !== 'free' ? (
            <View style={s.subBenefits}>
              <Text style={s.subBenefit}>✓ Priority in search results</Text>
              <Text style={s.subBenefit}>✓ Spotlight posts</Text>
              <Text style={s.subBenefit}>✓ Lower bar to earn the Checkmark badge</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={s.subBtn}
            onPress={() => navigation.navigate('Subscription')}
          >
            <Text style={s.subBtnText}>
              {profile?.subscription_tier && profile.subscription_tier !== 'free'
                ? 'Manage Subscription'
                : 'Upgrade Plan'}
            </Text>
          </TouchableOpacity>
          {profile?.subscription_tier && profile.subscription_tier !== 'free' && (
            <TouchableOpacity style={s.billingLink} onPress={handleOpenBilling}>
              <Ionicons name="receipt-outline" size={14} color={MUTED} />
              <Text style={s.billingLinkText}>Billing & Invoices</Text>
              <Ionicons name="chevron-forward" size={14} color={MUTED} />
            </TouchableOpacity>
          )}
        </View>

        {/* Notifications */}
        <SectionTitle title="NOTIFICATIONS" />
        <View style={s.card}>
          <Row
            icon="briefcase-outline"
            label="New Job Requests"
            sub="Alert when a customer books you"
            right={
              <Switch
                value={notifNewJobs}
                onValueChange={v => toggle(setNotifNewJobs, NOTIF_KEYS.newJobs, v)}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: GOLD }}
                thumbColor={notifNewJobs ? NAVY : '#888'}
              />
            }
          />
          <View style={s.div} />
          <Row
            icon="cash-outline"
            label="Payment Released"
            sub="When your earnings are available"
            right={
              <Switch
                value={notifPayments}
                onValueChange={v => toggle(setNotifPayments, NOTIF_KEYS.payments, v)}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: GOLD }}
                thumbColor={notifPayments ? NAVY : '#888'}
              />
            }
          />
          <View style={s.div} />
          <Row
            icon="star-outline"
            label="Reviews & Ratings"
            sub="When a customer reviews you"
            right={
              <Switch
                value={notifReviews}
                onValueChange={v => toggle(setNotifReviews, NOTIF_KEYS.reviews, v)}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: GOLD }}
                thumbColor={notifReviews ? NAVY : '#888'}
              />
            }
          />
          <View style={s.div} />
          <Row
            icon="megaphone-outline"
            label="WiamApp Tips & Updates"
            right={
              <Switch
                value={notifMarketing}
                onValueChange={v => toggle(setNotifMarketing, NOTIF_KEYS.marketing, v)}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: GOLD }}
                thumbColor={notifMarketing ? NAVY : '#888'}
              />
            }
          />
        </View>

        {/* Privacy */}
        <SectionTitle title="PRIVACY" />
        <View style={s.card}>
          <Row
            icon="call-outline"
            label="Show Phone Number"
            sub="Customers can see your number on your profile"
            right={
              <Switch
                value={showPhone}
                onValueChange={v => { setShowPhone(v); savePref('privacy_show_phone', v); }}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: GOLD }}
                thumbColor={showPhone ? NAVY : '#888'}
              />
            }
          />
          <View style={s.div} />
          <Row
            icon="person-outline"
            label="Show Full Name"
            sub="Display full name instead of first name only"
            right={
              <Switch
                value={showFullName}
                onValueChange={v => { setShowFullName(v); savePref('privacy_show_full_name', v); }}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: GOLD }}
                thumbColor={showFullName ? NAVY : '#888'}
              />
            }
          />
        </View>

        {/* Account */}
        <SectionTitle title="ACCOUNT" />
        <View style={s.card}>
          <Row icon="calendar-outline"         label="Availability"         sub="Set your working days & hours"    onPress={() => navigation.navigate('AvailabilityCalendar')} />
          <View style={s.div} />
          <Row
            icon="shield-checkmark-outline"
            label="Verification Status"
            sub="View your ID & selfie status"
            onPress={async () => {
              try {
                const { data: ver } = await supabase
                  .from('worker_verifications')
                  .select('status')
                  .eq('user_id', user?.id)
                  .maybeSingle();
                if (ver?.status === 'pending') {
                  navigation.navigate('VerificationPending');
                } else if (ver?.status === 'rejected') {
                  navigation.navigate('VerificationRejected');
                } else if (profile?.is_verified) {
                  navigation.navigate('VerificationApproved');
                } else {
                  navigation.navigate('WorkerVerifyIntro');
                }
              } catch {
                navigation.navigate('WorkerVerifyIntro');
              }
            }}
          />
          <View style={s.div} />
          <Row icon="lock-closed-outline"      label="Change Password"                                             onPress={() => navigation.navigate('ForgotPassword')} />
          <View style={s.div} />
          <Row icon="language-outline"         label="Language"             sub={language}                         onPress={handlePickLanguage} />
          <View style={s.div} />
          <Row icon="cash-outline"             label="Display Currency"     sub={currency}                         onPress={handlePickCurrency} />
          <View style={s.div} />
          <Row icon="ban-outline"              label="Blocked Customers"    sub="Customers you've blocked from booking you" onPress={() => navigation.navigate('BlockedUsers')} />
          <View style={s.div} />
          <Row icon="gift-outline"             label="Invite & Earn"        sub="Share your code, earn free Pro months" onPress={() => navigation.navigate('Referral')} />
        </View>

        {/* Support */}
        <SectionTitle title="SUPPORT" />
        <View style={s.card}>
          <Row icon="help-circle-outline"  label="Help Centre"      onPress={() => navigation.navigate('WebView', { url: 'https://wiamapp.com/help', title: 'Help Centre' })} />
          <View style={s.div} />
          <Row icon="chatbox-outline"      label="Contact Support"  onPress={() => Alert.alert('Support', 'Email: support@wiamapp.com\nWhatsApp: +233 XX XXX XXXX')} />
          <View style={s.div} />
          <Row icon="document-text-outline" label="Terms of Service" onPress={() => navigation.navigate('WebView', { url: 'https://wiamapp.com/terms', title: 'Terms of Service' })} />
          <View style={s.div} />
          <Row icon="shield-outline"       label="Privacy Policy"   onPress={() => navigation.navigate('WebView', { url: 'https://wiamapp.com/privacy', title: 'Privacy Policy' })} />
        </View>

        {/* Danger zone */}
        <SectionTitle title="DANGER ZONE" />
        <View style={s.card}>
          <Row
            icon="log-out-outline"
            label={signingOut ? 'Signing out...' : 'Sign Out'}
            danger
            onPress={signingOut ? null : handleSignOut}
          />
          <View style={s.div} />
          <Row
            icon="trash-outline"
            label="Delete Account"
            sub="Permanently remove all your data"
            danger
            onPress={handleDeleteAccount}
          />
        </View>

        <Text style={s.version}>WiamApp Worker v1.0 · © 2026 WiamLabs</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: NAVY },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 12 },
  backBtn:       { padding: 4 },
  headerTitle:   { fontSize: 20, fontWeight: '700', color: WHITE },
  accountCard:   { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 14, padding: 16, marginBottom: 6, borderWidth: 1, borderColor: BORDER },
  accountAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(212,160,23,0.15)', alignItems: 'center', justifyContent: 'center' },
  accountAvatarText: { fontSize: 18, fontWeight: '700', color: GOLD },
  accountName:   { fontSize: 16, fontWeight: '700', color: WHITE },
  accountEmail:  { fontSize: 13, color: MUTED, marginTop: 2 },
  sectionTitle:  { fontSize: 11, fontWeight: '700', color: MUTED, letterSpacing: 1.2, marginHorizontal: 20, marginTop: 20, marginBottom: 8 },
  card:          { backgroundColor: NAVY2, marginHorizontal: 20, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
  row:           { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  rowIcon:       { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText:       { flex: 1 },
  rowLabel:      { fontSize: 15, fontWeight: '500', color: WHITE },
  rowSub:        { fontSize: 12, color: MUTED, marginTop: 2 },
  div:           { height: 1, backgroundColor: BORDER, marginLeft: 63 },
  subRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  subPlan:       { fontSize: 16, fontWeight: '700', color: GOLD },
  subExpiry:     { fontSize: 12, color: MUTED, marginTop: 2 },
  activePill:    { backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  activePillText:{ fontSize: 12, color: Colors.success, fontWeight: '600' },
  subBenefits:   { paddingHorizontal: 16, paddingBottom: 4 },
  subBenefit:    { fontSize: 13, color: MUTED, marginBottom: 4 },
  subBtn:        { margin: 16, marginTop: 8, borderWidth: 1.5, borderColor: GOLD, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  subBtnText:    { fontSize: 14, fontWeight: '700', color: GOLD },
  billingLink:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingBottom: 16 },
  billingLinkText: { fontSize: 13, color: MUTED, fontWeight: '500' },
  version:       { textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 24 },
});
