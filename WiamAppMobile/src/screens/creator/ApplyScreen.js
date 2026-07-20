/**
 * ApplyScreen — Tiny one-tap creator gate.
 *
 * Replaces the old multi-field rubric form (pen name + writing sample +
 * story idea + experience + genres + why_wiam, all >25 chars). Wattpad,
 * Webnovel and RoyalRoad all let any reader self-promote in one tap; the
 * rubric was blocking real users (workstream H of the
 * deep_tracking_and_home_fix plan).
 *
 * Backend contract: POST /api/v1/apply/submit { pen_name, accepted_terms }
 * Server flips role=creator immediately, queues a push deep-linked to the
 * WelcomeCreator screen, and returns the fresh user payload.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronLeft,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  PenTool,
  BookOpen,
  Users,
  Coins,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import apiClient from '../../api/client';
import authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';
import { COLORS } from '../../constants/theme';

const TERMS_URL = 'https://wiamapp.com/terms';

/** Merge remote /auth/me into cached user without clobbering with undefined keys. */
function patchFromMe(prev, me) {
  if (!prev || !me) return {};
  const out = {};
  Object.keys(me).forEach((key) => {
    if (me[key] !== undefined) out[key] = me[key];
  });
  return out;
}

const PERKS = [
  { Icon: PenTool, label: 'Write & publish chapters in WiamStudio' },
  { Icon: BookOpen, label: 'Reach readers across Africa and beyond' },
  { Icon: Users, label: 'Build your following — every fan is yours' },
  { Icon: Coins, label: 'Unlock earnings, tips, and ad share' },
];

export default function ApplyScreen({ navigation }) {
  const patchUser = useAuthStore((s) => s.patchUser);

  const [bootLoading, setBootLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [penName, setPenName] = useState('');
  const [agreed, setAgreed] = useState(false);

  const syncFromMe = useCallback(async () => {
    const me = await authApi.me();
    setIsCreator(!!me.is_creator);
    const prev = useAuthStore.getState().user;
    if (prev) {
      await patchUser(patchFromMe(prev, me));
    }
  }, [patchUser]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setBootLoading(true);
        try {
          await syncFromMe();
        } catch {
          if (alive) {
            Alert.alert('Error', 'Could not load your profile. Try again or sign in again.');
          }
        } finally {
          if (alive) setBootLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [syncFromMe])
  );

  const handleSubmit = async () => {
    const trimmed = (penName || '').trim();
    if (trimmed.length < 2) {
      Alert.alert('Pen name', 'Please enter a pen name (at least 2 characters).');
      return;
    }
    if (trimmed.length > 60) {
      Alert.alert('Pen name', 'Pen name must be 60 characters or less.');
      return;
    }
    if (!agreed) {
      Alert.alert('Creator Terms', 'Please agree to the Creator Terms to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post('/apply/submit', {
        pen_name: trimmed,
        accepted_terms: true,
      });
      const u = response.data?.user;
      if (u) {
        const prev = useAuthStore.getState().user;
        if (prev) await patchUser(patchFromMe(prev, u));
      }
      await syncFromMe();
      navigation.replace('WelcomeCreator', { penName: trimmed });
    } catch (error) {
      const msg = error.response?.data?.error || 'Something went wrong. Try again.';
      Alert.alert('Could not finish', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openTerms = () => {
    Linking.openURL(TERMS_URL).catch(() => {});
  };

  if (bootLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} color="#e8e6e3" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Become a Creator</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.bootCenter}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isCreator) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} color="#e8e6e3" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Become a Creator</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.statusPage}>
          <View style={styles.statusCard}>
            <CheckCircle2 size={44} color="#4ade80" />
            <Text style={styles.statusTitle}>You are a creator</Text>
            <Text style={styles.statusBody}>
              Your account already has creator access. Open WiamStudio from the menu to write and manage your stories.
            </Text>
          </View>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Go back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { marginTop: 12, borderWidth: 1, borderColor: 'rgba(212,168,67,0.4)' }]}
            onPress={() => navigation.navigate('Studio')}
          >
            <Text style={styles.secondaryBtnText}>Open WiamStudio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#e8e6e3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Creator</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.heroBlock}>
          <View style={styles.heroIconWrap}>
            <Sparkles size={28} color="#d4a843" />
          </View>
          <Text style={styles.heroTitle}>One tap. Then you write.</Text>
          <Text style={styles.heroSubtitle}>
            No applications, no waiting room. Pick a pen name, agree to the Creator Terms, and WiamStudio opens
            instantly.
          </Text>
        </View>

        <View style={styles.perkList}>
          {PERKS.map(({ Icon, label }) => (
            <View key={label} style={styles.perkRow}>
              <Icon size={18} color="#d4a843" />
              <Text style={styles.perkText}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.label}>Pen Name</Text>
        <Text style={styles.hint}>
          The name readers will know you by. You can change it later in Studio Settings.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Martin Wiafe"
          placeholderTextColor="#6e6e78"
          value={penName}
          onChangeText={setPenName}
          maxLength={60}
          autoCapitalize="words"
          returnKeyType="done"
        />

        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setAgreed((v) => !v)}
          activeOpacity={0.85}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed ? <CheckCircle2 size={18} color="#000" /> : null}
          </View>
          <Text style={styles.termsText}>
            I agree to the{' '}
            <Text style={styles.termsLink} onPress={openTerms}>
              Creator Terms
            </Text>{' '}
            and confirm that everything I publish is original or properly licensed.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSubmit} disabled={submitting || !penName.trim() || !agreed}>
          <LinearGradient
            colors={
              submitting || !penName.trim() || !agreed
                ? ['rgba(212,168,67,0.4)', 'rgba(184,134,11,0.4)']
                : ['#d4a843', '#b8860b']
            }
            style={styles.btn}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.btnText}>Become a Creator</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <ShieldCheck size={18} color="#d4a843" />
          <Text style={styles.infoText}>
            We auto-flag obvious abuse (placeholder names, copy-paste spam) but otherwise we trust you. Your work is
            yours.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08081a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  headerTitle: { color: '#d4a843', fontSize: 18, fontFamily: 'PlayfairDisplay_700Bold' },
  bootCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 48 },

  heroBlock: { alignItems: 'center', marginTop: 6, marginBottom: 24 },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212,168,67,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    color: '#e8e6e3',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  heroSubtitle: {
    color: '#9a9aa8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },

  perkList: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 28,
    gap: 10,
  },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkText: { color: '#cfcfd8', fontSize: 13.5, flexShrink: 1 },

  label: { color: '#e8e6e3', fontSize: 14, fontWeight: '600', marginBottom: 4, marginTop: 4 },
  hint: { color: '#6e6e78', fontSize: 12, marginBottom: 8, lineHeight: 17 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
    color: '#e8e6e3',
    fontSize: 16,
  },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 22,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(212,168,67,0.6)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#d4a843',
    borderColor: '#d4a843',
  },
  termsText: { color: '#b5b5ba', fontSize: 13, lineHeight: 19, flex: 1 },
  termsLink: { color: '#d4a843', textDecorationLine: 'underline', fontWeight: '600' },

  btn: {
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    shadowColor: '#d4a843',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  btnText: { color: '#000', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(212,168,67,0.05)',
    padding: 14,
    borderRadius: 12,
    marginTop: 22,
    gap: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(212,168,67,0.2)',
    alignItems: 'flex-start',
  },
  infoText: { color: '#b5b5ba', fontSize: 12, flex: 1, lineHeight: 18 },

  statusPage: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  statusCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 22,
  },
  statusTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: '700',
    color: '#e8e6e3',
    textAlign: 'center',
  },
  statusBody: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#9a9aa8',
    textAlign: 'center',
  },
  secondaryBtn: {
    marginTop: 28,
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryBtnText: { color: '#e8e6e3', fontSize: 15, fontWeight: '600' },
});
