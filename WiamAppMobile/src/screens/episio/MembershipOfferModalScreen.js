/**
 * WiamEpisio-Membership-Offer-Modal.html — VIP upsell
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Crown, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const MembershipOfferModalScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <TouchableOpacity style={styles.dismiss} onPress={() => navigation.goBack()}>
        <X size={22} color={COLORS.textDim} />
      </TouchableOpacity>
      <View style={styles.sheet}>
        <View style={styles.iconWrap}>
          <Crown size={32} color={COLORS.navy} fill={COLORS.gold} />
        </View>
        <Text style={styles.title}>Go VIP</Text>
        <Text style={styles.sub}>Unlock all episodes, skip ads, and get Origin early access.</Text>
        <View style={styles.perks}>
          {['Unlimited episodes', 'Daily coin bonus', 'Origin shelf access'].map((p) => (
            <Text key={p} style={styles.perk}>✓ {p}</Text>
          ))}
        </View>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Main', { screen: 'Member' })}>
          <Text style={styles.ctaText}>See VIP plans</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skip} onPress={() => navigation.goBack()}>
          <Text style={styles.skipText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end',
  },
  dismiss: { position: 'absolute', top: 56, right: 20, zIndex: 2, padding: 8 },
  sheet: {
    backgroundColor: COLORS.navyCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.navyLine,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontFamily: FONTS.extraBold, fontSize: 22, color: COLORS.text, marginBottom: 8 },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 20 },
  perks: { alignSelf: 'stretch', marginTop: 20, marginBottom: 24, gap: 8 },
  perk: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.text },
  cta: {
    alignSelf: 'stretch', backgroundColor: COLORS.gold, borderRadius: RADIUS.md,
    padding: 15, alignItems: 'center',
  },
  ctaText: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.navy },
  skip: { marginTop: 14, padding: 8 },
  skipText: { fontFamily: FONTS.semi, color: COLORS.textDim, fontSize: 14 },
});

export default MembershipOfferModalScreen;
