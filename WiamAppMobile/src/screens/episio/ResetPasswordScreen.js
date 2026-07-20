/**
 * Style: WiamEpisio-Reset-Password.html
 * New password + confirm · Submit → Login
 * Params: email?, code? (optional — for API reset)
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Lock, Eye, EyeOff, Check } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import authApi from '../../api/auth';

const ResetPasswordScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const email = route.params?.email || '';
  const code = route.params?.code || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const hasLength = password.length >= 8;
  const hasSymbol = /[\d!@#$%^&*(),.?":{}|<>]/.test(password);
  const matches = password.length > 0 && password === confirm;

  const strength = useMemo(() => {
    let score = 0;
    if (hasLength) score += 1;
    if (hasSymbol) score += 1;
    if (password.length >= 12) score += 1;
    if (matches && password.length >= 8) score += 1;
    return score;
  }, [password, hasLength, hasSymbol, matches]);

  const strengthLabel = strength >= 3 ? 'Strong password' : strength >= 2 ? 'Good password' : 'Keep going';

  const submit = async () => {
    setError(null);
    if (!hasLength || !hasSymbol) {
      setError('Password must be at least 8 characters with a number or symbol');
      return;
    }
    if (!matches) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      if (email && code) {
        await authApi.resetPassword(email.trim().toLowerCase(), code.trim(), password, confirm);
      }
      navigation.replace('Login');
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  const ReqItem = ({ ok, label }) => (
    <View style={[styles.reqItem, !ok && styles.reqPending]}>
      <Check size={13} color={ok ? '#3BB273' : COLORS.textFaint} strokeWidth={2.5} />
      <Text style={[styles.reqText, !ok && styles.reqTextPending]}>{label}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 8 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 24) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={15} color="#fff" />
        </TouchableOpacity>

        <View style={styles.hero}>
          <View style={styles.iconBadge}>
            <Check size={24} color="#3BB273" strokeWidth={2.5} />
          </View>
          <Text style={styles.h1}>Create new password</Text>
          <Text style={styles.sub}>Code verified. Choose a strong password you haven't used before.</Text>
        </View>

        <Text style={styles.fieldLabel}>New password</Text>
        <View style={[styles.fieldBox, password.length > 0 && styles.fieldFocus]}>
          <Lock size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textFaint}
            secureTextEntry={!showPw}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowPw((v) => !v)}>
            {showPw ? <EyeOff size={15} color={COLORS.textFaint} /> : <Eye size={15} color={COLORS.textFaint} />}
          </TouchableOpacity>
        </View>

        <View style={styles.strengthRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.strengthSeg, i < strength && styles.strengthActive]} />
          ))}
        </View>
        <Text style={styles.strengthLabel}>{strengthLabel}</Text>

        <Text style={styles.fieldLabel}>Confirm new password</Text>
        <View style={styles.fieldBox}>
          <Lock size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textFaint}
            secureTextEntry={!showPw}
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.reqList}>
          <ReqItem ok={hasLength} label="At least 8 characters" />
          <ReqItem ok={hasSymbol} label="One number or symbol" />
          <ReqItem ok={matches} label="Passwords match" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity activeOpacity={0.9} onPress={submit} disabled={busy}>
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.resetBtn}>
            {busy ? (
              <ActivityIndicator color={COLORS.navy} />
            ) : (
              <Text style={styles.resetText}>Reset Password</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { paddingHorizontal: 26 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 26,
  },
  hero: { marginBottom: 28 },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(59,178,115,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59,178,115,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  h1: { fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff', letterSpacing: -0.3, marginBottom: 8 },
  sub: { fontSize: 12.5, color: COLORS.textDim, lineHeight: 20 },
  fieldLabel: { fontSize: 11.5, fontFamily: FONTS.semi, color: COLORS.textDim, marginBottom: 7 },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
  },
  fieldFocus: { borderColor: COLORS.gold },
  input: { flex: 1, color: '#fff', fontSize: 13.5, fontFamily: FONTS.regular, padding: 0 },
  strengthRow: { flexDirection: 'row', gap: 5, marginTop: -6, marginBottom: 4 },
  strengthSeg: { flex: 1, height: 3, borderRadius: 99, backgroundColor: COLORS.navyLine },
  strengthActive: { backgroundColor: '#3BB273' },
  strengthLabel: { fontSize: 10.5, color: '#3BB273', fontFamily: FONTS.semi, marginBottom: 20 },
  reqList: { marginBottom: 22 },
  reqItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  reqPending: {},
  reqText: { fontSize: 11, color: COLORS.textDim, fontFamily: FONTS.regular },
  reqTextPending: { color: COLORS.textFaint },
  error: { color: COLORS.error, fontFamily: FONTS.medium, fontSize: 13, marginBottom: 10 },
  resetBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  resetText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 14.5 },
});

export default ResetPasswordScreen;
