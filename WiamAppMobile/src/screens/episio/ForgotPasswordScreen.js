import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import authApi from '../../api/auth';

const ForgotPasswordScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const sendCode = async () => {
    setError(null);
    setBusy(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setInfo('If that email exists, a reset code was sent.');
      setStep(2);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Could not send code');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError(null);
    setBusy(true);
    try {
      await authApi.resetPassword(email.trim().toLowerCase(), code.trim(), password, confirm);
      setInfo('Password updated. Sign in.');
      navigation.replace('Login');
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingHorizontal: 20 }]}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <ChevronLeft size={20} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Reset password</Text>
      {step === 1 ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}
          <TouchableOpacity style={styles.btn} onPress={sendCode} disabled={busy}>
            {busy ? <ActivityIndicator color={COLORS.navy} /> : <Text style={styles.btnText}>Send code</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput style={styles.input} placeholder="Code" placeholderTextColor={COLORS.textFaint} value={code} onChangeText={setCode} />
          <TextInput style={styles.input} placeholder="New password" placeholderTextColor={COLORS.textFaint} secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput style={styles.input} placeholder="Confirm password" placeholderTextColor={COLORS.textFaint} secureTextEntry value={confirm} onChangeText={setConfirm} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.btn} onPress={reset} disabled={busy}>
            {busy ? <ActivityIndicator color={COLORS.navy} /> : <Text style={styles.btnText}>Update password</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontFamily: FONTS.extraBold, color: COLORS.text, marginBottom: 20 },
  input: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 14, padding: 14, color: COLORS.text, marginBottom: 12, fontFamily: FONTS.regular,
  },
  btn: { backgroundColor: COLORS.gold, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { fontFamily: FONTS.bold, color: COLORS.navy },
  error: { color: COLORS.error, marginBottom: 8, fontFamily: FONTS.medium },
  info: { color: COLORS.success, marginBottom: 8, fontFamily: FONTS.medium },
});

export default ForgotPasswordScreen;
