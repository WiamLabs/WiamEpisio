/**
 * Sign up — email + password. Username suggested from name, shown with @.
 * Strong password required. DOB via picker.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  X, Mail, Lock, User, Calendar, Coins, Eye, EyeOff, Phone, AtSign,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import DobPickerField from '../../components/episio/DobPickerField';
import authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';
import { GoogleSignInSlot } from '../../services/googleAuth';

function suggestUsername(firstName, lastName) {
  const a = String(firstName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = String(lastName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let base = `${a}${b}`.slice(0, 24);
  if (base.length < 3) base = (a || b || 'watcher').slice(0, 24);
  return base;
}

function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}

function passwordStrengthError(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[a-z]/.test(password)) return 'Add a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Add an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Add a number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Add a symbol (e.g. ! @ # $)';
  return null;
}

const AuthRegisterScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const setAuth = useAuthStore((s) => s.setAuth);
  const returnTo = route.params?.returnTo;
  const returnParams = route.params?.returnParams || {};

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, ok: null, message: '' });
  const [statusVisible, setStatusVisible] = useState(false);
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fadeTimer = useRef(null);

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main');
  };

  const afterAuth = (user) => {
    if (returnTo) {
      navigation.replace(returnTo, returnParams);
      return;
    }
    navigation.replace('VerifyMethod', {
      fromRegister: true,
      email: user?.email || email.trim().toLowerCase(),
      dateOfBirth: dob,
    });
  };

  // Suggest username from name until user edits it
  useEffect(() => {
    if (usernameEdited) return;
    const suggested = suggestUsername(firstName, lastName);
    if (suggested.length >= 3) setUsername(suggested);
  }, [firstName, lastName, usernameEdited]);

  useEffect(() => {
    const u = normalizeUsername(username);
    if (u.length < 3) {
      setUsernameStatus({ checking: false, ok: null, message: u ? 'At least 3 characters' : '' });
      setStatusVisible(!!u);
      return undefined;
    }
    let cancelled = false;
    setUsernameStatus({ checking: true, ok: null, message: 'Checking…' });
    setStatusVisible(true);
    const t = setTimeout(async () => {
      try {
        const data = await authApi.checkUsername(u);
        if (cancelled) return;
        const available = !!data?.available;
        setUsernameStatus({
          checking: false,
          ok: available,
          message: available
            ? 'Username is available'
            : (data?.reason || 'Username is taken'),
        });
        setStatusVisible(true);
        if (fadeTimer.current) clearTimeout(fadeTimer.current);
        fadeTimer.current = setTimeout(() => setStatusVisible(false), 4000);
      } catch (err) {
        if (!cancelled) {
          setUsernameStatus({
            checking: false,
            ok: null,
            message: typeof err === 'string' ? err : 'Could not check username — try again',
          });
          setStatusVisible(true);
        }
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username]);

  useEffect(() => () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }, []);

  const submit = async () => {
    setError(null);
    const e = email.trim().toLowerCase();
    const uname = normalizeUsername(username);
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!e || !password) {
      setError('Email and password are required');
      return;
    }
    const pwErr = passwordStrengthError(password);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (!fn) {
      setError('First name is required');
      return;
    }
    if (!uname || uname.length < 3) {
      setError('Username must be at least 3 characters (letters, numbers, _)');
      return;
    }
    if (usernameStatus.checking) {
      setError('Wait for username check to finish');
      return;
    }
    if (usernameStatus.ok !== true) {
      setError(usernameStatus.message || 'Pick an available username');
      return;
    }
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      setError('Please select your date of birth');
      return;
    }
    setBusy(true);
    try {
      const data = await authApi.register({
        email: e,
        password,
        firstName: fn,
        lastName: ln,
        username: uname,
        dateOfBirth: dob,
        phone: phone.trim() || undefined,
        referralCode: inviteCode.trim() || undefined,
      });
      await setAuth(data.user, data.token);
      afterAuth(data.user);
    } catch (err) {
      const msg =
        (typeof err === 'string' && err)
        || err?.error
        || err?.message
        || 'Something went wrong';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = !busy
    && usernameStatus.ok === true
    && !usernameStatus.checking
    && !!dob
    && !passwordStrengthError(password);

  const pwHint = password
    ? (passwordStrengthError(password) || 'Strong password')
    : '8+ chars with upper, lower, number & symbol';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.close} onPress={close}>
          <X size={16} color="#fff" />
        </TouchableOpacity>

        <View style={styles.hero}>
          <View style={styles.coinBurstWrap}>
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.coinBurst}>
              <Coins size={34} color={COLORS.navy} fill={COLORS.navy} />
            </LinearGradient>
          </View>
          <Text style={styles.title}>Get 50 Free Coins</Text>
          <Text style={styles.sub}>
            Sign up now and unlock <Text style={styles.gold}>3 free episodes</Text>
            {'\n'}instantly, on us.
          </Text>
        </View>

        <View style={styles.row2}>
          <View style={[styles.field, styles.half]}>
            <User size={15} color={COLORS.gold} />
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor={COLORS.textFaint}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
          </View>
          <View style={[styles.field, styles.half]}>
            <User size={15} color={COLORS.gold} />
            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor={COLORS.textFaint}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Mail size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.textFaint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.field}>
          <Lock size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.textFaint}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
            {showPassword ? <EyeOff size={16} color={COLORS.textFaint} /> : <Eye size={16} color={COLORS.textFaint} />}
          </TouchableOpacity>
        </View>
        <Text style={[styles.hint, password && !passwordStrengthError(password) && styles.okHint]}>
          {pwHint}
        </Text>

        <Text style={styles.fieldLabel}>Username</Text>
        <View style={styles.field}>
          <AtSign size={15} color={COLORS.gold} />
          <Text style={styles.atPrefix}>@</Text>
          <TextInput
            style={styles.input}
            placeholder="username"
            placeholderTextColor={COLORS.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(t) => {
              setUsernameEdited(true);
              setUsername(normalizeUsername(t));
            }}
          />
        </View>
        {statusVisible && usernameStatus.message ? (
          <Text
            style={[
              styles.hint,
              usernameStatus.ok === true && styles.okHint,
              usernameStatus.ok === false && styles.error,
            ]}
          >
            {usernameStatus.message}
          </Text>
        ) : null}
        <Text style={styles.metaHint}>
          Suggested from your name — you can edit it. No spaces. Others can tag you as @{normalizeUsername(username) || 'username'}.
        </Text>

        <View style={styles.field}>
          <Calendar size={15} color={COLORS.gold} />
          <DobPickerField value={dob} onChange={setDob} />
        </View>

        <View style={styles.field}>
          <Phone size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="Phone (optional)"
            placeholderTextColor={COLORS.textFaint}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <View style={styles.field}>
          <User size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="Friend invite code (optional)"
            placeholderTextColor={COLORS.textFaint}
            autoCapitalize="characters"
            value={inviteCode}
            onChangeText={setInviteCode}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <EpisioGoldButton
          label={busy ? 'Creating account…' : 'Create account'}
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
          style={styles.cta}
        />

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.line} />
        </View>

        <GoogleSignInSlot
          onSuccess={async (data) => {
            await setAuth(data.user, data.token);
            afterAuth(data.user);
          }}
          onError={(msg) => setError(typeof msg === 'string' ? msg : 'Google sign-up failed')}
        >
          {(g) => (
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Alert.alert('Coming soon', 'This sign-up option is not available yet.')}
              >
                <Text style={styles.socialText}>Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => g.start()}
                disabled={g.signing}
              >
                {g.signing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.socialText}>Google{g.ready ? '' : ' · Soon'}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </GoogleSignInSlot>

        <View style={styles.bottom}>
          <TouchableOpacity onPress={close}>
            <Text style={styles.guest}>
              Not ready? <Text style={{ color: COLORS.gold, fontFamily: FONTS.semi }}>Keep browsing as guest</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.replace('Login', { returnTo, returnParams })}
            style={{ marginTop: 14 }}
          >
            <Text style={styles.guest}>
              Have an account? <Text style={{ color: COLORS.gold, fontFamily: FONTS.semi }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { paddingHorizontal: 26, paddingBottom: 40 },
  close: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  hero: { alignItems: 'center', marginBottom: 22 },
  coinBurstWrap: { marginBottom: 14 },
  coinBurst: {
    width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: FONTS.extraBold, fontSize: 19, color: '#fff', marginBottom: 6 },
  sub: {
    fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textDim, textAlign: 'center', lineHeight: 19,
  },
  gold: { color: COLORS.gold, fontFamily: FONTS.bold },
  fieldLabel: {
    fontSize: 11.5, fontFamily: FONTS.semi, color: COLORS.textDim, marginBottom: 7,
  },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  atPrefix: { color: COLORS.gold, fontFamily: FONTS.bold, fontSize: 14 },
  input: { flex: 1, color: '#fff', fontFamily: FONTS.regular, fontSize: 13.5, padding: 0 },
  row2: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  hint: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textDim, marginTop: -6, marginBottom: 10 },
  metaHint: {
    fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textFaint, marginTop: -4, marginBottom: 12, lineHeight: 16,
  },
  okHint: { color: '#4ade80' },
  error: { color: COLORS.error, fontFamily: FONTS.medium, fontSize: 12.5, marginBottom: 10 },
  cta: { marginTop: 4, marginBottom: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  line: { flex: 1, height: 1, backgroundColor: COLORS.navyLine },
  dividerText: { fontSize: 11.5, color: COLORS.textFaint, fontFamily: FONTS.regular },
  socialRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  socialBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center',
  },
  socialText: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#fff' },
  bottom: { alignItems: 'center', marginTop: 8 },
  guest: { fontSize: 12.5, color: COLORS.textDim, fontFamily: FONTS.regular, textAlign: 'center' },
});

export default AuthRegisterScreen;
