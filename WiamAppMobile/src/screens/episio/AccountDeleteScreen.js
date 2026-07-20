/**
 * Account delete — type DELETE + password → hard purge via API.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';

const CONFIRM_WORD = 'DELETE';

const AccountDeleteScreen = () => {
  const navigation = useNavigation();
  const logout = useAuthStore((s) => s.logout);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [text, setText] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (text.trim().toUpperCase() !== CONFIRM_WORD) {
      Alert.alert('Confirm deletion', `Type ${CONFIRM_WORD} to confirm.`);
      return;
    }
    if (!password.trim()) {
      Alert.alert('Password required', 'Enter your account password to permanently delete.');
      return;
    }
    if (!isAuthenticated || !token) {
      Alert.alert(
        'Sign in required',
        'Your session expired. Sign in again, then open Delete account.',
        [{ text: 'Sign in', onPress: () => navigation.navigate('Login') }],
      );
      return;
    }
    Alert.alert(
      'Delete forever?',
      'Your account, profile, Studio channel, watch history, and coins will be permanently removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await authApi.deleteAccount(password.trim());
              await logout();
              Alert.alert('Deleted', 'Your account has been permanently removed.');
              navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
            } catch (e) {
              const msg = typeof e === 'string' ? e : (e?.message || 'Try again');
              if (/authorization|session|sign in|expired|token/i.test(msg)) {
                Alert.alert(
                  'Session expired',
                  'Sign in again, then try deleting your account.',
                  [{ text: 'Sign in', onPress: () => navigation.navigate('Login') }],
                );
              } else {
                Alert.alert('Delete failed', msg);
              }
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <EpisioScreenShell
      title="Delete account"
      subtitle="Permanent action"
      footer={(
        <TouchableOpacity
          style={[
            styles.danger,
            (text.trim().toUpperCase() !== CONFIRM_WORD || !password.trim() || busy) && styles.dangerOff,
          ]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.dangerText}>Delete my account forever</Text>
          )}
        </TouchableOpacity>
      )}
    >
      <Text style={styles.warn}>
        This permanently removes your profile, watch history, coins, and Studio access. It cannot be undone.
      </Text>
      <Text style={styles.label}>Type {CONFIRM_WORD} to confirm</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={CONFIRM_WORD}
        placeholderTextColor={COLORS.textFaint}
        autoCapitalize="characters"
      />
      <Text style={styles.label}>Account password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        placeholderTextColor={COLORS.textFaint}
        secureTextEntry
        autoCapitalize="none"
      />
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  warn: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.error, lineHeight: 21, marginTop: 12 },
  label: { fontFamily: FONTS.semi, fontSize: 13, color: COLORS.textDim, marginTop: 24, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 14, fontFamily: FONTS.bold, fontSize: 16, color: COLORS.text, letterSpacing: 1,
  },
  danger: { backgroundColor: COLORS.error, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  dangerOff: { opacity: 0.45 },
  dangerText: { fontFamily: FONTS.extraBold, fontSize: 14, color: '#fff' },
});

export default AccountDeleteScreen;
