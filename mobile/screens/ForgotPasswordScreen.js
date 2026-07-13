// © 2026 WiamApp. Powered by WiamLabs
// screens/ForgotPasswordScreen.js

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar,
  Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BrandLogo from '../components/BrandLogo';

const BG      = '#0D0D2B';
const GOLD    = '#D4A017';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.45)';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ForgotPasswordScreen({ navigation }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSend = async () => {
    if (!email || loading) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${BACKEND}/api/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send reset email.');
      navigation.navigate('ResetPassword', { email: email.trim().toLowerCase() });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={s.container}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>

        <BrandLogo size="md" />

        <View style={s.iconWrap}>
          <Ionicons name="lock-open-outline" size={32} color={GOLD} />
        </View>

        <Text style={s.title}>Forgot password?</Text>
        <Text style={s.subtitle}>
          Enter your email and we will send a 6-digit code (and a web link) to reset your password.
        </Text>

        <Text style={s.label}>Email address</Text>
        <View style={s.inputWrap}>
          <Ionicons name="mail-outline" size={17} color="rgba(255,255,255,0.35)" style={{ marginRight: 10 }} />
          <TextInput
            style={s.input}
            placeholder="you@example.com"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[s.btn, (!email || loading) && s.btnDisabled]}
          onPress={handleSend}
          disabled={!email || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={BG} />
            : <Text style={s.btnText}>Send Reset Code</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={s.backToLogin}>
            Remembered it? <Text style={s.backToLoginLink}>Log In</Text>
          </Text>
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
  backBtn:  { position: 'absolute', top: 16, left: 24, width: 40 },
  logo:     { width: 52, height: 52, marginBottom: 20 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: GOLD_BG, borderWidth: 1, borderColor: GOLD_BD,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title:     { color: WHITE, fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle:  { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  label: {
    color: 'rgba(255,255,255,0.55)', fontSize: 12,
    fontWeight: '500', marginBottom: 7, letterSpacing: 0.3, alignSelf: 'flex-start',
  },
  inputWrap: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 16,
  },
  input:    { flex: 1, color: WHITE, fontSize: 14 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 14, width: '100%',
  },
  errorText:       { color: '#EF4444', fontSize: 12, flex: 1 },
  btn:             { backgroundColor: GOLD, borderRadius: 13, paddingVertical: 15, width: '100%', alignItems: 'center', marginBottom: 14 },
  btnDisabled:     { backgroundColor: 'rgba(212,160,23,0.25)' },
  btnText:         { color: BG, fontSize: 15, fontWeight: '700' },
  backToLogin:     { color: MUTED, fontSize: 13 },
  backToLoginLink: { color: GOLD, fontWeight: '600' },
  copyright:       { color: 'rgba(212,160,23,0.3)', fontSize: 10, letterSpacing: 0.5, marginTop: 24 },
});
