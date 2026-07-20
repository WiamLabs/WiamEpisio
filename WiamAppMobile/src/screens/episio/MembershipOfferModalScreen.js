/**
 * WiamEpisio-Membership-Offer-Modal.html — richer bottom-sheet VIP upsell.
 * Params: price, oldPrice, discountLabel, couponText, expiresIn (optional).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Crown, X, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';

const PERKS = [
  'Unlimited access to every VIP-exclusive series',
  'New episodes unlocked the moment they drop',
  'Zero ads anywhere in the app',
  'Daily coin bonus for members',
];

function formatTimer(totalSec) {
  const s = Math.max(0, totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return [pad(h), pad(m), pad(sec)];
}

const MembershipOfferModalScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const {
    price,
    oldPrice,
    discountLabel = 'GHS 10 OFF',
    couponText = 'A one-time discount for your first\n3 weeks of membership',
    expiresIn = 3600,
  } = route.params || {};

  const [remain, setRemain] = useState(Number(expiresIn) || 3600);

  useEffect(() => {
    const t = setInterval(() => setRemain((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const [hh, mm, ss] = formatTimer(remain);

  const goPlans = () => {
    navigation.goBack();
    setTimeout(() => {
      navigation.navigate('Main', { screen: 'Member' });
    }, 80);
  };

  return (
    <View style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => navigation.goBack()} />
      <View style={styles.sheet}>
        <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()}>
          <X size={17} color={COLORS.textFaint} />
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <Crown size={28} color={COLORS.navy} fill={COLORS.navy} />
        </View>
        <Text style={styles.congrats}>Congratulations!</Text>
        <Text style={styles.title}>Go VIP on WiamEpisio</Text>
        <Text style={styles.sub}>
          Watch without limits — exclusive series, early drops, and ad-free playback.
        </Text>

        {(price || discountLabel) ? (
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.coupon}>
            <View style={styles.couponNotchL} />
            <View style={styles.couponNotchR} />
            <Text style={styles.couponText}>{couponText}</Text>
            <Text style={styles.couponAmount}>{discountLabel}</Text>
            {(price || oldPrice) ? (
              <View style={styles.priceRow}>
                {price ? <Text style={styles.couponNew}>{price}</Text> : null}
                {oldPrice ? <Text style={styles.couponOld}>{oldPrice}</Text> : null}
              </View>
            ) : null}
          </LinearGradient>
        ) : null}

        <View style={styles.timerRow}>
          <Text style={styles.timerLabel}>Expires in</Text>
          <Text style={styles.timerBox}>{hh}</Text>
          <Text style={styles.timerColon}>:</Text>
          <Text style={styles.timerBox}>{mm}</Text>
          <Text style={styles.timerColon}>:</Text>
          <Text style={styles.timerBox}>{ss}</Text>
        </View>

        <View style={styles.perks}>
          {PERKS.map((p) => (
            <View key={p} style={styles.perkRow}>
              <Check size={14} color={COLORS.gold} />
              <Text style={styles.perk}>{p}</Text>
            </View>
          ))}
        </View>

        {price ? (
          <Text style={styles.priceHint}>From {price} · Cancel anytime</Text>
        ) : null}

        <EpisioGoldButton label="See VIP plans" onPress={goPlans} style={{ alignSelf: 'stretch' }} />
        <TouchableOpacity style={styles.skip} onPress={() => navigation.goBack()}>
          <Text style={styles.skipText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(8,8,26,0.7)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.navyCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 22, paddingTop: 26, paddingBottom: 18,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center',
  },
  close: { position: 'absolute', top: 14, right: 16, padding: 4, zIndex: 2 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  congrats: {
    fontFamily: FONTS.extraBold, fontSize: 18, color: COLORS.gold,
    fontStyle: 'italic', marginBottom: 6,
  },
  title: { fontFamily: FONTS.extraBold, fontSize: 18, color: '#fff', marginBottom: 6 },
  sub: {
    fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textDim,
    textAlign: 'center', lineHeight: 18, marginBottom: 16,
  },
  coupon: {
    alignSelf: 'stretch', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 16,
    marginBottom: 14, alignItems: 'center', overflow: 'hidden', position: 'relative',
  },
  couponNotchL: {
    position: 'absolute', left: -9, top: '50%', marginTop: -9,
    width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.navyCard,
  },
  couponNotchR: {
    position: 'absolute', right: -9, top: '50%', marginTop: -9,
    width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.navyCard,
  },
  couponText: {
    fontSize: 12.5, color: '#3A2E05', fontFamily: FONTS.semi,
    textAlign: 'center', lineHeight: 18, marginBottom: 8,
  },
  couponAmount: {
    fontSize: 26, fontFamily: FONTS.extraBold, color: COLORS.navy, marginBottom: 6,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponNew: { fontSize: 15, fontFamily: FONTS.extraBold, color: COLORS.navy },
  couponOld: {
    fontSize: 13, color: '#5A4200', textDecorationLine: 'line-through', fontFamily: FONTS.regular,
  },
  timerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16,
  },
  timerLabel: { fontSize: 12, color: COLORS.textDim, fontFamily: FONTS.regular, marginRight: 4 },
  timerBox: {
    fontSize: 13, fontFamily: FONTS.bold, color: '#fff',
    backgroundColor: COLORS.navyLine, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  timerColon: { color: COLORS.textDim, fontFamily: FONTS.bold },
  perks: { alignSelf: 'stretch', gap: 10, marginBottom: 14 },
  perkRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  perk: { flex: 1, fontFamily: FONTS.regular, fontSize: 12, color: '#E7E7F2', lineHeight: 18 },
  priceHint: {
    fontSize: 11.5, color: COLORS.textDim, fontFamily: FONTS.medium, marginBottom: 12,
  },
  skip: { marginTop: 12, padding: 8 },
  skipText: { fontFamily: FONTS.semi, color: COLORS.textDim, fontSize: 13.5 },
});

export default MembershipOfferModalScreen;
