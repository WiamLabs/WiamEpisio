/**
 * Force update required
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Download } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/wiamapp/id000000000',
  android: 'https://play.google.com/store/apps/details?id=com.wiamapp.mobile',
  default: 'https://wiamapp.com',
});

const ForceUpdateScreen = () => {
  const update = () => Linking.openURL(STORE_URL).catch(() => {});

  return (
    <EpisioScreenShell title="Update required" scroll={false}>
      <View style={styles.center}>
        <Download size={48} color={COLORS.gold} />
        <Text style={styles.headline}>Please update WiamEpisio</Text>
        <Text style={styles.sub}>
          This version is no longer supported. Update from the store to keep watching and using Studio.
        </Text>
        <TouchableOpacity style={styles.cta} onPress={update}>
          <Text style={styles.ctaText}>Update now</Text>
        </TouchableOpacity>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 14 },
  headline: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.text },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 21 },
  cta: { marginTop: 12, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingHorizontal: 28, paddingVertical: 14 },
  ctaText: { fontFamily: FONTS.extraBold, color: COLORS.navy },
});

export default ForceUpdateScreen;
