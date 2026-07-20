/**
 * Downloads manager — empty state + WiFi note
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Download, Wifi } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const DownloadsManagerScreen = () => (
  <EpisioScreenShell title="Downloads" subtitle="Offline episodes">
    <View style={styles.empty}>
      <View style={styles.iconWrap}>
        <Download size={36} color={COLORS.textFaint} />
      </View>
      <Text style={styles.title}>No downloads yet</Text>
      <Text style={styles.sub}>
        Download episodes on WiFi to watch without data. Look for the download icon on unlocked episodes.
      </Text>
    </View>
    <View style={styles.note}>
      <Wifi size={16} color={COLORS.gold} />
      <Text style={styles.noteText}>Downloads start on WiFi only by default. Change this in Settings.</Text>
    </View>
  </EpisioScreenShell>
);

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 12 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.text, marginBottom: 8 },
  sub: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, textAlign: 'center', lineHeight: 20 },
  note: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 32,
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.md, padding: 14,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  noteText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, lineHeight: 18 },
});

export default DownloadsManagerScreen;
