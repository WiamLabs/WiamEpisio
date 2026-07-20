/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Image,
  Linking,
  Animated,
} from 'react-native';
import { Eye, EyeOff, Check, X as XIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';
import apiClient from '../../api/client';
import BrandHeader from '../../components/auth/BrandHeader';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const STEPS = 4;
const STEP_TITLES = [
  'Your account',
  'Your name',
  'Pick a username',
  'A few more details',
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ageFromYmd(ymd) {
  const s = (ymd || '').trim();
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  const y = +parts[0];
  const m = +parts[1] - 1;
  const d = +parts[2];
  const bd = new Date(y, m, d);
  if (bd.getFullYear() !== y || bd.getMonth() !== m || bd.getDate() !== d) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() < m || (today.getMonth() === m && today.getDate() < d)) age--;
  return age;
}

/** Common props that suppress autofill yellow boxes on iOS and Android. */
const AUTOFILL_OFF = {
  autoComplete: 'off',
  autoCorrect: false,
  importantForAutofill: 'no',
  textContentType: 'oneTimeCode',
  passwordRules: '',
};

const PasswordField = ({ value, onChangeText, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.pwWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.pwInput}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        secureTextEntry={!show}
        keyboardType={
          show && Platform.OS === 'android' ? 'visible-password' : 'default'
        }
        autoCapitalize="none"
        {...AUTOFILL_OFF}
      />
      <TouchableOpacity
        onPress={() => setShow((v) => !v)}
        style={styles.pwToggle}
        hitSlop={10}
      >
        {show ? (
          <EyeOff color={COLORS.textMuted} size={18} />
        ) : (
          <Eye color={COLORS.textMuted} size={18} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const RegisterScreen = ({ navigation }) => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState({
    checking: false,
    ok: null,
    message: '',
  });
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);

  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const stepFade = useRef(new Animated.Value(1)).current;

  const progress = useMemo(
    () => Array.from({ length: STEPS }, (_, i) => i + 1),
    [],
  );

  const goToAuthScreen = (screenName) => {
    const parent = navigation.getParent?.();
    if (parent?.getState?.().routeNames?.includes(screenName)) {
      parent.navigate(screenName);
      return;
    }
    navigation.navigate(screenName);
  };

  useEffect(() => {
    if (step !== 3 || username.trim().length < 3) {
      setUsernameStatus({ checking: false, ok: null, message: '' });
      return;
    }
    let cancelled = false;
    setUsernameStatus({ checking: true, ok: null, message: '' });
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get(
          `/auth/check-username?username=${encodeURIComponent(username.trim().toLowerCase())}`,
        );
        if (cancelled) return;
        setUsernameStatus({
          checking: false,
          ok: !!res.data?.available,
          message: res.data?.available
            ? 'This username is available.'
            : res.data?.reason || 'This username is already taken.',
        });
      } catch (_) {
        if (cancelled) return;
        setUsernameStatus({
          checking: false,
          ok: null,
          message: 'We could not check this username. Try again.',
        });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [step, username]);

  const validateStep = (n) => {
    setError('');
    setUsernameSuggestions([]);
    if (n === 1) {
      if (!email.trim() || !EMAIL_RE.test(email.trim())) {
        setError('Enter a valid email address.');
        return false;
      }
      if (password.length < 8) {
        setError('Your password must be at least 8 characters.');
        return false;
      }
      if (password !== confirmPassword) {
        setError('Your passwords do not match.');
        return false;
      }
      if (!acceptTerms) {
        setError('Please agree to the Terms and Privacy Policy.');
        return false;
      }
      return true;
    }
    if (n === 2) {
      if (!firstName.trim()) {
        setError('Please enter your first name.');
        return false;
      }
      return true;
    }
    if (n === 3) {
      const u = username.trim().toLowerCase();
      if (u.length < 3) {
        setError('Pick a username with at least 3 characters.');
        return false;
      }
      if (usernameStatus.ok === false) {
        setError(usernameStatus.message || 'Choose a different username.');
        return false;
      }
      if (usernameStatus.checking || usernameStatus.ok !== true) {
        setError('Hang on while we check this username.');
        return false;
      }
      return true;
    }
    if (n === 4) {
      if (!dob.trim()) {
        setError('Please enter your date of birth.');
        return false;
      }
      const age = ageFromYmd(dob);
      if (age == null) {
        setError('Use the format YYYY-MM-DD.');
        return false;
      }
      if (age < 13) {
        setError('You must be at least 13 years old to join WiamApp.');
        return false;
      }
      return true;
    }
    return true;
  };

  const animateStep = (next) => {
    Animated.sequence([
      Animated.timing(stepFade, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(stepFade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
    setStep(next);
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    if (step < STEPS) animateStep(step + 1);
  };

  const goBack = () => {
    setError('');
    setUsernameSuggestions([]);
    if (step > 1) animateStep(step - 1);
    else navigation.goBack();
  };

  const onSubmit = async () => {
    if (!validateStep(4)) return;
    setLoading(true);
    setError('');
    setUsernameSuggestions([]);
    try {
      const data = await authApi.register({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim().toLowerCase(),
        dateOfBirth: dob.trim(),
        phone: phone.trim(),
      });
      await setAuth(data.user, data.token);
    } catch (e) {
      const msg =
        typeof e === 'string' ? e : e?.error || 'We could not create your account.';
      setError(msg);
      if (Array.isArray(e?.suggestions)) setUsernameSuggestions(e.suggestions);
    } finally {
      setLoading(false);
    }
  };

  const openTerms = () => Linking.openURL('https://wiamapp.com/terms');
  const openPrivacy = () => Linking.openURL('https://wiamapp.com/privacy');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BrandHeader title="Create your account" onBack={goBack} />
      <KeyboardAvoidingView
        style={styles.kbWrap}
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
            <Text style={styles.heroTitle}>Join WiamApp</Text>
            <Text style={styles.heroSub}>
              Discover stories that move your soul.
            </Text>
          </View>

          <View style={styles.progressRow}>
            {progress.map((p) => (
              <View
                key={p}
                style={[styles.progressBar, p <= step && styles.progressBarActive]}
              />
            ))}
          </View>
          <Text style={styles.stepHint}>
            Step {step} of {STEPS} · {STEP_TITLES[step - 1]}
          </Text>

          <Animated.View style={[styles.card, { opacity: stepFade }]}>
            {step === 1 ? (
              <>
                <Text style={styles.fieldLabel}>Email</Text>
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
                <Text style={styles.fieldLabel}>Password</Text>
                <PasswordField
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                />
                <Text style={styles.fieldLabel}>Confirm password</Text>
                <PasswordField
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password"
                />
                <TouchableOpacity
                  style={styles.termsRow}
                  onPress={() => setAcceptTerms((v) => !v)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      acceptTerms && styles.checkboxChecked,
                    ]}
                  >
                    {acceptTerms ? (
                      <Check color={COLORS.black} size={12} strokeWidth={3} />
                    ) : null}
                  </View>
                  <Text style={styles.termsText}>
                    I agree to the{' '}
                    <Text style={styles.linkGold} onPress={openTerms}>
                      Terms
                    </Text>{' '}
                    and{' '}
                    <Text style={styles.linkGold} onPress={openPrivacy}>
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            {step === 2 ? (
              <View style={styles.nameRow}>
                <View style={styles.nameCol}>
                  <Text style={styles.fieldLabel}>First name</Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    style={styles.input}
                    autoCapitalize="words"
                    placeholder="Your first name"
                    placeholderTextColor={COLORS.textMuted}
                    {...AUTOFILL_OFF}
                  />
                </View>
                <View style={styles.nameCol}>
                  <Text style={styles.fieldLabel}>Last name (optional)</Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    style={styles.input}
                    autoCapitalize="words"
                    placeholder="Your last name"
                    placeholderTextColor={COLORS.textMuted}
                    {...AUTOFILL_OFF}
                  />
                </View>
              </View>
            ) : null}

            {step === 3 ? (
              <>
                <Text style={styles.fieldLabel}>Username</Text>
                <View style={styles.usernameWrap}>
                  <TextInput
                    value={username}
                    onChangeText={(v) =>
                      setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    style={[
                      styles.usernameInput,
                      usernameStatus.ok === true && styles.usernameInputOk,
                      usernameStatus.ok === false && styles.usernameInputBad,
                    ]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Letters, numbers, underscores"
                    placeholderTextColor={COLORS.textMuted}
                    {...AUTOFILL_OFF}
                  />
                  <View style={styles.usernameBadge}>
                    {usernameStatus.checking ? (
                      <ActivityIndicator color={COLORS.secondary} size="small" />
                    ) : usernameStatus.ok === true ? (
                      <Check color={COLORS.success} size={18} strokeWidth={3} />
                    ) : usernameStatus.ok === false ? (
                      <XIcon color={COLORS.error} size={18} strokeWidth={3} />
                    ) : null}
                  </View>
                </View>
                {usernameStatus.message ? (
                  <Text
                    style={[
                      styles.statusLine,
                      usernameStatus.ok === true && styles.statusLineOk,
                      usernameStatus.ok === false && styles.statusLineBad,
                    ]}
                  >
                    {usernameStatus.message}
                  </Text>
                ) : (
                  <Text style={styles.statusHint}>
                    Your username is unique and is how readers find you.
                  </Text>
                )}
                {usernameSuggestions.length ? (
                  <View style={styles.suggestRow}>
                    {usernameSuggestions.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={styles.suggestChip}
                        onPress={() => setUsername(s)}
                      >
                        <Text style={styles.suggestChipText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {step === 4 ? (
              <>
                <Text style={styles.fieldLabel}>Date of birth</Text>
                <TextInput
                  value={dob}
                  onChangeText={setDob}
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  {...AUTOFILL_OFF}
                />
                <Text style={styles.helper}>
                  You must be at least 13 years old to join WiamApp.
                </Text>
                <Text style={styles.fieldLabel}>Phone (optional)</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  style={styles.input}
                  keyboardType="phone-pad"
                  placeholder="e.g. +233 24 123 4567"
                  placeholderTextColor={COLORS.textMuted}
                  {...AUTOFILL_OFF}
                />
              </>
            ) : null}
          </Animated.View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={goBack}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
            {step < STEPS ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={goNext}
                disabled={loading}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.black} />
                ) : (
                  <Text style={styles.primaryBtnText}>Create account</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={() => goToAuthScreen('Login')}
            style={styles.footerLink}
          >
            <Text style={styles.footerLinkText}>
              <Text style={styles.linkMuted}>Already have an account?</Text>{' '}
              <Text style={styles.linkGold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  kbWrap: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  heroWrap: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: SPACING.sm,
  },
  heroTitle: {
    color: COLORS.text,
    fontFamily: FONTS.display,
    fontSize: 28,
    textAlign: 'center',
  },
  heroSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.xs,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressBarActive: { backgroundColor: COLORS.secondary },
  stepHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: SPACING.md,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '600',
  },
  helper: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
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
    fontSize: 15,
  },
  pwWrap: { position: 'relative', marginBottom: SPACING.md },
  pwInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingLeft: 14,
    paddingRight: 44,
    paddingVertical: 12,
    fontSize: 15,
  },
  pwToggle: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    marginTop: 2,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  termsText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },
  nameRow: { flexDirection: 'row', gap: SPACING.sm },
  nameCol: { flex: 1 },
  usernameWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  usernameInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingLeft: 14,
    paddingRight: 44,
    paddingVertical: 12,
    fontSize: 15,
  },
  usernameInputOk: { borderColor: COLORS.success },
  usernameInputBad: { borderColor: COLORS.error },
  usernameBadge: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusLine: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  statusLineOk: { color: COLORS.success },
  statusLineBad: { color: COLORS.error },
  statusHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: SPACING.xs,
  },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.4)',
    backgroundColor: 'rgba(212,168,67,0.08)',
  },
  suggestChipText: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  error: {
    color: COLORS.error,
    fontSize: 13,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  navRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  secondaryBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
  primaryBtn: {
    flex: 1.4,
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: { color: COLORS.black, fontWeight: '700', fontSize: 15 },
  footerLink: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  footerLinkText: { textAlign: 'center' },
  linkMuted: { color: COLORS.textMuted },
  linkGold: { color: COLORS.secondary, fontWeight: '700' },
});

export default RegisterScreen;
