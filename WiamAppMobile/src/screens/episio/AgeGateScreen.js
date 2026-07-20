/**
 * Confirm age — year of birth only. Sticky until confirm / under-18 exit.
 * Brand navy + gold radial glow.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, BackHandler, Platform,
  ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Lock } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import LogoBadge from '../../components/episio/LogoBadge';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import authApi from '../../api/auth';

const MIN_AGE = 18;

const AgeGateScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const sticky = route.params?.sticky !== false;
  const prefill = route.params?.birthYear;
  const nowYear = new Date().getFullYear();
  const maxYear = nowYear - MIN_AGE;
  const minYear = nowYear - 100;

  const years = useMemo(() => {
    const list = [];
    for (let y = maxYear; y >= minYear; y -= 1) list.push(y);
    return list;
  }, [maxYear, minYear]);

  const [year, setYear] = useState(() => {
    const y = Number(prefill);
    if (y && y >= minYear && y <= maxYear) return y;
    return maxYear - 5;
  });
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
    const y = Number(year);
    if (!y || y < minYear || y > maxYear) {
      setError('Select your year of birth');
      return;
    }
    const age = nowYear - y;
    if (age < MIN_AGE) {
      exitApp();
      return;
    }
    setBusy(true);
    try {
      // Store as Jan 1 of birth year for eligibility records
      await authApi.updateProfile({ dateOfBirth: `${y}-01-01` }).catch(() => {});
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
          WiamEpisio includes drama series intended for mature audiences. Confirm your year of birth — you must be 18+ to continue.
        </Text>

        <Text style={styles.yearLabel}>Year of birth</Text>
        <ScrollView
          style={styles.yearWheel}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 12 }}
        >
          {years.map((y) => {
            const on = y === year;
            return (
              <TouchableOpacity
                key={y}
                style={[styles.yearItem, on && styles.yearItemOn]}
                onPress={() => setYear(y)}
              >
                <Text style={[styles.yearText, on && styles.yearTextOn]}>{y}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.privacyNote}>
          <Lock size={14} color={COLORS.gold} />
          <Text style={styles.privacyText}>
            Used only to confirm eligibility — never shown on your profile or shared with anyone.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <EpisioGoldButton
          label={busy ? 'Saving…' : 'Confirm & Continue'}
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
  yearWheel: {
    alignSelf: 'stretch',
    maxHeight: 180,
    backgroundColor: COLORS.navyCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    marginBottom: 20,
  },
  yearItem: { paddingVertical: 10, alignItems: 'center', marginHorizontal: 10, borderRadius: 10 },
  yearItemOn: { backgroundColor: 'rgba(212,160,23,0.2)' },
  yearText: { fontSize: 18, fontFamily: FONTS.semi, color: COLORS.textDim },
  yearTextOn: { color: COLORS.gold, fontFamily: FONTS.extraBold },
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
  error: { color: COLORS.error, fontFamily: FONTS.medium, fontSize: 12, marginBottom: 10 },
  declineLink: { fontSize: 12, color: COLORS.textFaint, fontFamily: FONTS.semi },
});

export default AgeGateScreen;
