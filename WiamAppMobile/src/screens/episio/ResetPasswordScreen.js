/**
 * Style: WiamEpisio-Reset-Password.html
 * New password + confirm · eye toggle · strength · Submit → Login
 * Params: email?, code?, phone? (email required for API when code present)
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Lock, Eye, EyeOff, Check, Mail } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import authApi from '../../api/auth';

const ResetPasswordScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const initialEmail = route.params?.email || '';
  const code = route.params?.code || '';

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    return Math.min(score, 4);
  }, [password, hasLength, hasSymbol]);

  const strengthLabel =
    strength >= 3 ? 'Strong password' : strength >= 2 ? 'Good password' : 'Keep going';

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
    const e = email.trim().toLowerCase();
    if (code && !e) {
      setError('Email is required to reset your password');
      return;
    }
    setBusy(true);
    try {
      if (e && code) {
        await authApi.resetPassword(e, code.trim(), password, confirm);
      }
      navigation.replace('Login');
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Could not reset password');
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

        {!initialEmail ? (
          <>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.fieldBox}>
              <Mail size={15} color={COLORS.gold} />
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={COLORS.textFaint}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </>
        ) : null}

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
          <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={10}>
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
            secureTextEntry={!showConfirm}
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} hitSlop={10}>
            {showConfirm ? <EyeOff size={15} color={COLORS.textFaint} /> : <Eye size={15} color={COLORS.textFaint} />}
          </TouchableOpacity>
        </View>

        <View style={styles.reqList}>
          <ReqItem ok={hasLength} label="At least 8 characters" />
          <ReqItem ok={hasSymbol} label="One number or symbol" />
          <ReqItem ok={matches} label="Passwords match" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <EpisioGoldButton
          label="Reset Password"
          onPress={submit}
          loading={busy}
          textStyle={styles.resetText}
        />
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
  sub: { fontSize: 12.5, color: '#7D7D97', lineHeight: 20 },
  fieldLabel: { fontSize: 11.5, fontFamily: FONTS.semi, color: '#7D7D97', marginBottom: 7 },
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
  reqText: { fontSize: 11, color: '#7D7D97', fontFamily: FONTS.regular },
  reqTextPending: { color: COLORS.textFaint },
  error: { color: '#EF4444', fontFamily: FONTS.medium, fontSize: 13, marginBottom: 10 },
  resetText: { fontSize: 14.5 },
});

export default ResetPasswordScreen;
