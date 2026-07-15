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
import GoldAvatar from '../components/ui/GoldAvatar';

const PAD = Colors.screenPad;

const NOTIF_KEYS = {
  newJobs: 'notif_new_jobs',
  payments: 'notif_payments',
  reviews: 'notif_reviews',
  marketing: 'notif_marketing',
};

function SectionTitle({ title }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

function MenuRow({ icon, label, sub, onPress, danger, right }) {
  return (
    <TouchableOpacity
      style={s.menuRow}
      onPress={onPress}
      disabled={!onPress && !right}
      activeOpacity={onPress ? 0.7 : 1}
    >
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

export default function WorkerSettingsScreen({ navigation }) {
  const { user, profile } = useAuth();

  const [notifNewJobs, setNotifNewJobs] = useState(true);
  const [notifPayments, setNotifPayments] = useState(true);
  const [notifReviews, setNotifReviews] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showFullName, setShowFullName] = useState(true);

  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [nextBillingDate, setNextBillingDate] = useState(null);
  const [billingSource, setBillingSource] = useState('app');
  const [language, setLanguage] = useState('English');
  const [currency, setCurrency] = useState('GHS');

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

  const handleOpenBilling = () => {
    if (billingSource === 'web') {
      navigation.navigate('WebView', { url: 'https://wiamapp.com/billing', title: 'Billing & Invoices' });
    } else {
      Linking.openURL(
        Platform.OS === 'ios'
          ? 'itms-apps://apps.apple.com/account/subscriptions'
          : 'https://play.google.com/store/account/subscriptions',
      );
    }
  };

  useEffect(() => {
    if (!user?.id) { setLoadingPrefs(false); return; }
    loadPreferences();
  }, [user?.id]);

  const loadPreferences = async () => {
    try {
      const { data } = await supabase.from('user_settings').select('key, value').eq('user_id', user.id);
      if (data) {
        const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
        if (map[NOTIF_KEYS.newJobs] !== undefined) setNotifNewJobs(map[NOTIF_KEYS.newJobs] === 'true');
        if (map[NOTIF_KEYS.payments] !== undefined) setNotifPayments(map[NOTIF_KEYS.payments] === 'true');
        if (map[NOTIF_KEYS.reviews] !== undefined) setNotifReviews(map[NOTIF_KEYS.reviews] === 'true');
        if (map[NOTIF_KEYS.marketing] !== undefined) setNotifMarketing(map[NOTIF_KEYS.marketing] === 'true');
        if (map.privacy_show_phone !== undefined) setShowPhone(map.privacy_show_phone === 'true');
        if (map.privacy_show_full_name !== undefined) setShowFullName(map.privacy_show_full_name === 'true');
        if (map.language !== undefined) setLanguage(map.language);
        if (map.currency_display !== undefined) setCurrency(map.currency_display);
      }
    } catch (e) {
      console.warn('Load prefs error:', e.message);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const savePref = async (key, value) => {
    if (!user?.id) return;
    try {
      await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, key, value: String(value) }, { onConflict: 'user_id,key' });
    } catch (e) {
      console.warn('Save pref error:', e.message);
    }
  };

  const toggle = (setter, key, val) => {
    setter(val);
    savePref(key, val);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try { await supabase.auth.signOut(); } catch (e) { console.warn('Sign out error:', e.message); }
          finally {
            setSigningOut(false);
            navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
          }
        },
      },
    ]);
  };

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
            Alert.alert('Last warning', 'All your data will be gone forever. Are you absolutely sure?', [
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
                  } catch {
                    Alert.alert('Error', 'Could not delete account. Contact support@wiamapp.com');
                  }
                },
              },
            ]);
          },
        },
      ],
    );
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
    Alert.alert('Display Currency', 'Money is always processed securely — this only changes how prices are shown to you.', [
      { text: 'GHS — Cedi', onPress: () => { setCurrency('GHS'); savePref('currency_display', 'GHS'); } },
      { text: 'USD — Dollar', onPress: () => { setCurrency('USD'); savePref('currency_display', 'USD'); } },
      { text: 'NGN — Naira', onPress: () => { setCurrency('NGN'); savePref('currency_display', 'NGN'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const tierName = profile?.subscription_tier
    ? `${profile.subscription_tier.charAt(0).toUpperCase()}${profile.subscription_tier.slice(1)} Plan`
    : 'Free Plan';

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
        <View style={s.accountCard}>
          <GoldAvatar name={user?.full_name} uri={user?.avatar_url} size={46} />
          <View>
            <Text style={s.accountName}>{user?.full_name || 'Worker'}</Text>
            <Text style={s.accountEmail}>{user?.email}</Text>
          </View>
        </View>

        <SectionTitle title="SUBSCRIPTION" />
        <View style={s.menuGroup}>
          <View style={s.subRow}>
            <View>
              <Text style={s.subPlan}>{tierName}</Text>
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
          <TouchableOpacity style={s.subBtn} onPress={() => navigation.navigate('Subscription')}>
            <Text style={s.subBtnText}>
              {profile?.subscription_tier && profile.subscription_tier !== 'free' ? 'Manage Subscription' : 'Upgrade Plan'}
            </Text>
          </TouchableOpacity>
          {profile?.subscription_tier && profile.subscription_tier !== 'free' ? (
            <TouchableOpacity style={s.billingLink} onPress={handleOpenBilling}>
              <Ionicons name="receipt-outline" size={14} color={Colors.textFaint} />
              <Text style={s.billingLinkText}>Billing & Invoices</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>

        <SectionTitle title="NOTIFICATIONS" />
        <View style={s.menuGroup}>
          <MenuRow icon="briefcase-outline" label="New Job Requests" sub="Alert when a customer books you"
            right={<Switch {...switchProps(notifNewJobs, (v) => toggle(setNotifNewJobs, NOTIF_KEYS.newJobs, v))} />}
          />
          <View style={s.divider} />
          <MenuRow icon="cash-outline" label="Payment Released" sub="When your earnings are available"
            right={<Switch {...switchProps(notifPayments, (v) => toggle(setNotifPayments, NOTIF_KEYS.payments, v))} />}
          />
          <View style={s.divider} />
          <MenuRow icon="star-outline" label="Reviews & Ratings" sub="When a customer reviews you"
            right={<Switch {...switchProps(notifReviews, (v) => toggle(setNotifReviews, NOTIF_KEYS.reviews, v))} />}
          />
          <View style={s.divider} />
          <MenuRow icon="megaphone-outline" label="WiamApp Tips & Updates"
            right={<Switch {...switchProps(notifMarketing, (v) => toggle(setNotifMarketing, NOTIF_KEYS.marketing, v))} />}
          />
        </View>

        <SectionTitle title="PRIVACY" />
        <View style={s.menuGroup}>
          <MenuRow icon="call-outline" label="Show Phone Number" sub="Customers can see your number on your profile"
            right={<Switch {...switchProps(showPhone, (v) => { setShowPhone(v); savePref('privacy_show_phone', v); })} />}
          />
          <View style={s.divider} />
          <MenuRow icon="person-outline" label="Show Full Name" sub="Display full name instead of first name only"
            right={<Switch {...switchProps(showFullName, (v) => { setShowFullName(v); savePref('privacy_show_full_name', v); })} />}
          />
        </View>

        <SectionTitle title="ACCOUNT" />
        <View style={s.menuGroup}>
          <MenuRow icon="calendar-outline" label="Availability" sub="Set your working days & hours" onPress={() => navigation.navigate('AvailabilityCalendar')} />
          <View style={s.divider} />
          <MenuRow
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
                if (ver?.status === 'pending') navigation.navigate('VerificationPending');
                else if (ver?.status === 'rejected') navigation.navigate('VerificationRejected');
                else if (profile?.is_verified) navigation.navigate('VerificationApproved');
                else navigation.navigate('WorkerVerifyIntro');
              } catch {
                navigation.navigate('WorkerVerifyIntro');
              }
            }}
          />
          <View style={s.divider} />
          <MenuRow icon="lock-closed-outline" label="Change Password" onPress={() => navigation.navigate('ForgotPassword')} />
          <View style={s.divider} />
          <MenuRow icon="language-outline" label="Language" sub={language} onPress={handlePickLanguage} />
          <View style={s.divider} />
          <MenuRow icon="cash-outline" label="Display Currency" sub={currency} onPress={handlePickCurrency} />
          <View style={s.divider} />
          <MenuRow icon="ban-outline" label="Blocked Customers" sub="Customers you've blocked from booking you" onPress={() => navigation.navigate('BlockedUsers')} />
          <View style={s.divider} />
          <MenuRow icon="gift-outline" label="Invite & Earn" sub="Share your code, earn free Pro months" onPress={() => navigation.navigate('Referral')} />
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

        <SectionTitle title="DANGER ZONE" />
        <View style={s.menuGroup}>
          <MenuRow
            icon="log-out-outline"
            label={signingOut ? 'Signing out...' : 'Sign Out'}
            danger
            onPress={signingOut ? null : handleSignOut}
          />
          <View style={s.divider} />
          <MenuRow icon="trash-outline" label="Delete Account" sub="Permanently remove all your data" danger onPress={handleDeleteAccount} />
        </View>

        <Text style={s.version}>WiamApp Worker v1.0 · © 2026 WiamLabs</Text>
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
  accountCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.navyCard, borderRadius: 20, padding: 16,
    marginBottom: 6, borderWidth: 1, borderColor: Colors.navyLine,
  },
  accountName: { fontSize: 16, fontWeight: '700', color: Colors.white },
  accountEmail: { fontSize: 13, color: Colors.textDim, marginTop: 2 },
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
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  subPlan: { fontSize: 16, fontWeight: '700', color: Colors.gold },
  subExpiry: { fontSize: 12, color: Colors.textFaint, marginTop: 2 },
  activePill: { backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  activePillText: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  subBenefits: { paddingHorizontal: 16, paddingBottom: 4 },
  subBenefit: { fontSize: 13, color: Colors.textDim, marginBottom: 4 },
  subBtn: { margin: 16, marginTop: 8, borderWidth: 1.5, borderColor: Colors.gold, borderRadius: 14, paddingVertical: 11, alignItems: 'center' },
  subBtnText: { fontSize: 14, fontWeight: '700', color: Colors.gold },
  billingLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingBottom: 16 },
  billingLinkText: { fontSize: 13, color: Colors.textFaint, fontWeight: '500' },
  version: { textAlign: 'center', fontSize: 12, color: Colors.textFaint, marginTop: 24 },
});
