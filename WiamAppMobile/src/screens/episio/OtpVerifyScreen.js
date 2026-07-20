/**
 * Style: WiamEpisio-OTP-Verify.html
 * 6-digit OTP (local state) · Verify → goBack or Main
 * Params: email?, phone?
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const OTP_LEN = 6;
const EXPIRES_SEC = 180;

const OtpVerifyScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const hiddenRef = useRef(null);

  const destination = route.params?.email || route.params?.phone || 'your email or phone';
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(EXPIRES_SEC);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const digits = code.padEnd(OTP_LEN, ' ').split('').slice(0, OTP_LEN);
  const activeIndex = Math.min(code.length, OTP_LEN - 1);

  const timer = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  const verify = () => {
    if (code.length < OTP_LEN) return;
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Main');
  };

  const resend = () => {
    if (secondsLeft > 0) return;
    setSecondsLeft(EXPIRES_SEC);
    setCode('');
    hiddenRef.current?.focus();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <ArrowLeft size={15} color="#fff" />
      </TouchableOpacity>

      <View style={styles.hero}>
        <Text style={styles.h1}>Enter verification code</Text>
        <Text style={styles.sub}>
          We sent a 6-digit code to <Text style={styles.subBold}>{destination}</Text>
        </Text>
      </View>

      <TouchableOpacity activeOpacity={1} style={styles.otpRow} onPress={() => hiddenRef.current?.focus()}>
        {digits.map((d, i) => {
          const filled = d.trim().length > 0;
          const active = i === activeIndex && code.length < OTP_LEN;
          return (
            <View key={i} style={[styles.otpBox, filled && styles.otpFilled, active && styles.otpActive]}>
              <Text style={styles.otpDigit}>{filled ? d : ''}</Text>
            </View>
          );
        })}
      </TouchableOpacity>

      <TextInput
        ref={hiddenRef}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, OTP_LEN))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        style={styles.hiddenInput}
        autoFocus
      />

      <Text style={styles.timerRow}>
        Code expires in <Text style={styles.timerBold}>{timer}</Text>
      </Text>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={verify}
        disabled={code.length < OTP_LEN}
        style={{ opacity: code.length < OTP_LEN ? 0.45 : 1 }}
      >
        <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.verifyBtn}>
          <Text style={styles.verifyText}>Verify Code</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.bottom}>
        <Text style={styles.resendLink}>
          Didn't get it?{' '}
          <Text
            style={[styles.resendAction, secondsLeft > 0 && { opacity: 0.45 }]}
            onPress={resend}
          >
            Resend code
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy, paddingHorizontal: 26 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 26,
  },
  hero: { marginBottom: 32 },
  h1: { fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff', letterSpacing: -0.3, marginBottom: 8 },
  sub: { fontSize: 12.5, color: COLORS.textDim, lineHeight: 20 },
  subBold: { color: '#fff', fontFamily: FONTS.bold },
  otpRow: { flexDirection: 'row', gap: 9, marginBottom: 26 },
  otpBox: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1.5,
    borderColor: COLORS.navyLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpFilled: { borderColor: COLORS.gold },
  otpActive: { borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOpacity: 0.15, shadowRadius: 6 },
  otpDigit: { fontSize: 20, fontFamily: FONTS.extraBold, color: '#fff' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  timerRow: { textAlign: 'center', fontSize: 12.5, color: COLORS.textDim, marginBottom: 26 },
  timerBold: { color: COLORS.gold, fontFamily: FONTS.extraBold },
  verifyBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  verifyText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 14.5 },
  bottom: { marginTop: 'auto', paddingBottom: 16, alignItems: 'center' },
  resendLink: { fontSize: 13, color: COLORS.textDim },
  resendAction: { color: COLORS.gold, fontFamily: FONTS.bold },
});

export default OtpVerifyScreen;
