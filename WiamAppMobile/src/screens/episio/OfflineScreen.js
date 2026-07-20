/**
 * Offline state
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { WifiOff } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const OfflineScreen = () => {
  const navigation = useNavigation();

  return (
    <EpisioScreenShell title="You're offline" scroll={false}>
      <View style={styles.center}>
        <WifiOff size={48} color={COLORS.textFaint} />
        <Text style={styles.headline}>No connection</Text>
        <Text style={styles.sub}>Check WiFi or mobile data. Downloaded episodes work offline.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('DownloadsManager')}>
          <Text style={styles.ctaText}>View downloads</Text>
        </TouchableOpacity>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  headline: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.text },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 21 },
  cta: { marginTop: 16, backgroundColor: COLORS.navyCard, borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.navyLine },
  ctaText: { fontFamily: FONTS.semi, color: COLORS.gold },
});

export default OfflineScreen;
