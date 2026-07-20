/**
 * Style: WiamEpisio-OTP-Verify.html
 * flows: register_verify → AgeGate · forgot → ResetPassword · legacy register phone
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform,
  BackHandler, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';

const OTP_LEN = 6;
const EXPIRES_SEC = 180;

const OtpVerifyScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const patchUser = useAuthStore((s) => s.patchUser);
  const hiddenRef = useRef(null);

  const email = route.params?.email || '';
  const phone = route.params?.phone || '';
  const flow = route.params?.flow || '';
  const sticky = !!route.params?.sticky || flow === 'register_verify';
  const birthYear = route.params?.birthYear;
  const destination = email || phone || 'your email';

  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(EXPIRES_SEC);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!sticky) return undefined;
      const onBack = () => true;
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      const unsub = navigation.addListener('beforeRemove', (e) => {
        if (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP') {
          e.preventDefault();
        }
      });
      return () => {
        sub.remove();
        unsub();
      };
    }, [navigation, sticky]),
  );

  const digits = code.padEnd(OTP_LEN, ' ').split('').slice(0, OTP_LEN);
  const activeIndex = Math.min(code.length, OTP_LEN - 1);
  const timer = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  const verify = async () => {
    if (code.length < OTP_LEN || busy) return;
    setError(null);

    if (flow === 'register_verify') {
      setBusy(true);
      try {
        const data = await authApi.verifyEmail(code);
        if (data?.user) await patchUser(data.user);
        navigation.replace('AgeGate', {
          fromRegister: true,
          birthYear,
          sticky: true,
        });
      } catch (e) {
        setError(typeof e === 'string' ? e : (e?.message || 'Invalid code'));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (flow === 'register') {
      navigation.navigate('AuthRegister', {
        phone: phone || email,
        phoneVerified: true,
      });
      return;
    }

    if (flow === 'forgot') {
      navigation.navigate('ResetPassword', {
        email: email || undefined,
        phone: phone || undefined,
        code,
      });
      return;
    }

    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Main');
  };

  const resend = async () => {
    if (secondsLeft > 0) return;
    if (flow === 'register_verify') {
      try {
        await authApi.sendVerifyCode();
        setSecondsLeft(EXPIRES_SEC);
        setCode('');
        hiddenRef.current?.focus();
      } catch (e) {
        Alert.alert('Resend', typeof e === 'string' ? e : 'Could not resend');
      }
      return;
    }
    setSecondsLeft(EXPIRES_SEC);
    setCode('');
    hiddenRef.current?.focus();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {!sticky ? (
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={15} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={{ height: 34, marginBottom: 26 }} />
      )}

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
        autoComplete="one-time-code"
        style={styles.hiddenInput}
        autoFocus
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.timerRow}>
        Code expires in <Text style={styles.timerBold}>{timer}</Text>
      </Text>

      <EpisioGoldButton
        label={busy ? 'Verifying…' : 'Verify Code'}
        onPress={verify}
        disabled={code.length < OTP_LEN || busy}
        loading={busy}
        style={styles.verifyBtn}
        textStyle={styles.verifyText}
      />

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
  sub: { fontSize: 12.5, color: '#7D7D97', lineHeight: 20 },
  subBold: { color: '#fff', fontFamily: FONTS.bold },
  otpRow: { flexDirection: 'row', gap: 9, marginBottom: 16 },
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
  error: { color: COLORS.error, fontFamily: FONTS.medium, fontSize: 12.5, marginBottom: 10, textAlign: 'center' },
  timerRow: { textAlign: 'center', fontSize: 12.5, color: '#7D7D97', marginBottom: 26 },
  timerBold: { color: COLORS.gold, fontFamily: FONTS.extraBold },
  verifyBtn: { marginBottom: 20 },
  verifyText: { fontSize: 14.5 },
  bottom: { marginTop: 'auto', paddingBottom: 16, alignItems: 'center' },
  resendLink: { fontSize: 13, color: '#7D7D97' },
  resendAction: { color: COLORS.gold, fontFamily: FONTS.bold },
});

export default OtpVerifyScreen;
