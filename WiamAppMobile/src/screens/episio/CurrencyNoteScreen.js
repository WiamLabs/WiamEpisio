/**
 * WiamEpisio-Currency-Note.html — GHS / coins explanation
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Coins } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const CurrencyNoteScreen = () => (
  <EpisioScreenShell title="Coins & GHS" subtitle="How payments work">
    <View style={styles.hero}>
      <Coins size={36} color={COLORS.gold} />
      <Text style={styles.headline}>WiamEpisio uses coins</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.q}>What are coins?</Text>
      <Text style={styles.a}>Coins unlock premium episodes after the free ones. You buy coin packs with Ghana Cedis (GHS) via Paystack.</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.q}>GHS pricing</Text>
      <Text style={styles.a}>Checkout shows prices in GHS. Mobile Money, cards, and bank channels are supported through Paystack.</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.q}>Refunds</Text>
      <Text style={styles.a}>Coin purchases are generally final. Contact support@wiamapp.com for billing issues.</Text>
    </View>
  </EpisioScreenShell>
);

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  headline: { fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.text },
  card: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 14, marginBottom: 12,
  },
  q: { fontFamily: FONTS.semi, fontSize: 14, color: COLORS.gold, marginBottom: 6 },
  a: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, lineHeight: 20 },
});

export default CurrencyNoteScreen;
