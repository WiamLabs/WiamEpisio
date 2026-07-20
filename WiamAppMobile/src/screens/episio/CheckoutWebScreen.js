/**
 * WiamEpisio-Checkout-Web.html — Paystack / web checkout handoff
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ExternalLink, CreditCard } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const CheckoutWebScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { checkoutUrl, reference, label = 'Complete payment' } = route.params || {};

  const openBrowser = async () => {
    if (!checkoutUrl) {
      Alert.alert('Checkout', 'Payment link unavailable. Try again from Buy Coins.');
      return;
    }
    try {
      await Linking.openURL(checkoutUrl);
    } catch {
      Alert.alert('Checkout', checkoutUrl);
    }
  };

  return (
    <EpisioScreenShell
      title="Secure checkout"
      subtitle="Paystack · wiamapp.com"
      footer={(
        <>
          <TouchableOpacity style={styles.cta} onPress={openBrowser}>
            <ExternalLink size={16} color={COLORS.navy} />
            <Text style={styles.ctaText}>Open in browser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.done} onPress={() => navigation.goBack()}>
            <Text style={styles.doneText}>Done — I paid</Text>
          </TouchableOpacity>
        </>
      )}
    >
      <View style={styles.card}>
        <CreditCard size={32} color={COLORS.gold} />
        <Text style={styles.headline}>{label}</Text>
        <Text style={styles.body}>
          You will complete payment in your browser via Paystack. Return here after paying — we confirm coins automatically.
        </Text>
        {reference ? <Text style={styles.ref}>Ref: {reference}</Text> : null}
      </View>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 24, alignItems: 'center', marginTop: 20, gap: 12,
  },
  headline: { fontFamily: FONTS.extraBold, fontSize: 17, color: COLORS.text, textAlign: 'center' },
  body: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, textAlign: 'center', lineHeight: 20 },
  ref: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.textFaint },
  cta: {
    flexDirection: 'row', gap: 8, backgroundColor: COLORS.gold, borderRadius: RADIUS.md,
    padding: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
  done: { padding: 12, alignItems: 'center' },
  doneText: { fontFamily: FONTS.semi, fontSize: 14, color: COLORS.gold },
});

export default CheckoutWebScreen;
