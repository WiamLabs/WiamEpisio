// © 2026 WiamApp. Powered by WiamLabs
// screens/ResetPasswordScreen.js
// User arrives here from email reset link
// Backend: POST /api/auth/reset-password

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet,  StatusBar,
  Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const LOGO    = require('../assets/logo.png');
const BG      = '#0D0D2B';
const GOLD    = '#D4A017';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.45)';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ResetPasswordScreen({ navigation, route }) {
  const { token } = route?.params || {};

  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [done,            setDone]            = useState(false);
  const [error,           setError]           = useState('');

  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const canSubmit      = password.length >= 8 && passwordsMatch;

  const handleReset = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${BACKEND}/api/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reset password.');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <View style={s.container}>
          <Image source={LOGO} style={s.logo} resizeMode="contain" />
          <View style={s.iconWrap}>
            <Ionicons name="checkmark-circle-outline" size={40} color="#22C55E" />
          </View>
          <Text style={s.title}>Password updated</Text>
          <Text style={s.subtitle}>
            Your password has been reset successfully.{'\n'}
            You can now log in with your new password.
          </Text>
          <TouchableOpacity
            style={s.btn}
            onPress={() => navigation.replace('Login')}
            activeOpacity={0.85}
          >
            <Text style={s.btnText}>Go to Log In</Text>
            <Ionicons name="arrow-forward" size={16} color={BG} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={s.container}>

        <Image source={LOGO} style={s.logo} resizeMode="contain" />

        <View style={s.iconWrap}>
          <Ionicons name="lock-closed-outline" size={32} color={GOLD} />
        </View>

        <Text style={s.title}>Reset your password</Text>
        <Text style={s.subtitle}>
          Create a new password for your WiamApp account.
          Minimum 8 characters.
        </Text>

        {/* New password */}
        <Text style={s.label}>New password</Text>
        <View style={s.inputWrap}>
          <Ionicons name="lock-closed-outline" size={17} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Minimum 8 characters"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={17} color="rgba(255,255,255,0.35)"
            />
          </TouchableOpacity>
        </View>

        {/* Confirm password */}
        <Text style={s.label}>Confirm new password</Text>
        <View style={[s.inputWrap, confirmPassword && !passwordsMatch && s.inputWrapError]}>
          <Ionicons name="lock-closed-outline" size={17} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Repeat your new password"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirm}
          />
          <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
            <Ionicons
              name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
              size={17} color="rgba(255,255,255,0.35)"
            />
          </TouchableOpacity>
        </View>

        {/* Password match indicator */}
        {confirmPassword ? (
          <View style={s.matchRow}>
            <Ionicons
              name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
              size={14}
              color={passwordsMatch ? '#22C55E' : '#EF4444'}
            />
            <Text style={[s.matchText, { color: passwordsMatch ? '#22C55E' : '#EF4444' }]}>
              {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
            </Text>
          </View>
        ) : null}

        {/* Error */}
        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Submit button */}
        <TouchableOpacity
          style={[s.btn, (!canSubmit || loading) && s.btnDisabled]}
          onPress={handleReset}
          disabled={!canSubmit || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={BG} />
            : <>
                <Text style={s.btnText}>Reset Password</Text>
                {canSubmit && <Ionicons name="arrow-forward" size={16} color={BG} style={{ marginLeft: 6 }} />}
              </>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={s.backText}>Back to Log In</Text>
        </TouchableOpacity>

        <Text style={s.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  container: {
    flex: 1, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'center', paddingBottom: 40,
  },
  logo:    { width: 52, height: 52, marginBottom: 20 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: GOLD_BG, borderWidth: 1, borderColor: GOLD_BD,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title:    { color: WHITE, fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 21, marginBottom: 24, width: '100%' },
  label: {
    color: 'rgba(255,255,255,0.55)', fontSize: 12,
    fontWeight: '500', marginBottom: 7, letterSpacing: 0.3,
    alignSelf: 'flex-start',
  },
  inputWrap: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center',
    width: '100%', marginBottom: 14,
  },
  inputWrapError: { borderColor: '#EF4444' },
  inputIcon: { marginRight: 10 },
  input:     { color: WHITE, fontSize: 14 },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginBottom: 14, marginTop: -8,
  },
  matchText: { fontSize: 12 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 14, width: '100%',
  },
  errorText:  { color: '#EF4444', fontSize: 12, flex: 1 },
  btn: {
    backgroundColor: GOLD, borderRadius: 13,
    paddingVertical: 15, width: '100%',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginBottom: 14,
  },
  btnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  btnText:     { color: BG, fontSize: 15, fontWeight: '700' },
  backText:    { color: MUTED, fontSize: 13, marginBottom: 24 },
  copyright:   { color: 'rgba(212,160,23,0.3)', fontSize: 10, letterSpacing: 0.5, marginTop: 16 },
});
