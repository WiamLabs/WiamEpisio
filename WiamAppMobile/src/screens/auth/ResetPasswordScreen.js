import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck } from 'lucide-react-native';
import authApi from '../../api/auth';
import BrandHeader from '../../components/auth/BrandHeader';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const ResetPasswordScreen = ({ route, navigation }) => {
  const presetEmail = route.params?.email || '';
  const [email, setEmail] = useState(presetEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const onSubmit = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await authApi.resetPassword(email.trim(), code.trim(), newPassword, confirmPassword);
      setMessage(res?.message || 'Password reset successful.');
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError('');
    setMessage('');
    try {
      const res = await authApi.forgotPassword(email.trim());
      setMessage(res?.message || 'Reset code sent.');
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Unable to resend code.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BrandHeader title="Reset password" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.form}>
        <View style={styles.iconWrap}>
          <ShieldCheck color={COLORS.secondary} size={28} />
        </View>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>Enter the code sent to your email.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@example.com"
          placeholderTextColor={COLORS.textMuted}
        />

        <Text style={styles.label}>Reset code</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          style={[styles.input, styles.codeInput]}
          keyboardType="number-pad"
          placeholder="000000"
          placeholderTextColor={COLORS.textMuted}
          maxLength={6}
        />

        <Text style={styles.label}>New password</Text>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.input}
          secureTextEntry
          placeholder="Min. 8 characters"
          placeholderTextColor={COLORS.textMuted}
        />

        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.input}
          secureTextEntry
          placeholder="Re-enter password"
          placeholderTextColor={COLORS.textMuted}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <TouchableOpacity style={styles.submit} onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.submitText}>Reset Password</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={onResend}>
          <Text style={styles.resend}>Didn&apos;t receive the code? Resend</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.backLink}>Back to login</Text>
        </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
  form: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(212,168,67,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  title: { color: COLORS.text, textAlign: 'center', fontSize: 30, fontFamily: FONTS.display },
  subtitle: { color: COLORS.textMuted, textAlign: 'center', marginTop: 8, marginBottom: SPACING.lg },
  label: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: SPACING.md,
  },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 22, fontWeight: '700' },
  submit: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  submitText: { color: COLORS.black, fontWeight: '700', fontSize: 15 },
  resend: { color: COLORS.secondary, textAlign: 'center', marginTop: SPACING.lg, fontSize: 13, fontWeight: '600' },
  backLink: { textAlign: 'center', color: COLORS.textMuted, marginTop: SPACING.sm, fontSize: 13 },
  error: { color: COLORS.error, marginBottom: SPACING.sm },
  success: { color: COLORS.success, marginBottom: SPACING.sm },
});

export default ResetPasswordScreen;
