/**
 * WiamEpisio-Share-Sheet.html — modal share actions
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Linking, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Link2, MessageCircle, Instagram, Twitter } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const ShareSheetScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { title = 'WiamEpisio', url = 'https://wiamapp.com', message } = route.params || {};
  const shareText = message || `Watch ${title} on WiamEpisio\n${url}`;

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(url);
      Alert.alert('Copied', 'Link copied to clipboard.');
    } catch {
      Alert.alert('Copy link', url);
    }
  };

  const shareNative = () => Share.share({ message: shareText, url }).catch(() => {});

  const openApp = async (scheme, fallback) => {
    try {
      const can = await Linking.canOpenURL(scheme);
      if (can) await Linking.openURL(scheme);
      else await Linking.openURL(fallback);
    } catch {
      shareNative();
    }
  };

  const rows = [
    { key: 'copy', label: 'Copy link', icon: Link2, onPress: copyLink },
    {
      key: 'wa',
      label: 'WhatsApp',
      icon: MessageCircle,
      onPress: () => openApp(`whatsapp://send?text=${encodeURIComponent(shareText)}`, `https://wa.me/?text=${encodeURIComponent(shareText)}`),
    },
    {
      key: 'ig',
      label: 'Instagram',
      icon: Instagram,
      onPress: () => openApp('instagram://app', 'https://instagram.com'),
    },
    {
      key: 'x',
      label: 'X (Twitter)',
      icon: Twitter,
      onPress: () => openApp(`twitter://post?message=${encodeURIComponent(shareText)}`, `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`),
    },
  ];

  return (
    <EpisioScreenShell title="Share" subtitle={title} onBack={() => navigation.goBack()}>
      <Text style={styles.hint}>Spread the word — friends watch free episodes too.</Text>
      {rows.map((r) => {
        const Icon = r.icon;
        return (
          <TouchableOpacity key={r.key} style={styles.row} onPress={r.onPress}>
            <View style={styles.iconWrap}><Icon size={18} color={COLORS.gold} /></View>
            <Text style={styles.rowLabel}>{r.label}</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={styles.more} onPress={shareNative}>
        <Text style={styles.moreText}>More options…</Text>
      </TouchableOpacity>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  hint: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, marginBottom: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontFamily: FONTS.semi, fontSize: 15, color: COLORS.text },
  more: { marginTop: 24, alignItems: 'center' },
  moreText: { fontFamily: FONTS.semi, color: COLORS.gold, fontSize: 14 },
});

export default ShareSheetScreen;
