/**
 * Invite friends — WIAM-FRIEND code + share
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Gift, Copy } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const INVITE_CODE = 'WIAM-FRIEND';

const InviteFriendsScreen = () => {
  const shareMessage = `Join me on WiamEpisio — African short drama! Use code ${INVITE_CODE} when you sign up.\nhttps://wiamapp.com`;

  const copyCode = async () => {
    try {
      await Clipboard.setStringAsync(INVITE_CODE);
      Alert.alert('Copied', 'Invite code copied.');
    } catch {
      Alert.alert('Invite code', INVITE_CODE);
    }
  };

  const share = () => Share.share({ message: shareMessage }).catch(() => {});

  return (
    <EpisioScreenShell
      title="Invite friends"
      subtitle="Both of you earn bonus coins"
      footer={(
        <TouchableOpacity style={styles.cta} onPress={share}>
          <Text style={styles.ctaText}>Share invite link</Text>
        </TouchableOpacity>
      )}
    >
      <View style={styles.hero}>
        <Gift size={40} color={COLORS.gold} />
        <Text style={styles.headline}>Give drama, get coins</Text>
        <Text style={styles.body}>Friends who join with your code unlock a welcome bonus — you get coins too.</Text>
      </View>
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Your code</Text>
        <Text style={styles.code}>{INVITE_CODE}</Text>
        <TouchableOpacity style={styles.copyBtn} onPress={copyCode}>
          <Copy size={14} color={COLORS.gold} />
          <Text style={styles.copyText}>Copy</Text>
        </TouchableOpacity>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  headline: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.text },
  body: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, textAlign: 'center', lineHeight: 20 },
  codeCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 20, alignItems: 'center', gap: 8,
  },
  codeLabel: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim },
  code: { fontFamily: FONTS.extraBold, fontSize: 28, color: COLORS.gold, letterSpacing: 2 },
  copyBtn: { flexDirection: 'row', gap: 6, marginTop: 8, padding: 8 },
  copyText: { fontFamily: FONTS.semi, color: COLORS.gold, fontSize: 13 },
  cta: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
});

export default InviteFriendsScreen;
