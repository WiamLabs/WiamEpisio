/**
 * Invite friends — real referral code + share. +20 coins when friend verifies email (max 5/month).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert, ActivityIndicator, TextInput } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Gift, Copy } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import walletApi from '../../api/wallet';
import useAuthStore from '../../store/useAuthStore';
import CONFIG from '../../constants/config';

const InviteFriendsScreen = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [applyCode, setApplyCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    walletApi.getReferralCode()
      .then((d) => setCode(d.referral_code || ''))
      .catch(() => setCode(''))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const shareMessage = code
    ? `Join me on WiamEpisio — African short drama! Use code ${code} when you sign up.\n${CONFIG.SITE_ORIGIN}`
    : `Join me on WiamEpisio — African short drama!\n${CONFIG.SITE_ORIGIN}`;

  const copyCode = async () => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert('Copied', 'Invite code copied.');
    } catch {
      Alert.alert('Invite code', code);
    }
  };

  const share = () => Share.share({ message: shareMessage }).catch(() => {});

  const apply = async () => {
    const c = applyCode.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    try {
      await walletApi.applyReferralCode(c);
      Alert.alert('Applied', 'Invite code saved. Your friend earns coins when you verify your email.');
      setApplyCode('');
    } catch (e) {
      Alert.alert('Invite', e?.response?.data?.error || e?.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <EpisioScreenShell
      title="Invite friends"
      subtitle="You earn +20 coins when they verify email (max 5 / month)"
      footer={(
        <TouchableOpacity style={styles.cta} onPress={share} disabled={!isAuthenticated}>
          <Text style={styles.ctaText}>Share invite link</Text>
        </TouchableOpacity>
      )}
    >
      <View style={styles.hero}>
        <Gift size={40} color={COLORS.gold} />
        <Text style={styles.headline}>Give drama, get coins</Text>
        <Text style={styles.body}>
          Friends who join with your code unlock the app with you — you get +20 coins when they verify their email (limited each month so buying packs still matters).
        </Text>
      </View>

      {!isAuthenticated ? (
        <Text style={styles.guest}>Sign in to get your invite code.</Text>
      ) : loading ? (
        <ActivityIndicator color={COLORS.gold} />
      ) : (
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your code</Text>
          <Text style={styles.code}>{code || '—'}</Text>
          <TouchableOpacity style={styles.copyRow} onPress={copyCode}>
            <Copy size={14} color={COLORS.gold} />
            <Text style={styles.copyText}>Copy code</Text>
          </TouchableOpacity>
        </View>
      )}

      {isAuthenticated ? (
        <View style={styles.applyBox}>
          <Text style={styles.codeLabel}>Have a friend's code?</Text>
          <TextInput
            style={styles.input}
            value={applyCode}
            onChangeText={setApplyCode}
            autoCapitalize="characters"
            placeholder="Enter code"
            placeholderTextColor={COLORS.textFaint}
          />
          <TouchableOpacity style={styles.applyBtn} onPress={apply} disabled={busy}>
            <Text style={styles.applyText}>{busy ? '…' : 'Apply code'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 22, paddingTop: 8 },
  headline: { fontFamily: FONTS.extraBold, fontSize: 18, color: '#fff', marginTop: 12, marginBottom: 8 },
  body: {
    fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, textAlign: 'center', lineHeight: 19,
  },
  guest: { textAlign: 'center', color: COLORS.textFaint, fontFamily: FONTS.medium },
  codeCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 18, alignItems: 'center', marginBottom: 18,
  },
  codeLabel: { fontSize: 11, color: COLORS.textFaint, fontFamily: FONTS.semi, marginBottom: 6 },
  code: { fontSize: 26, fontFamily: FONTS.extraBold, color: COLORS.gold, letterSpacing: 2 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  copyText: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 13 },
  applyBox: { marginTop: 8 },
  input: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine, borderRadius: 12,
    padding: 12, color: '#fff', marginBottom: 10, fontFamily: FONTS.regular,
  },
  applyBtn: {
    backgroundColor: COLORS.navyLine, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  applyText: { color: '#fff', fontFamily: FONTS.bold },
  cta: {
    backgroundColor: COLORS.gold, borderRadius: 16, paddingVertical: 14, alignItems: 'center',
  },
  ctaText: { color: COLORS.navy, fontFamily: FONTS.bold, fontSize: 14.5 },
});

export default InviteFriendsScreen;
