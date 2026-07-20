/**
 * Style: WiamEpisio-Register.html (navy/gold, coin hero, social row).
 * Fields: what POST /auth/register requires for mobile —
 * email, password (≥8), first_name, username, date_of_birth; phone optional.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X, Phone, Mail, Lock, User, Calendar, Coins } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';
import { GoogleSignInSlot } from '../../services/googleAuth';

const AuthRegisterScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState(''); // YYYY-MM-DD
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main');
  };

  const submit = async () => {
    setError(null);
    const e = email.trim().toLowerCase();
    const uname = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const fn = firstName.trim();
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
        lastName: '',
        username: uname,
        dateOfBirth: dob.trim(),
        phone: phone.trim(),
      });
      await setAuth(data.user, data.token);
      close();
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
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.coinBurst}>
            <Coins size={34} color={COLORS.navy} fill={COLORS.navy} />
          </LinearGradient>
          <Text style={styles.title}>Get 50 Free Coins</Text>
          <Text style={styles.sub}>
            Sign up now and unlock <Text style={styles.gold}>3 free episodes</Text>
            {'\n'}instantly, on us.
          </Text>
        </View>

        <View style={styles.field}>
          <Phone size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="Phone number (optional)"
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
            placeholder="First name"
            placeholderTextColor={COLORS.textFaint}
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>
        <View style={styles.field}>
          <User size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={COLORS.textFaint}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
        </View>
        <View style={styles.field}>
          <Mail size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
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
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>
        <View style={styles.field}>
          <Calendar size={15} color={COLORS.gold} />
          <TextInput
            style={styles.input}
            placeholder="Date of birth (YYYY-MM-DD)"
            placeholderTextColor={COLORS.textFaint}
            autoCapitalize="none"
            value={dob}
            onChangeText={setDob}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.signupBtn} onPress={submit} disabled={busy} activeOpacity={0.9}>
          {busy ? (
            <ActivityIndicator color={COLORS.navy} />
          ) : (
            <Text style={styles.signupBtnText}>Continue</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.line} />
        </View>

        <GoogleSignInSlot
          onSuccess={async (data) => {
            await setAuth(data.user, data.token);
            close();
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
          <TouchableOpacity onPress={() => navigation.replace('Login')} style={{ marginTop: 14 }}>
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
  scroll: { paddingHorizontal: 26, flexGrow: 1, paddingBottom: 24 },
  close: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  hero: { alignItems: 'center', marginBottom: 22 },
  coinBurst: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 19, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 6 },
  sub: {
    fontSize: 12.5, color: COLORS.textDim, textAlign: 'center', lineHeight: 19, fontFamily: FONTS.regular,
  },
  gold: { color: COLORS.gold, fontFamily: FONTS.bold },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12,
  },
  input: { flex: 1, color: '#fff', fontSize: 13.5, fontFamily: FONTS.regular, padding: 0 },
  error: { color: '#EF4444', marginBottom: 8, fontFamily: FONTS.medium, fontSize: 13 },
  signupBtn: {
    paddingVertical: 15, borderRadius: 16, backgroundColor: COLORS.gold,
    alignItems: 'center', marginTop: 4, marginBottom: 16,
  },
  signupBtnText: { fontSize: 14.5, fontFamily: FONTS.bold, color: COLORS.navy },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  line: { flex: 1, height: 1, backgroundColor: COLORS.navyLine },
  dividerText: { fontSize: 11.5, color: COLORS.textFaint },
  socialRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  socialBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center',
  },
  socialText: { fontSize: 12.5, color: '#fff', fontFamily: FONTS.medium },
  bottom: { marginTop: 8, paddingBottom: 14, alignItems: 'center' },
  guest: { fontSize: 12.5, color: COLORS.textDim, fontFamily: FONTS.regular, textAlign: 'center' },
});

export default AuthRegisterScreen;
