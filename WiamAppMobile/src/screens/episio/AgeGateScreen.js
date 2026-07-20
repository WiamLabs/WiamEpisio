/**
 * Confirm age — type your age; compared to registration date of birth.
 * Sticky until confirm / under-18 exit. Brand navy + gold glow.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, BackHandler, Platform,
  ScrollView, KeyboardAvoidingView, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Lock } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import LogoBadge from '../../components/episio/LogoBadge';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import useAuthStore from '../../store/useAuthStore';

const MIN_AGE = 18;

function ageFromDob(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso).slice(0, 10))) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  const today = new Date();
  let age = today.getFullYear() - y;
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

const AgeGateScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const user = useAuthStore((s) => s.user);
  const sticky = route.params?.sticky !== false;
  const dob = route.params?.dateOfBirth
    || user?.date_of_birth
    || user?.dateOfBirth
    || null;

  const [ageText, setAgeText] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!sticky || done) return undefined;
      const onBack = () => true;
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      const unsub = navigation.addListener('beforeRemove', (e) => {
        if (done) return;
        if (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP') {
          e.preventDefault();
        }
      });
      return () => {
        sub.remove();
        unsub();
      };
    }, [navigation, sticky, done]),
  );

  const exitApp = () => {
    Alert.alert(
      'Age requirement',
      'WiamEpisio is for viewers 18 and older.',
      [
        {
          text: 'OK',
          onPress: () => {
            setDone(true);
            if (Platform.OS === 'android') BackHandler.exitApp();
            else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
          },
        },
      ],
    );
  };

  const confirm = async () => {
    setError(null);
    const typed = parseInt(String(ageText).replace(/\D/g, ''), 10);
    if (!typed || typed < 1 || typed > 120) {
      setError('Enter your age in years');
      return;
    }
    if (typed < MIN_AGE) {
      exitApp();
      return;
    }

    const expected = ageFromDob(dob);
    if (expected == null) {
      setError('We could not find your date of birth from sign-up. Go back and complete registration.');
      return;
    }
    if (typed !== expected) {
      setError('That age does not match the date of birth you gave at sign-up.');
      return;
    }

    setBusy(true);
    try {
      /* age confirmed against registration DOB */
    } finally {
      setBusy(false);
    }
    setDone(true);
    navigation.replace('Main');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.glowBg} />
      <ScrollView
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LogoBadge size={56} />

        <Text style={styles.h1}>Confirm your age</Text>
        <Text style={styles.sub}>
          WiamEpisio includes drama series intended for mature audiences. Type your age — we check it against the date of birth you entered when you signed up. You must be 18+ to continue.
        </Text>

        <Text style={styles.yearLabel}>Your age</Text>
        <View style={styles.ageField}>
          <TextInput
            style={styles.ageInput}
            value={ageText}
            onChangeText={setAgeText}
            placeholder="e.g. 22"
            placeholderTextColor={COLORS.textFaint}
            keyboardType="number-pad"
            maxLength={3}
            returnKeyType="done"
          />
        </View>

        <View style={styles.privacyNote}>
          <Lock size={14} color={COLORS.gold} />
          <Text style={styles.privacyText}>
            Used only to confirm eligibility — never shown on your profile or shared with anyone.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <EpisioGoldButton
          label={busy ? 'Checking…' : 'Confirm & Continue'}
          onPress={confirm}
          loading={busy}
          style={{ width: '100%', marginBottom: 12 }}
          textStyle={{ fontSize: 15 }}
        />

        <TouchableOpacity onPress={exitApp}>
          <Text style={styles.declineLink}>I'm under 18</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  glowBg: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(212,160,23,0.16)',
  },
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 48,
    paddingBottom: 40,
    minHeight: '100%',
    justifyContent: 'center',
  },
  h1: {
    fontSize: 20, fontFamily: FONTS.extraBold, color: '#fff', marginTop: 22, marginBottom: 10, textAlign: 'center',
  },
  sub: {
    fontSize: 12.5, color: '#7D7D97', lineHeight: 20, textAlign: 'center', maxWidth: 300, marginBottom: 20,
  },
  yearLabel: {
    alignSelf: 'stretch', textAlign: 'center', fontSize: 10, color: COLORS.textFaint,
    fontFamily: FONTS.bold, textTransform: 'uppercase', marginBottom: 8,
  },
  ageField: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.navyCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    marginBottom: 20,
    paddingVertical: 6,
  },
  ageInput: {
    color: '#fff',
    fontFamily: FONTS.extraBold,
    fontSize: 28,
    textAlign: 'center',
    paddingVertical: 14,
  },
  privacyNote: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 13,
    padding: 12,
    paddingHorizontal: 14,
    marginBottom: 26,
  },
  privacyText: { flex: 1, fontSize: 10.5, color: '#7D7D97', lineHeight: 16.3 },
  error: { color: COLORS.error, fontFamily: FONTS.medium, fontSize: 12, marginBottom: 10, textAlign: 'center' },
  declineLink: { fontSize: 12, color: COLORS.textFaint, fontFamily: FONTS.semi },
});

export default AgeGateScreen;
