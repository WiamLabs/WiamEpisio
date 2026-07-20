/**
 * Style: WiamEpisio-Login.html
 * Wired: POST /auth/login, Google → POST /auth/google, ForgotPassword, Register.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import LogoBadge from '../../components/episio/LogoBadge';
import authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';
import { GoogleSignInSlot } from '../../services/googleAuth';

const LoginScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const close = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'));

  const finishAuth = async (data) => {
    await setAuth(data.user, data.token);
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Main');
  };

  const submit = async () => {
    setError(null);
    const e = email.trim().toLowerCase();
    if (!e || !password) {
      setError('Email and password are required');
      return;
    }
    setBusy(true);
    try {
      const data = await authApi.login(e, password);
      await finishAuth(data);
    } catch (err) {
      setError(typeof err === 'string' ? err : (err?.message || 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.close} onPress={close}>
          <X size={16} color="#fff" />
        </TouchableOpacity>

        <View style={styles.hero}>
          <LogoBadge size={44} />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to keep watching where you left off.</Text>
        </View>

        <Text style={styles.label}>Email</Text>
        <View style={[styles.field, styles.fieldFocus]}>
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

        <Text style={styles.label}>Password</Text>
        <View style={styles.field}>
          <Lock size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textFaint}
            secureTextEntry={!showPw}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPw((v) => !v)}>
            {showPw ? <EyeOff size={15} color={COLORS.textFaint} /> : <Eye size={15} color={COLORS.textFaint} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity onPress={submit} disabled={busy} activeOpacity={0.9}>
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.btn}>
            {busy ? <ActivityIndicator color={COLORS.navy} /> : (
              <Text style={styles.btnText}>Sign In</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.line} />
        </View>

        <GoogleSignInSlot
          onSuccess={finishAuth}
          onError={(msg) => setError(typeof msg === 'string' ? msg : 'Google sign-in failed')}
        >
          {(g) => (
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Alert.alert('Facebook', 'Facebook sign-in is not available yet.')}
              >
                <Text style={styles.socialText}>Facebook</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialBtn} onPress={() => g.start()} disabled={g.signing}>
                {g.signing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.socialText}>Google{g.ready ? '' : ' · Soon'}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </GoogleSignInSlot>

        <View style={styles.bottom}>
          <TouchableOpacity onPress={() => navigation.replace('AuthRegister')}>
            <Text style={styles.signup}>
              {"Don't have an account? "}
              <Text style={{ color: COLORS.gold, fontFamily: FONTS.bold }}>Sign up</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={close}>
            <Text style={styles.guest}>Keep browsing as guest</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { paddingHorizontal: 26, flexGrow: 1 },
  close: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 26,
  },
  hero: { marginBottom: 30 },
  title: { marginTop: 18, fontSize: 23, fontFamily: FONTS.extraBold, color: '#fff', letterSpacing: -0.3 },
  sub: { marginTop: 6, fontSize: 13, color: COLORS.textDim, fontFamily: FONTS.regular },
  label: { fontSize: 11.5, fontFamily: FONTS.semi, color: COLORS.textDim, marginBottom: 7 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12,
  },
  fieldFocus: { borderColor: COLORS.gold },
  input: { flex: 1, color: '#fff', fontSize: 13.5, fontFamily: FONTS.regular, padding: 0 },
  forgot: { alignSelf: 'flex-end', marginBottom: 22 },
  forgotText: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 12 },
  error: { color: '#EF4444', marginBottom: 10, fontFamily: FONTS.medium, fontSize: 13 },
  btn: {
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 20,
  },
  btnText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 14.5 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  line: { flex: 1, height: 1, backgroundColor: COLORS.navyLine },
  dividerText: { fontSize: 11.5, color: COLORS.textFaint, fontFamily: FONTS.regular },
  socialRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  socialBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center', justifyContent: 'center',
  },
  socialText: { fontSize: 12.5, color: '#fff', fontFamily: FONTS.medium },
  bottom: { marginTop: 'auto', paddingBottom: 16, alignItems: 'center' },
  signup: { fontSize: 13, color: COLORS.textDim, fontFamily: FONTS.regular, textAlign: 'center' },
  guest: { marginTop: 12, fontSize: 12, color: COLORS.textFaint, fontFamily: FONTS.regular },
});

export default LoginScreen;
