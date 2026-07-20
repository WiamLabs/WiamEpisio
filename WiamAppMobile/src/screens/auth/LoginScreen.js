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
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';
import BrandHeader from '../../components/auth/BrandHeader';
import BrandToast from '../../components/common/BrandToast';
import { GoogleSignInSlot } from '../../services/googleAuth';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const AUTOFILL_OFF = {
  autoComplete: 'off',
  autoCorrect: false,
  importantForAutofill: 'no',
  textContentType: 'oneTimeCode',
  passwordRules: '',
};

const LoginScreen = ({ navigation }) => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const goToAuthScreen = (screenName) => {
    const parent = navigation.getParent?.();
    if (parent?.getState?.().routeNames?.includes(screenName)) {
      parent.navigate(screenName);
      return;
    }
    navigation.navigate(screenName);
  };

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await authApi.login(email.trim(), password);
      await setAuth(data.user, data.token);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BrandHeader
        title="Welcome back"
        onBack={navigation.canGoBack && navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroWrap}>
            <Image
              source={{ uri: 'https://wiamapp.com/static/img/WiamLogo.png' }}
              style={styles.logo}
            />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to keep reading.</Text>
          </View>

          <View style={styles.form}>
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
              importantForAutofill="no"
              autoComplete="off"
            />
            <Text style={styles.label}>Password</Text>
            <View style={styles.pwWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.pwInput}
                secureTextEntry={!showPassword}
                keyboardType={
                  showPassword && Platform.OS === 'android'
                    ? 'visible-password'
                    : 'default'
                }
                placeholder="Your password"
                placeholderTextColor={COLORS.textMuted}
                {...AUTOFILL_OFF}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                style={styles.pwToggle}
                hitSlop={10}
              >
                {showPassword ? (
                  <EyeOff color={COLORS.textMuted} size={18} />
                ) : (
                  <Eye color={COLORS.textMuted} size={18} />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.forgotWrap}
              onPress={() => goToAuthScreen('ForgotPassword')}
            >
              <Text style={styles.forgot}>Forgot password?</Text>
            </TouchableOpacity>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.submit} onPress={onSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={COLORS.black} />
              ) : (
                <Text style={styles.submitText}>Sign in</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <GoogleSignInSlot
              onSuccess={async (data) => {
                if (data?.token) await setAuth(data.user, data.token);
              }}
              onError={(msg) => setToast(msg || 'Google sign-in failed.')}
            >
              {(google) => (
                <TouchableOpacity
                  style={styles.googleBtn}
                  onPress={() => google.start()}
                  disabled={google.signing}
                  activeOpacity={0.9}
                >
                  <View style={styles.googleG}>
                    <Text style={styles.googleGText}>G</Text>
                  </View>
                  {google.signing ? (
                    <ActivityIndicator color={COLORS.text} size="small" />
                  ) : (
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  )}
                </TouchableOpacity>
              )}
            </GoogleSignInSlot>
          </View>

          <TouchableOpacity onPress={() => goToAuthScreen('Register')} style={styles.footerLink}>
            <Text style={styles.link}>
              <Text style={styles.linkMuted}>New to WiamApp?</Text>{' '}
              <Text style={styles.linkGold}>Create an account</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <BrandToast message={toast} onClear={() => setToast('')} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
  },
  heroWrap: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  form: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: SPACING.sm,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    textAlign: 'center',
    fontFamily: FONTS.display,
  },
  subtitle: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    fontSize: 13,
  },
  footerLink: { marginTop: SPACING.lg, alignItems: 'center' },
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
  pwWrap: {
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  pwInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingLeft: 14,
    paddingRight: 44,
    paddingVertical: 12,
  },
  pwToggle: {
    position: 'absolute',
    right: 12,
    top: 11,
  },
  forgotWrap: {
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
  },
  forgot: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  submit: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 2,
  },
  submitText: {
    color: COLORS.black,
    fontWeight: '700',
    fontSize: 15,
  },
  error: {
    color: COLORS.error,
    marginBottom: SPACING.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  googleBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  googleG: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleGText: {
    color: '#4285F4',
    fontWeight: '900',
    fontSize: 13,
  },
  link: {
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  linkMuted: {
    color: COLORS.textMuted,
  },
  linkGold: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
});

export default LoginScreen;
