/**
 * Style: WiamEpisio-Age-Gate.html
 * Confirm 18+ via DOB · Continue → Main · Exit for under 18
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, BackHandler, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Lock } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import LogoBadge from '../../components/episio/LogoBadge';

const MIN_AGE = 18;

const parseAge = (day, month, year) => {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!d || !m || !y || y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const birth = new Date(y, m - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

const AgeGateScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState(null);

  const exitApp = () => {
    Alert.alert(
      'Age requirement',
      'WiamEpisio is for viewers 18 and older. You can browse other WiamLabs apps when you meet the age requirement.',
      [
        { text: 'OK', onPress: () => {
          if (navigation.canGoBack()) navigation.goBack();
          else if (Platform.OS === 'android') BackHandler.exitApp();
        }},
      ],
    );
  };

  const confirm = () => {
    setError(null);
    const age = parseAge(day, month, year);
    if (age === null) {
      setError('Enter a valid date of birth');
      return;
    }
    if (age < MIN_AGE) {
      exitApp();
      return;
    }
    navigation.replace('Main');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 40) }]}>
      <View style={styles.glowBg} />

      <View style={styles.wrap}>
        <LogoBadge size={56} />

        <Text style={styles.h1}>Confirm your date of birth</Text>
        <Text style={styles.sub}>
          WiamEpisio includes drama series intended for mature audiences. You must be 18+ to continue.
        </Text>

        <View style={styles.dobRow}>
          <View style={styles.dobField}>
            <TextInput
              style={styles.dobInput}
              placeholder="DD"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="number-pad"
              maxLength={2}
              value={day}
              onChangeText={setDay}
            />
          </View>
          <View style={styles.dobField}>
            <TextInput
              style={styles.dobInput}
              placeholder="MM"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="number-pad"
              maxLength={2}
              value={month}
              onChangeText={setMonth}
            />
          </View>
          <View style={styles.dobField}>
            <TextInput
              style={styles.dobInput}
              placeholder="YYYY"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="number-pad"
              maxLength={4}
              value={year}
              onChangeText={setYear}
            />
          </View>
        </View>
        <View style={styles.dobLabels}>
          <Text style={styles.dobLabel}>Day</Text>
          <Text style={styles.dobLabel}>Month</Text>
          <Text style={styles.dobLabel}>Year</Text>
        </View>

        <View style={styles.privacyNote}>
          <Lock size={14} color={COLORS.gold} />
          <Text style={styles.privacyText}>
            Used only to confirm eligibility — never shown on your profile or shared with anyone.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity activeOpacity={0.9} onPress={confirm} style={{ width: '100%' }}>
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.btn}>
            <Text style={styles.btnText}>Confirm & Continue</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={exitApp}>
          <Text style={styles.declineLink}>I'm under 18</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  glowBg: {
    position: 'absolute',
    top: 60,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(212,160,23,0.16)',
  },
  wrap: { alignItems: 'center', paddingHorizontal: 30, width: '100%' },
  h1: { fontSize: 20, fontFamily: FONTS.extraBold, color: '#fff', marginTop: 22, marginBottom: 10, textAlign: 'center' },
  sub: { fontSize: 12.5, color: COLORS.textDim, lineHeight: 20, textAlign: 'center', maxWidth: 280, marginBottom: 28 },
  dobRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 8 },
  dobField: {
    flex: 1,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  dobInput: {
    color: '#fff',
    fontSize: 16,
    fontFamily: FONTS.bold,
    textAlign: 'center',
    width: '100%',
    padding: 0,
  },
  dobLabels: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 24 },
  dobLabel: { flex: 1, textAlign: 'center', fontSize: 9.5, color: COLORS.textFaint, fontFamily: FONTS.bold, textTransform: 'uppercase' },
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
  privacyText: { flex: 1, fontSize: 10.5, color: COLORS.textDim, lineHeight: 16.3 },
  error: { color: COLORS.error, fontFamily: FONTS.medium, fontSize: 12, marginBottom: 10 },
  btn: { width: '100%', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  btnText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 15 },
  declineLink: { fontSize: 12, color: COLORS.textFaint, fontFamily: FONTS.semi },
});

export default AgeGateScreen;
