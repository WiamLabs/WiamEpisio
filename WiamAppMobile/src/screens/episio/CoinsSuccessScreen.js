/**
 * WiamEpisio-Coins-Success.html
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Coins } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const CoinsSuccessScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const amount = route.params?.amount;

  return (
    <EpisioScreenShell
      title="Coins added"
      scroll={false}
      footer={(
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.ctaText}>Back to Home</Text>
        </TouchableOpacity>
      )}
    >
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Coins size={44} color={COLORS.navy} fill={COLORS.gold} />
        </View>
        <Text style={styles.headline}>Purchase confirmed</Text>
        <Text style={styles.sub}>
          {amount ? `+${amount} coins added to your wallet.` : 'Your coins were added to your wallet.'}
        </Text>
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  headline: { fontFamily: FONTS.extraBold, fontSize: 22, color: COLORS.text, marginBottom: 8 },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', paddingHorizontal: 20 },
  cta: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, padding: 15, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
});

export default CoinsSuccessScreen;
