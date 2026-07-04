// © 2026 WiamApp. Powered by WiamLabs
// screens/LoginScreen.js
// FIXED: Uses Supabase directly — no backend needed, no "fetch failed"

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet,  StatusBar,
  Image, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const LOGO    = require('../assets/logo.png');
const BG      = '#0D0D2B';
const GOLD    = '#D4A017';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.45)';
const GOLD_BG = 'rgba(212,160,23,0.10)';
const GOLD_BD = 'rgba(212,160,23,0.25)';

export default function LoginScreen({ navigation }) {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const canSubmit = email.trim() && password.length >= 6;

  const handleLogin = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError('');
    try {
      // ✅ FIX: Sign in directly with Supabase — no backend call needed
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password: password,
      });

      if (authError) throw new Error(
        authError.message.includes('Invalid login')
          ? 'Incorrect email or password. Please try again.'
          : authError.message
      );

      const userId = data.user?.id;
      if (!userId) throw new Error('Login failed. Please try again.');

      // Get user role and verification status from users table
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('role, is_verified, full_name')
        .eq('id', userId)
        .single();

      if (userErr) throw new Error('Could not load your account. Please try again.');

      const role = userData.role;

      // Navigate based on role
      if (role === 'worker') {
        if (!userData.is_verified) {
          navigation.replace('VerificationPending');
        } else {
          navigation.replace('WorkerApp');
        }
      } else if (role === 'business') {
        navigation.replace('BusinessApp');
      } else {
        // Customer
        if (!userData.is_verified) {
          navigation.replace('CustomerVerifyIntro');
        } else {
          navigation.replace('CustomerApp');
        }
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={WHITE} />
          </TouchableOpacity>

          {/* Logo */}
          <View style={s.brand}>
            <Image source={LOGO} style={s.logo} resizeMode="contain" />
            <Text style={s.brandName}>
              <Text style={{ color: WHITE }}>Wiam</Text>
              <Text style={{ color: GOLD }}>App</Text>
            </Text>
          </View>

          <Text style={s.title}>Welcome back</Text>
          <Text style={s.subtitle}>Log in to your WiamApp account</Text>

          {/* Error */}
          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <Text style={s.label}>Email address</Text>
          <View style={s.inputWrap}>
            <Ionicons name="mail-outline" size={17} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <Text style={s.label}>Password</Text>
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={17} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Your password"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={17}
                color="rgba(255,255,255,0.35)"
              />
            </TouchableOpacity>
          </View>

          {/* Forgot password */}
          <TouchableOpacity
            style={s.forgotBtn}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={s.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login button */}
          <TouchableOpacity
            style={[s.loginBtn, (!canSubmit || loading) && s.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={BG} />
              : <>
                  <Text style={s.loginBtnText}>Log In</Text>
                  {canSubmit && <Ionicons name="arrow-forward" size={16} color={BG} style={{ marginLeft: 6 }} />}
                </>
            }
          </TouchableOpacity>

          {/* Register link */}
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={s.registerText}>
              Don't have an account?{' '}
              <Text style={s.registerLink}>Create one</Text>
            </Text>
          </TouchableOpacity>

          <Text style={s.copyright}>© 2026 WiamApp · Powered by WiamLabs</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  backBtn:   { marginTop: 16, marginBottom: 8, width: 40 },

  brand:     { alignItems: 'center', marginBottom: 20 },
  logo:      { width: 56, height: 56, marginBottom: 10 },
  brandName: { fontSize: 24, fontWeight: '800', letterSpacing: 0.5 },

  title:    { color: WHITE, fontSize: 22, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: MUTED, fontSize: 13, marginBottom: 24, lineHeight: 19 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 14,
  },
  errorText: { color: '#EF4444', fontSize: 12, flex: 1 },

  label: {
    color: 'rgba(255,255,255,0.55)', fontSize: 12,
    fontWeight: '500', marginBottom: 7, marginTop: 14, letterSpacing: 0.3,
  },
  inputWrap: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center',
  },
  inputIcon: { marginRight: 10 },
  input:     { color: WHITE, fontSize: 14 },

  forgotBtn:  { alignSelf: 'flex-end', marginTop: 10, marginBottom: 4 },
  forgotText: { color: GOLD, fontSize: 13, fontWeight: '500' },

  loginBtn: {
    backgroundColor: GOLD, borderRadius: 13,
    paddingVertical: 15, alignItems: 'center',
    marginTop: 20, marginBottom: 14,
    flexDirection: 'row', justifyContent: 'center',
  },
  loginBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  loginBtnText:     { color: BG, fontSize: 15, fontWeight: '700' },

  registerText: { color: MUTED, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  registerLink: { color: GOLD, fontWeight: '600' },
  copyright:    { color: 'rgba(212,160,23,0.3)', fontSize: 10, textAlign: 'center', letterSpacing: 0.5 },
});
