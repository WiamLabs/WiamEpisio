/**
 * Style: WiamEpisio-Forgot-Password.html
 * Email / Phone toggle · Send → OtpVerify → ResetPassword
 * Email path uses POST /auth/forgot-password (existing API).
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Lock, Mail, Phone } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import authApi from '../../api/auth';

const ForgotPasswordScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [method, setMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const sendCode = async () => {
    setError(null);
    if (method === 'email') {
      const e = email.trim().toLowerCase();
      if (!e || !e.includes('@')) {
        setError('Enter a valid email');
        return;
      }
      setBusy(true);
      try {
        await authApi.forgotPassword(e);
        navigation.navigate('OtpVerify', { email: e, flow: 'forgot' });
      } catch (err) {
        setError(typeof err === 'string' ? err : 'Could not send code');
      } finally {
        setBusy(false);
      }
      return;
    }

    const p = phone.trim();
    if (!p || p.replace(/\D/g, '').length < 9) {
      setError('Enter a valid phone number');
      return;
    }
    // Phone OTP UI matches HTML; reset API still needs email after verify.
    navigation.navigate('OtpVerify', { phone: p, flow: 'forgot' });
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
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={15} color="#fff" />
        </TouchableOpacity>

        <View style={styles.hero}>
          <View style={styles.iconBadge}>
            <Lock size={24} color={COLORS.gold} />
          </View>
          <Text style={styles.h1}>Forgot password?</Text>
          <Text style={styles.sub}>No worries — we'll send you a code to reset it.</Text>
        </View>

        <View style={styles.methodToggle}>
          <TouchableOpacity
            style={[styles.methodOpt, method === 'email' && styles.methodActive]}
            onPress={() => { setMethod('email'); setError(null); }}
          >
            <Text style={[styles.methodText, method === 'email' && styles.methodTextActive]}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.methodOpt, method === 'phone' && styles.methodActive]}
            onPress={() => { setMethod('phone'); setError(null); }}
          >
            <Text style={[styles.methodText, method === 'phone' && styles.methodTextActive]}>Phone Number</Text>
          </TouchableOpacity>
        </View>

        {method === 'email' ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={[styles.fieldBox, styles.fieldFocus]}>
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
          </View>
        ) : (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <View style={[styles.fieldBox, styles.fieldFocus]}>
              <Phone size={15} color={COLORS.gold} />
              <TextInput
                style={styles.input}
                placeholder="+233 …"
                placeholderTextColor={COLORS.textFaint}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <EpisioGoldButton
          label="Send Reset Code"
          onPress={sendCode}
          loading={busy}
          style={styles.sendBtn}
          textStyle={styles.sendText}
        />

        <View style={styles.bottom}>
          <TouchableOpacity onPress={() => navigation.replace('Login')}>
            <Text style={styles.loginLink}>
              Remember your password? <Text style={styles.loginAction}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { paddingHorizontal: 26, flexGrow: 1 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 26,
  },
  hero: { marginBottom: 30 },
  iconBadge: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  h1: { fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff', letterSpacing: -0.3, marginBottom: 8 },
  sub: { fontSize: 12.5, color: '#7D7D97', lineHeight: 20, fontFamily: FONTS.regular },
  methodToggle: {
    flexDirection: 'row', backgroundColor: COLORS.navyCard, borderWidth: 1,
    borderColor: COLORS.navyLine, borderRadius: 12, padding: 3, marginBottom: 20,
  },
  methodOpt: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  methodActive: { backgroundColor: COLORS.gold },
  methodText: { fontSize: 12, fontFamily: FONTS.bold, color: '#7D7D97' },
  methodTextActive: { color: COLORS.navy },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 11.5, fontFamily: FONTS.semi, color: '#7D7D97', marginBottom: 7 },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
  },
  fieldFocus: { borderColor: COLORS.gold },
  input: { flex: 1, color: '#fff', fontSize: 13.5, fontFamily: FONTS.regular, padding: 0 },
  error: { color: '#EF4444', marginBottom: 10, fontFamily: FONTS.medium, fontSize: 13 },
  sendBtn: { marginBottom: 20 },
  sendText: { fontSize: 14.5 },
  bottom: { marginTop: 'auto', paddingBottom: 16, alignItems: 'center' },
  loginLink: { fontSize: 13, color: '#7D7D97', fontFamily: FONTS.regular },
  loginAction: { color: COLORS.gold, fontFamily: FONTS.bold },
});

export default ForgotPasswordScreen;
