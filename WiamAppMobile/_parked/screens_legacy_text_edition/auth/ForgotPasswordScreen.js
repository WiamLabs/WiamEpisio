/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
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
import { KeyRound } from 'lucide-react-native';
import authApi from '../../api/auth';
import BrandHeader from '../../components/auth/BrandHeader';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await authApi.forgotPassword(email.trim());
      setMessage(res?.message || 'If an account exists with this email, a reset code has been sent.');
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Unable to send reset code right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BrandHeader title="Forgot password" onBack={() => navigation.goBack()} />
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
          <KeyRound color={COLORS.secondary} size={28} />
        </View>
        <Text style={styles.title}>Forgot password?</Text>
        <Text style={styles.subtitle}>Enter your email and we&apos;ll send you a reset code.</Text>

        <Text style={styles.label}>Email address</Text>
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

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <TouchableOpacity style={styles.submit} onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.submitText}>Send Reset Code</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => navigation.navigate('ResetPassword', { email: email.trim() })}
        >
          <Text style={styles.nextButtonText}>I have a code</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.backLink}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
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
  title: {
    color: COLORS.text,
    textAlign: 'center',
    fontSize: 30,
    fontFamily: FONTS.display,
  },
  subtitle: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: SPACING.lg,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '600',
  },
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
  submit: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  submitText: {
    color: COLORS.black,
    fontWeight: '700',
    fontSize: 15,
  },
  nextButton: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: SPACING.sm,
  },
  nextButtonText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  backLink: {
    textAlign: 'center',
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
    fontSize: 13,
  },
  error: {
    color: COLORS.error,
    marginBottom: SPACING.sm,
  },
  success: {
    color: COLORS.success,
    marginBottom: SPACING.sm,
  },
});

export default ForgotPasswordScreen;
