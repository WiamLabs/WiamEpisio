import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import settingsApi from '../../api/settings';
import useAuthStore from '../../store/useAuthStore';

const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await settingsApi.get();
      // Backend returns notification_preferences { push_enabled, new_chapter, coins, ... }
      const prefs = data?.notification_preferences || data?.settings || data || {};
      const privacy = data?.privacy_preferences || {};
      setSettings({
        push_enabled: prefs.push_enabled ?? prefs.notif_push ?? true,
        new_chapter: prefs.new_chapter ?? prefs.notif_new_chapter ?? true,
        coins: prefs.coins ?? prefs.notif_coins ?? true,
        announcements: prefs.announcements ?? prefs.notif_announcements ?? true,
        show_email: privacy.show_email ?? false,
        show_phone: privacy.show_phone ?? false,
      });
    } catch {
      setError('Could not load settings');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (key) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    try {
      // Keys match api_v1 _NOTIF_PREF_KEYS (push_enabled, new_chapter, coins, announcements)
      await settingsApi.update({ [key]: next[key] });
    } catch {
      setSettings(settings);
      setError('Could not save setting');
    }
  };

  return (
    <ScrollView style={[styles.root, { paddingTop: insets.top + 8 }]} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      {!isAuthenticated ? (
        <>
          <Text style={styles.hint}>Sign in to sync notification preferences.</Text>
          <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.ctaText}>Sign In</Text>
          </TouchableOpacity>
        </>
      ) : loading ? (
        <ActivityIndicator color={COLORS.gold} />
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.section}>Notifications</Text>
          {[
            ['push_enabled', 'Push notifications'],
            ['new_chapter', 'New episode alerts'],
            ['coins', 'Coin updates'],
            ['announcements', 'Announcements'],
          ].map(([key, label]) => (
            <View key={key} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Switch
                value={!!settings[key]}
                onValueChange={() => toggle(key)}
                trackColor={{ false: COLORS.navyLine, true: COLORS.goldDark }}
                thumbColor={settings[key] ? COLORS.gold : '#888'}
              />
            </View>
          ))}
          <Text style={styles.section}>Privacy on profile</Text>
          <Text style={styles.hint}>Off by default. Turn on only if you want others to see these.</Text>
          {[
            ['show_email', 'Show email on profile'],
            ['show_phone', 'Show phone on profile'],
          ].map(([key, label]) => (
            <View key={key} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Switch
                value={!!settings[key]}
                onValueChange={() => toggle(key)}
                trackColor={{ false: COLORS.navyLine, true: COLORS.goldDark }}
                thumbColor={settings[key] ? COLORS.gold : '#888'}
              />
            </View>
          ))}
        </>
      )}

      <Text style={styles.section}>App</Text>
      <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('SubtitleSettings')}>
        <Text style={styles.linkText}>Subtitles</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('LanguagePicker')}>
        <Text style={styles.linkText}>Language</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('About')}>
        <Text style={styles.linkText}>About WiamEpisio</Text>
      </TouchableOpacity>

      <Text style={styles.section}>Legal</Text>
      <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('LegalPrivacyTerms', { tab: 'privacy' })}>
        <Text style={styles.linkText}>Privacy Policy</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('LegalPrivacyTerms', { tab: 'terms' })}>
        <Text style={styles.linkText}>Terms of Service</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('HelpCenter')}>
        <Text style={styles.linkText}>Help Center</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('AccountDelete')}>
        <Text style={[styles.linkText, { color: COLORS.error }]}>Delete account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text },
  hint: { color: COLORS.textDim, fontFamily: FONTS.regular, marginBottom: 12 },
  cta: { backgroundColor: COLORS.gold, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.navyCard, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  rowLabel: { color: COLORS.text, fontFamily: FONTS.medium, fontSize: 14 },
  section: { marginTop: 24, marginBottom: 10, color: COLORS.textFaint, fontFamily: FONTS.semi, fontSize: 12 },
  linkRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.navyLine },
  linkText: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 14 },
  error: { color: COLORS.error, marginBottom: 10, fontFamily: FONTS.medium },
});

export default SettingsScreen;
