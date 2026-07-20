/**
 * Maintenance mode
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Wrench } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS } from '../../constants/theme';

const MaintenanceScreen = () => (
  <EpisioScreenShell title="Maintenance" scroll={false}>
    <View style={styles.center}>
      <Wrench size={48} color={COLORS.gold} />
      <Text style={styles.headline}>We'll be right back</Text>
      <Text style={styles.sub}>
        WiamEpisio is undergoing scheduled maintenance. Try again in a few minutes.
      </Text>
      <Text style={styles.contact}>support@wiamapp.com</Text>
    </View>
  </EpisioScreenShell>
);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  headline: { fontFamily: FONTS.extraBold, fontSize: 20, color: COLORS.text },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 21 },
  contact: { fontFamily: FONTS.semi, fontSize: 13, color: COLORS.gold, marginTop: 16 },
});

export default MaintenanceScreen;
