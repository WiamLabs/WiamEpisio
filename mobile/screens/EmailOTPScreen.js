// © 2026 WiamApp. Powered by WiamLabs
// screens/EmailOTPScreen.js
// Sent after registration — verify email with 6-digit OTP
// Backend: POST /api/auth/send-otp + POST /api/auth/verify-otp

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet,  StatusBar,
  Image, ActivityIndicator, Keyboard,
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

export default function EmailOTPScreen({ navigation, route }) {
  const { email, role } = route?.params || {};

  const [otp,        setOtp]        = useState(['', '', '', '', '', '']);
  const [loading,    setLoading]    = useState(false);
  const [resending,  setResending]  = useState(false);
  const [error,      setError]      = useState('');
  const [countdown,  setCountdown]  = useState(60);
  const [canResend,  setCanResend]  = useState(false);
  const inputs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Auto-send OTP when the screen opens (in case register didn't already)
  useEffect(() => {
    if (!email || !BACKEND) return;
    (async () => {
      try {
        await fetch(`${BACKEND}/api/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
      } catch (_) {}
    })();
  }, [email]);

  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text.replace(/[^0-9]/g, '');
    setOtp(newOtp);
    setError('');
    if (text && index < 5) inputs.current[index + 1]?.focus();
    if (!text && index > 0) inputs.current[index - 1]?.focus();
    // Auto-submit when all 6 filled
    if (newOtp.every(d => d !== '') && text) {
      Keyboard.dismiss();
      handleVerify(newOtp.join(''));
    }
  };

  const handleVerify = async (code) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${BACKEND}/api/auth/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid or expired code.');

      // Navigate based on role
      if (role === 'worker') {
        navigation.replace('WorkerVerifyIntro', { email });
      } else {
        navigation.replace('CustomerApp');
      }
    } catch (err) {
      setError(err.message);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResending(true);
    setError('');
    try {
      await fetch(`${BACKEND}/api/auth/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      setCountdown(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch {
      setError('Could not resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={s.container}>

        {/* Logo */}
        <View style={s.brand}>
          <Image source={LOGO} style={s.logo} resizeMode="contain" />
        </View>

        {/* Icon */}
        <View style={s.iconWrap}>
          <Ionicons name="mail-outline" size={32} color={GOLD} />
        </View>

        <Text style={s.title}>Check your email</Text>
        <Text style={s.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={s.email}>{email}</Text>
        </Text>

        {/* OTP inputs */}
        <View style={s.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={ref => inputs.current[i] = ref}
              style={[s.otpInput, digit && s.otpInputFilled, error && s.otpInputError]}
              value={digit}
              onChangeText={text => handleOtpChange(text, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              textAlign="center"
            />
          ))}
        </View>

        {/* Error */}
        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Verify button */}
        <TouchableOpacity
          style={[s.verifyBtn, (loading || otp.some(d => !d)) && s.verifyBtnDisabled]}
          onPress={() => handleVerify()}
          disabled={loading || otp.some(d => !d)}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={BG} />
            : <Text style={s.verifyBtnText}>Verify Email</Text>
          }
        </TouchableOpacity>

        {/* Resend */}
        <TouchableOpacity
          style={s.resendBtn}
          onPress={handleResend}
          disabled={!canResend || resending}
        >
          {resending
            ? <ActivityIndicator size="small" color={GOLD} />
            : <Text style={[s.resendText, !canResend && s.resendTextDisabled]}>
                {canResend
                  ? 'Resend code'
                  : `Resend in ${countdown}s`}
              </Text>
          }
        </TouchableOpacity>

        {/* Wrong email */}
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.wrongEmail}>Wrong email? Go back</Text>
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
    alignItems: 'center', justifyContent: 'center',
    paddingBottom: 40,
  },
  brand:   { marginBottom: 24 },
  logo:    { width: 52, height: 52 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: GOLD_BG, borderWidth: 1, borderColor: GOLD_BD,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title:    { color: WHITE, fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  email:    { color: GOLD, fontWeight: '600' },

  // OTP boxes
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  otpInput: {
    width: 46, height: 54, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    color: WHITE, fontSize: 22, fontWeight: '700',
  },
  otpInputFilled: { borderColor: GOLD, backgroundColor: GOLD_BG },
  otpInputError:  { borderColor: '#EF4444' },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 16, width: '100%',
  },
  errorText: { color: '#EF4444', fontSize: 12, flex: 1 },

  // Verify button
  verifyBtn: {
    backgroundColor: GOLD, borderRadius: 13,
    paddingVertical: 15, width: '100%',
    alignItems: 'center', marginBottom: 14,
  },
  verifyBtnDisabled: { backgroundColor: 'rgba(212,160,23,0.25)' },
  verifyBtnText:     { color: BG, fontSize: 15, fontWeight: '700' },

  // Resend
  resendBtn:         { marginBottom: 12 },
  resendText:        { color: GOLD, fontSize: 13, fontWeight: '600' },
  resendTextDisabled:{ color: MUTED },

  wrongEmail: { color: MUTED, fontSize: 13, marginBottom: 24 },
  copyright:  { color: 'rgba(212,160,23,0.3)', fontSize: 10, letterSpacing: 0.5 },
});
