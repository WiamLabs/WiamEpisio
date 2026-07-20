/**
 * Post-register verify method picker — Email only (SMS hidden until later).
 * Style from WiamEpisio-Forgot-Password method toggle.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Mail, Shield } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';

const VerifyMethodScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const user = useAuthStore((s) => s.user);
  const email = route.params?.email || user?.email || '';
  const birthYear = route.params?.birthYear;
  const dateOfBirth = route.params?.dateOfBirth
    || user?.date_of_birth
    || user?.dateOfBirth;
  const [busy, setBusy] = useState(false);
  // SMS kept in code path for later — not shown in UI

  const send = async () => {
    setBusy(true);
    try {
      const data = await authApi.sendVerifyCode();
      if (data?.already_verified) {
        navigation.replace('AgeGate', {
          fromRegister: true,
          birthYear,
          dateOfBirth,
          sticky: true,
        });
        return;
      }
      navigation.replace('OtpVerify', {
        flow: 'register_verify',
        email,
        birthYear,
        dateOfBirth,
        sticky: true,
      });
    } catch (e) {
      Alert.alert(
        'Verification',
        typeof e === 'string'
          ? e
          : (e?.message || 'Could not send verification email. Try again shortly.'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.hero}>
        <View style={styles.iconBadge}>
          <Shield size={24} color={COLORS.gold} />
        </View>
        <Text style={styles.h1}>Verify your account</Text>
        <Text style={styles.sub}>
          We will send a 6-digit code so only you can use this account.
        </Text>
      </View>

      <View style={styles.methodToggle}>
        <View style={[styles.methodOpt, styles.methodActive]}>
          <Text style={styles.methodActiveText}>Email</Text>
        </View>
        {/* SMS / Phone Number — hidden until product is ready */}
      </View>

      <Text style={styles.fieldLabel}>Email</Text>
      <View style={styles.fieldBox}>
        <Mail size={15} color={COLORS.gold} />
        <Text style={styles.emailText}>{email || '—'}</Text>
      </View>

      <EpisioGoldButton
        label={busy ? 'Sending…' : 'Send verification code'}
        onPress={send}
        loading={busy}
        style={{ marginTop: 8 }}
      />

      <Text style={styles.hint}>Check your inbox and spam folder for the code.</Text>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy, paddingHorizontal: 26 },
  hero: { marginBottom: 28, marginTop: 20 },
  iconBadge: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  h1: { fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 8, letterSpacing: -0.3 },
  sub: { fontSize: 12.5, color: COLORS.textDim, lineHeight: 20 },
  methodToggle: {
    flexDirection: 'row', backgroundColor: COLORS.navyCard, borderWidth: 1,
    borderColor: COLORS.navyLine, borderRadius: 12, padding: 3, marginBottom: 20,
  },
  methodOpt: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  methodActive: { backgroundColor: COLORS.gold },
  methodActiveText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.navy },
  fieldLabel: { fontSize: 11.5, fontFamily: FONTS.semi, color: COLORS.textDim, marginBottom: 7 },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.gold, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 16,
  },
  emailText: { flex: 1, color: '#fff', fontFamily: FONTS.regular, fontSize: 13.5 },
  hint: { marginTop: 16, fontSize: 12, color: COLORS.textFaint, fontFamily: FONTS.regular, textAlign: 'center' },
});

export default VerifyMethodScreen;
