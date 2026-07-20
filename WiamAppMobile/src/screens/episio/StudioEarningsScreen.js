/**
 * Layout: WiamStudio-Earnings.html — empty until team publishes
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const StudioEarningsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      try {
        const d = await studioEpisioApi.getSeries(seriesId);
        setSeries(d?.series);
      } finally {
        setLoading(false);
      }
    })();
  }, [seriesId]));

  const live = ['published', 'ongoing', 'complete', 'approved'].includes(series?.status);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingHorizontal: 20 }]}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <ChevronLeft size={20} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Earnings</Text>
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 30 }} /> : (
        <>
          <Text style={styles.amount}>{live ? '₵0.00' : '—'}</Text>
          <Text style={styles.sub}>
            {live
              ? 'Earnings start counting from the moment the WiamEpisio team published your series. Payouts unlock after KYC.'
              : 'Earnings stay empty until the WiamEpisio team publishes your complete series. Half stories never earn.'}
          </Text>
          <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('StudioPayoutKyc')}>
            <Text style={styles.ctaText}>Payout & KYC</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontFamily: FONTS.extraBold, color: '#fff' },
  amount: { marginTop: 24, fontSize: 36, fontFamily: FONTS.extraBold, color: COLORS.gold },
  sub: { marginTop: 12, color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 20 },
  cta: {
    marginTop: 24, backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center',
  },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.gold },
});

export default StudioEarningsScreen;
