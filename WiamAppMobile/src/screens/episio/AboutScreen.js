/**
 * About WiamEpisio
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const AboutScreen = () => (
  <EpisioScreenShell title="About WiamEpisio" subtitle="Built by WiamLabs">
    <Text style={styles.lead}>
      WiamEpisio is mobile-first short drama streaming — Ghana-founded, Africa-first, built for global scale.
    </Text>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>The WiamEpisio team</Text>
      <Text style={styles.body}>
        We are creators, engineers, and storytellers at WiamLabs. We ship vertical drama, fair creator tools, and coin-powered unlocks that work on real African networks.
      </Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>WiamLabs portfolio</Text>
      <Text style={styles.body}>WiamApp · WiamEpisio · WiamVox · WiamTrade (planned)</Text>
    </View>
    <TouchableOpacity onPress={() => Linking.openURL('https://wiamlabs.com')}>
      <Text style={styles.link}>wiamlabs.com</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={() => Linking.openURL('mailto:labs@wiamapp.com')}>
      <Text style={styles.link}>labs@wiamapp.com</Text>
    </TouchableOpacity>
  </EpisioScreenShell>
);

const styles = StyleSheet.create({
  lead: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.text, lineHeight: 23, marginTop: 8 },
  card: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 16, marginTop: 16,
  },
  cardTitle: { fontFamily: FONTS.semi, fontSize: 14, color: COLORS.gold, marginBottom: 8 },
  body: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, lineHeight: 20 },
  link: { fontFamily: FONTS.semi, fontSize: 14, color: COLORS.gold, marginTop: 20, textAlign: 'center' },
});

export default AboutScreen;
