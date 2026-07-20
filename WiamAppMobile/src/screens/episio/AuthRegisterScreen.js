/**
 * Sign up — email + password (no SMS). Phone is optional contact only.
 * Google / Facebook slots kept. Guest can keep browsing.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  X, Mail, Lock, User, Calendar, Coins, Eye, EyeOff, Phone,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import authApi from '../../api/auth';
import apiClient from '../../api/client';
import useAuthStore from '../../store/useAuthStore';
import { GoogleSignInSlot } from '../../services/googleAuth';

const AuthRegisterScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const setAuth = useAuthStore((s) => s.setAuth);
  const returnTo = route.params?.returnTo;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, ok: null, message: '' });
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main');
  };

  const afterAuth = () => {
    if (returnTo) {
      navigation.replace(returnTo, route.params?.returnParams || {});
      return;
    }
    navigation.replace('AgeGate', { fromRegister: true });
  };

  useEffect(() => {
    const u = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (u.length < 3) {
      setUsernameStatus({ checking: false, ok: null, message: '' });
      return undefined;
    }
    let cancelled = false;
    setUsernameStatus({ checking: true, ok: null, message: '' });
    const t = setTimeout(async () => {
      try {
        const { data } = await apiClient.get(`/auth/check-username?username=${encodeURIComponent(u)}`);
        if (cancelled) return;
        setUsernameStatus({
          checking: false,
          ok: !!data?.available,
          message: data?.available
            ? 'Username is available'
            : (data?.reason || 'Username is taken'),
        });
      } catch {
        if (!cancelled) {
          setUsernameStatus({ checking: false, ok: null, message: 'Could not check username' });
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username]);

  const submit = async () => {
    setError(null);
    const e = email.trim().toLowerCase();
    const uname = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!e || !password) {
      setError('Email and password are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
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
    if (usernameStatus.ok === false) {
      setError('Pick an available username');
      return;
    }
    if (!dob.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) {
      setError('Date of birth required (YYYY-MM-DD)');
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
        dateOfBirth: dob.trim(),
        phone: phone.trim() || undefined,
      });
      await setAuth(data.user, data.token);
      afterAuth();
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
            Sign up with email — unlock <Text style={styles.gold}>3 free episodes</Text>
            {'\n'}instantly, on us. No SMS required.
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
            placeholder="Password (min 8)"
            placeholderTextColor={COLORS.textFaint}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
            {showPassword ? <EyeOff size={16} color={COLORS.textFaint} /> : <Eye size={16} color={COLORS.textFaint} />}
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <User size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={COLORS.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
        </View>
        {usernameStatus.message ? (
          <Text style={[styles.hint, usernameStatus.ok === false && styles.error]}>
            {usernameStatus.checking ? 'Checking…' : usernameStatus.message}
          </Text>
        ) : null}

        <View style={styles.field}>
          <Calendar size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="Date of birth (YYYY-MM-DD)"
            placeholderTextColor={COLORS.textFaint}
            value={dob}
            onChangeText={setDob}
            autoCapitalize="none"
          />
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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <EpisioGoldButton
          label={busy ? 'Creating account…' : 'Create account'}
          onPress={submit}
          loading={busy}
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
            afterAuth();
          }}
          onError={(msg) => setError(typeof msg === 'string' ? msg : 'Google sign-up failed')}
        >
          {(g) => (
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => Alert.alert('Facebook', 'Facebook sign-up is not available yet.')}
              >
                <Text style={styles.socialText}>Facebook</Text>
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
            onPress={() => navigation.replace('Login', { returnTo })}
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
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  input: { flex: 1, color: '#fff', fontFamily: FONTS.regular, fontSize: 13.5, padding: 0 },
  row2: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  hint: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textDim, marginTop: -6, marginBottom: 10 },
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
